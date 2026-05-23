import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { transcribeAudio, analyzeTranscript } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — accommodate long calls

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = createServiceClient();

  // Fetch the call row
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
    // ----- Transcription -----
    await sb.from("calls").update({ status: "transcribing", error_message: null }).eq("id", id);

    const { data: signed, error: signErr } = await sb.storage
      .from("call-audio")
      .createSignedUrl(call.audio_path, 60 * 10);
    if (signErr || !signed) throw new Error(`خطا در دریافت فایل: ${signErr?.message ?? "unknown"}`);

    const resp = await fetch(signed.signedUrl);
    if (!resp.ok) throw new Error(`خطا در دانلود فایل صوتی (${resp.status})`);
    const blob = await resp.blob();

    const fname = call.audio_path.split("/").pop() || "audio";
    const file = new File([blob], fname, { type: blob.type || "audio/mpeg" });

    const { text: transcript, duration } = await transcribeAudio(file);

    if (!transcript || transcript.trim().length === 0) {
      throw new Error("متن مکالمه استخراج نشد. ممکن است فایل صوتی نامفهوم باشد.");
    }

    await sb.from("calls").update({
      transcript,
      audio_duration_sec: duration ? Math.round(duration) : null,
      status: "analyzing",
    }).eq("id", id);

    // ----- Analysis -----
    const analysis = await analyzeTranscript(transcript);

    await sb.from("calls").update({
      caller_name: analysis.caller_name,
      caller_phone: analysis.caller_phone,
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
    await sb.from("calls").update({
      status: "failed",
      error_message: message,
    }).eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
