import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processCall } from "@/lib/process";
import { getAppBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const maxDuration = 300;

// Serial worker. Atomically claim the oldest pending call, return immediately,
// and process it in the background via `after()` (which Vercel keeps alive
// via waitUntil). When done, kick ourselves to grab the next pending call.
export async function POST() {
  const sb = createServiceClient();

  const { data, error } = await sb.rpc("claim_next_call");
  if (error) {
    console.error("[worker] claim_next_call failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const claimed = (data as Array<{ id: string; audio_path: string; original_filename: string | null }> | null)?.[0];
  if (!claimed) {
    console.log("[worker] no pending calls");
    return NextResponse.json({ ok: true, claimed: false });
  }

  console.log(`[worker] claimed ${claimed.id} (${claimed.original_filename ?? claimed.audio_path}) — processing in background`);

  // Process AFTER returning the response. Vercel keeps the function alive
  // (up to maxDuration) until this completes. The route handler context is
  // where `after()` is most reliable on Vercel.
  after(async () => {
    const t0 = Date.now();
    await processCall(sb, claimed.id, claimed.audio_path, claimed.original_filename);
    console.log(`[worker] finished ${claimed.id} in ${Math.round((Date.now() - t0) / 1000)}s`);

    // Chain to the next pending call. Fire-and-forget — the next invocation
    // has its own maxDuration budget.
    const base = getAppBaseUrl();
    try {
      await fetch(`${base}/api/process/next`, { method: "POST" });
    } catch (e) {
      console.error("[worker] chain kick failed:", e);
    }
  });

  // Return immediately so the caller (upload form or another worker) isn't blocked.
  return NextResponse.json({ ok: true, claimed: true, id: claimed.id });
}
