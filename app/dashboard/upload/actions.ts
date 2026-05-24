"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPhoneFromFilename } from "@/lib/phone";
import { getAppBaseUrl } from "@/lib/base-url";

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

  // Kick the serial worker. Using `after()` defers the request until the
  // response is sent but keeps the function alive long enough for the
  // fetch to actually go out — avoids the race where the action returns,
  // the user navigates away, and the in-flight kick gets aborted.
  const base = getAppBaseUrl();
  after(async () => {
    try {
      await fetch(`${base}/api/process/next`, { method: "POST" });
    } catch (e) {
      console.error("[uploadOneCall] worker kick failed:", e);
    }
  });

  return { ok: true, id: row.id, filename: fname };
}

// Kick off the serial worker (idempotent — if it's already running, the
// claim RPC returns no rows and it exits cleanly).
export async function kickWorker(): Promise<void> {
  const base = getAppBaseUrl();
  // Don't await — fire-and-forget so the upload form doesn't hang on it.
  fetch(`${base}/api/process/next`, { method: "POST" }).catch((e) => {
    console.error("[kickWorker] failed:", e);
  });
}
