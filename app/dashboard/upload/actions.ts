"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractPhoneFromFilename } from "@/lib/phone";
import { claimAndProcessNext } from "@/lib/process";

// Gemini's inline audio limit is ~20MB request size. We give a small buffer.
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = ["mp3", "wav", "m4a", "ogg", "webm", "mp4", "aac", "flac"];

function safeExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = m ? m[1].toLowerCase() : "bin";
  return ext.slice(0, 6);
}

export type UploadResult = {
  ok: boolean;
  id?: string;
  filename: string;
  error?: string;
};

export async function uploadOneCall(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  const fname = (file instanceof File ? file.name : "") || "audio";

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, filename: fname, error: "فایلی انتخاب نشده است" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, filename: fname, error: "حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)" };
  }
  const ext = safeExt(file.name);
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, filename: fname, error: "نوع فایل پشتیبانی نمی‌شود" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, filename: fname, error: "احراز هویت نشده‌اید" };

  // Pre-extract phone from filename — show it immediately in the UI
  const phoneHint = extractPhoneFromFilename(file.name);

  const { data: row, error: insErr } = await supabase
    .from("calls")
    .insert({
      uploaded_by: user.id,
      audio_path: "pending",
      status: "pending",
      caller_phone: phoneHint, // Best guess until AI confirms/overrides
      original_filename: file.name,
    })
    .select("id")
    .single();
  if (insErr || !row) return { ok: false, filename: fname, error: insErr?.message ?? "خطا در ایجاد رکورد" };

  const path = `${user.id}/${row.id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("call-audio")
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (upErr) {
    await supabase.from("calls").update({
      status: "failed",
      error_message: `خطا در بارگذاری فایل: ${upErr.message}`,
    }).eq("id", row.id);
    return { ok: false, filename: fname, error: upErr.message };
  }

  await supabase.from("calls").update({ audio_path: path }).eq("id", row.id);

  // Claim + start processing in-process. No HTTP hop, no self-fetch.
  // claimAndProcessNext registers the actual Gemini work via after(),
  // so this returns in ~50ms and the work runs after the response is sent.
  console.log(`[uploadOneCall] row ${row.id} created, claiming worker slot`);
  try {
    const res = await claimAndProcessNext();
    console.log(`[uploadOneCall] claim result:`, res);
  } catch (e) {
    console.error("[uploadOneCall] claim failed:", e);
  }

  return { ok: true, id: row.id, filename: fname };
}

// Kick off the serial worker (idempotent — if no pending row, no-op).
// Called from dashboard mount + detail page mount as a safety net.
export async function kickWorker(): Promise<void> {
  try {
    const res = await claimAndProcessNext();
    console.log("[kickWorker] result:", res);
  } catch (e) {
    console.error("[kickWorker] failed:", e);
  }
}

// ============================================================================
// Direct-upload flow: client PUTs the file straight to Storage via a signed
// URL, so the browser can show real upload progress. The Next server only
// handles the row insert and the post-upload finalize.
// ============================================================================

export type CreatePendingResult =
  | { ok: true; id: string; signedUrl: string; token: string; path: string }
  | { ok: false; error: string };

// Step 1: insert a placeholder row + mint a signed upload URL for the
// client. The row sits at audio_path='pending' until finalizePendingCall
// confirms the storage write.
export async function createPendingCall(
  filename: string,
  sizeBytes: number,
): Promise<CreatePendingResult> {
  if (!filename) return { ok: false, error: "نام فایل نامعتبر است" };
  if (sizeBytes <= 0) return { ok: false, error: "فایل خالی است" };
  if (sizeBytes > MAX_BYTES) {
    return { ok: false, error: "حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)" };
  }
  const ext = safeExt(filename);
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, error: "نوع فایل پشتیبانی نمی‌شود" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "احراز هویت نشده‌اید" };

  const phoneHint = extractPhoneFromFilename(filename);

  const { data: row, error: insErr } = await supabase
    .from("calls")
    .insert({
      uploaded_by: user.id,
      audio_path: "pending",
      status: "pending",
      caller_phone: phoneHint,
      original_filename: filename,
    })
    .select("id")
    .single();
  if (insErr || !row) {
    return { ok: false, error: insErr?.message ?? "خطا در ایجاد رکورد" };
  }

  const path = `${user.id}/${row.id}.${ext}`;
  // Service client because Storage's createSignedUploadUrl needs more
  // permissions than the anon role for some Supabase versions. Path is
  // namespaced under the user's UID either way.
  const svc = createServiceClient();
  const { data: signed, error: signErr } = await svc.storage
    .from("call-audio")
    .createSignedUploadUrl(path);
  if (signErr || !signed) {
    // Clean up the orphan row
    await supabase.from("calls").delete().eq("id", row.id);
    return { ok: false, error: signErr?.message ?? "خطا در ایجاد لینک بارگذاری" };
  }

  return {
    ok: true,
    id: row.id,
    signedUrl: signed.signedUrl,
    token: signed.token,
    path,
  };
}

export type FinalizePendingResult =
  | { ok: true }
  | { ok: false; error: string };

// Step 2: client confirms the PUT succeeded. We set audio_path to the real
// storage path and kick the serial worker. If the client never calls this
// (e.g. tab closed), the row stays at audio_path='pending' and the claim
// RPC skips it — so it never gets processed, only manually cleaned up.
export async function finalizePendingCall(id: string, path: string): Promise<FinalizePendingResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "احراز هویت نشده‌اید" };

  const { error } = await supabase
    .from("calls")
    .update({ audio_path: path })
    .eq("id", id)
    .eq("uploaded_by", user.id);
  if (error) return { ok: false, error: error.message };

  try {
    await claimAndProcessNext();
  } catch (e) {
    console.error("[finalizePendingCall] claim failed:", e);
  }

  return { ok: true };
}

// If the client-side upload fails, mark the placeholder row as failed so
// the user sees something useful and can retry / delete it.
export async function abortPendingCall(id: string, message: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("calls")
    .update({
      status: "failed",
      error_message: `خطا در بارگذاری فایل: ${message}`,
    })
    .eq("id", id)
    .eq("uploaded_by", user.id);
}
