import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeAudio } from "@/lib/ai";
import { extractPhoneFromFilename } from "@/lib/phone";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — accommodate long calls

async function isAborted(sb: ReturnType<typeof createServiceClient>, id: string): Promise<boolean> {
  const { data } = await sb.from("calls").select("status").eq("id", id).maybeSingle();
  if (!data) return true;
  if (data.status === "failed") return true;
  return false;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = createServiceClient();

  // Optional filename hint from upload action
  let filenameHint: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.filename === "string") filenameHint = body.filename;
  } catch { /* no body / not JSON / reprocess from UI */ }

  const { data: call, error } = await sb
    .from("calls")
    .select("id, audio_path, status")
    .eq("id", id)
    .single();

  if (error || !call) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (call.status === "transcribing" || call.status === "analyzing" || call.status === "done") {
    return NextResponse.json({ ok: true, status: call.status });
  }

  try {
    await sb.from("calls").update({ status: "analyzing", error_message: null }).eq("id", id);

    const { data: signed, error: signErr } = await sb.storage
      .from("call-audio")
      .createSignedUrl(call.audio_path, 60 * 10);
    if (signErr || !signed) throw new Error(`خطا در دریافت فایل: ${signErr?.message ?? "unknown"}`);

    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`خطا در دانلود فایل صوتی (${resp.status})`);
    const blob = await resp.blob();

    const storedName = call.audio_path.split("/").pop() || "audio";
    const file = new File([blob], storedName, { type: blob.type || "audio/mpeg" });

    // Use the original upload filename as a hint to Gemini (phone is usually there).
    // On reprocess we don't have it, so fall back to the storage filename.
    const hintName = filenameHint || storedName;
    const phoneHint = extractPhoneFromFilename(hintName);

    const { analysis } = await analyzeAudio(file, {
      filenameHint: hintName,
      phoneHint,
    });

    if (!analysis.transcript || analysis.transcript.trim().length === 0) {
      throw new Error("متن مکالمه استخراج نشد. ممکن است فایل صوتی نامفهوم باشد.");
    }

    if (await isAborted(sb, id)) {
      return NextResponse.json({ ok: true, aborted: true });
    }

    // Prefer the AI-extracted phone if it found one in the audio;
    // otherwise keep the filename-derived hint we saved at upload time.
    const finalPhone = analysis.caller_phone || phoneHint;

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
      status: "done",
    }).eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "خطای ناشناخته";
    if (!(await isAborted(sb, id))) {
      await sb.from("calls").update({
        status: "failed",
        error_message: message,
      }).eq("id", id);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
