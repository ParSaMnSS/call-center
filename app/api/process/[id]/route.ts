import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processCall } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// On-demand reprocess for a specific call (used by the "تحلیل مجدد" button).
// New uploads go through /api/process/next via the serial worker.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sb = createServiceClient();

  let filenameHint: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.filename === "string") filenameHint = body.filename;
  } catch { /* no body — reprocess from UI */ }

  const { data: call, error } = await sb
    .from("calls")
    .select("id, audio_path, status")
    .eq("id", id)
    .single();
  if (error || !call) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (call.status === "analyzing") {
    return NextResponse.json({ ok: true, status: call.status });
  }

  // Flip to analyzing + stamp start time so the UI elapsed timer works.
  await sb.from("calls").update({
    status: "analyzing",
    processing_started_at: new Date().toISOString(),
    error_message: null,
  }).eq("id", id);

  await processCall(sb, id, call.audio_path, filenameHint);
  return NextResponse.json({ ok: true });
}
