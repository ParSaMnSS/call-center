import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processCall } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Serial worker. Atomically claim the oldest pending call, process it,
// then (if there's more) kick off the next one. Multiple concurrent
// invocations are safe — the claim RPC uses FOR UPDATE SKIP LOCKED so
// only one worker can ever hold a given row.
export async function POST() {
  const sb = createServiceClient();

  const { data, error } = await sb.rpc("claim_next_call");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const claimed = (data as Array<{ id: string; audio_path: string; original_filename: string | null }> | null)?.[0];
  if (!claimed) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  // Process synchronously (within this serverless invocation's budget).
  await processCall(sb, claimed.id, claimed.audio_path, claimed.original_filename);

  // Chain: fire-and-forget next pending call.
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${base}/api/process/next`, { method: "POST" }).catch(() => {});

  return NextResponse.json({ ok: true, claimed: true, id: claimed.id });
}
