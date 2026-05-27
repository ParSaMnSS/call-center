// Shared processing pipeline used by both /api/process/[id] (reprocess) and
// /api/process/next (serial worker).
//
// Caller must ensure the row is already in `analyzing` state before calling
// (the claim RPC does this for the serial worker; the per-id route does it
// explicitly).

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeAudio, TransientAIError } from "@/lib/ai";
import { extractPhoneFromFilename } from "@/lib/phone";
import { createServiceClient } from "@/lib/supabase/server";

async function isAborted(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await sb.from("calls").select("status").eq("id", id).maybeSingle();
  if (!data) return true; // row deleted
  // If status flipped to 'failed', another writer (cancel button) won.
  if (data.status === "failed") return true;
  return false;
}

export async function processCall(
  sb: SupabaseClient,
  id: string,
  audioPath: string,
  filenameHint: string | null,
): Promise<{ transient: boolean }> {
  const startMs = Date.now();
  try {
    const { data: signed, error: signErr } = await sb.storage
      .from("call-audio")
      .createSignedUrl(audioPath, 60 * 10);
    if (signErr || !signed) throw new Error(`خطا در دریافت فایل: ${signErr?.message ?? "unknown"}`);

    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`خطا در دانلود فایل صوتی (${resp.status})`);
    const blob = await resp.blob();

    const storedName = audioPath.split("/").pop() || "audio";
    const file = new File([blob], storedName, { type: blob.type || "audio/mpeg" });

    const hintName = filenameHint || storedName;
    const phoneHint = extractPhoneFromFilename(hintName);

    const { analysis } = await analyzeAudio(file, { filenameHint: hintName, phoneHint });

    if (!analysis.transcript || analysis.transcript.trim().length === 0) {
      throw new Error("متن مکالمه استخراج نشد. ممکن است فایل صوتی نامفهوم باشد.");
    }

    if (await isAborted(sb, id)) return { transient: false };

    const finalPhone = analysis.caller_phone || phoneHint;

    const elapsedSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));

    await sb.from("calls").update({
      transcript: analysis.transcript,
      caller_name: analysis.caller_name,
      caller_phone: finalPhone,
      agent_name: analysis.agent_name,
      issue_summary: analysis.issue_summary,
      resolved: analysis.resolved,
      category: analysis.category,
      tags: analysis.tags,
      agent_behavior: analysis.agent_behavior,
      caller_behavior: analysis.caller_behavior,
      sentiment_agent: analysis.sentiment_agent,
      sentiment_caller: analysis.sentiment_caller,
      follow_up_needed: analysis.follow_up_needed,
      notes: analysis.notes,
      processing_seconds: elapsedSec,
      status: "done",
    }).eq("id", id);
    return { transient: false };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "خطای ناشناخته";
    if (await isAborted(sb, id)) return { transient: false };

    // Transient (Gemini overloaded / rate limit / network blip): revert to
    // pending and let the cron retry later. Stash the message in
    // error_message so the UI can show *why* it's still queued.
    if (e instanceof TransientAIError) {
      console.warn(`[processCall] ${id} transient: ${message} — reverting to pending`);
      await sb.from("calls").update({
        status: "pending",
        processing_started_at: null,
        error_message: message,
      }).eq("id", id);
      return { transient: true };
    }

    // Permanent failure — mark failed, worker will continue to the next row.
    await sb.from("calls").update({
      status: "failed",
      error_message: message,
    }).eq("id", id);
    return { transient: false };
  }
}

// Claim the oldest pending call and process it in the background via after().
// Returns immediately after the claim — the actual Gemini call runs after the
// caller's response is sent. When it finishes, kicks itself again to grab
// the next pending row.
//
// Safe to call from anywhere a Next.js request context exists (route handler,
// server action, server component) — that's where after() can register
// background work. Idempotent: if no pending row, returns { claimed: false }.
export async function claimAndProcessNext(): Promise<
  { claimed: false; reason?: "busy" | "empty" } | { claimed: true; id: string }
> {
  const sb = createServiceClient();

  // Enforce serial processing: if any row is currently in flight, don't
  // claim another one. The currently-running worker will chain to the next
  // pending row when it finishes (or the cron will, if it failed transient).
  // This is what keeps 50 concurrent uploads from spawning 50 parallel
  // Gemini calls.
  const { count: inFlight, error: countErr } = await sb
    .from("calls")
    .select("id", { count: "exact", head: true })
    .in("status", ["analyzing", "transcribing"]);
  if (countErr) {
    console.error("[claimAndProcessNext] in-flight count failed:", countErr.message);
    throw new Error(countErr.message);
  }
  if ((inFlight ?? 0) > 0) {
    console.log(`[claimAndProcessNext] skip — ${inFlight} already in flight`);
    return { claimed: false, reason: "busy" };
  }

  const { data, error } = await sb.rpc("claim_next_call");
  if (error) {
    console.error("[claimAndProcessNext] claim_next_call failed:", error.message);
    throw new Error(error.message);
  }
  const claimed = (data as Array<{ id: string; audio_path: string; original_filename: string | null }> | null)?.[0];
  if (!claimed) {
    console.log("[claimAndProcessNext] no pending calls");
    return { claimed: false, reason: "empty" };
  }

  console.log(`[claimAndProcessNext] claimed ${claimed.id} (${claimed.original_filename ?? claimed.audio_path}) — processing in background`);

  after(async () => {
    const t0 = Date.now();
    const result = await processCall(sb, claimed.id, claimed.audio_path, claimed.original_filename);
    console.log(`[claimAndProcessNext] finished ${claimed.id} in ${Math.round((Date.now() - t0) / 1000)}s (transient=${result.transient})`);
    // If Gemini is overloaded, pause the queue — the /api/retry-pending cron
    // will pick things back up. Otherwise chain to the next pending row.
    if (result.transient) {
      console.warn("[claimAndProcessNext] queue paused due to transient AI error; cron will retry");
      return;
    }
    try {
      await claimAndProcessNext();
    } catch (e) {
      console.error("[claimAndProcessNext] chain failed:", e);
    }
  });

  return { claimed: true, id: claimed.id };
}
