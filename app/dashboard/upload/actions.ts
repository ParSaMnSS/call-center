"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper single-shot limit)
const ALLOWED = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/webm"];

function safeExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = m ? m[1].toLowerCase() : "bin";
  return ext.slice(0, 6);
}

export async function uploadCallAudio(formData: FormData): Promise<{ error?: string; id?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "فایلی انتخاب نشده است" };
  }
  if (file.size > MAX_BYTES) {
    return { error: "حجم فایل بیش از حد مجاز است (حداکثر ۲۵ مگابایت)" };
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    // Allow unknown types based on extension as a fallback
    const ext = safeExt(file.name);
    if (!["mp3", "wav", "m4a", "ogg", "webm", "mp4"].includes(ext)) {
      return { error: "نوع فایل پشتیبانی نمی‌شود" };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "احراز هویت نشده‌اید" };

  // Insert row first to get an ID
  const ext = safeExt(file.name);
  const { data: row, error: insErr } = await supabase
    .from("calls")
    .insert({
      uploaded_by: user.id,
      audio_path: "pending",
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "خطا در ایجاد رکورد" };

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
    return { error: upErr.message };
  }

  await supabase.from("calls").update({ audio_path: path }).eq("id", row.id);

  // Fire-and-forget processor call. We don't await so the user is redirected immediately.
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${base}/api/process/${row.id}`, { method: "POST" }).catch(() => {});

  redirect(`/dashboard/calls/${row.id}`);
}
