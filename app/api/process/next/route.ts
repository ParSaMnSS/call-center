import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processCall } from "@/lib/process";
import { getAppBaseUrl } from "@/lib/base-url";

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
    // Log loudly so the operator sees it in `npm run dev` output.
    // Most common cause: migration 0002 wasn't run (RPC doesn't exist).
    console.error("[worker] claim_next_call failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const claimed = (data as Array<{ id: string; audio_path: string; original_filename: string | null }> | null)?.[0];
  if (!claimed) {
    console.log("[worker] no pending calls");
    return NextResponse.json({ ok: true, claimed: false });
  }

  console.log(`[worker] processing ${claimed.id} (${claimed.original_filename ?? claimed.audio_path})`);
  const t0 = Date.now();
  await processCall(sb, claimed.id, claimed.audio_path, claimed.original_filename);
  console.log(`[worker] finished ${claimed.id} in ${Math.round((Date.now() - t0) / 1000)}s`);

  // Chain to the next pending call. `after()` keeps the function alive
  // long enough for the kick to actually go out.
  const base = getAppBaseUrl();
  after(async () => {
    try {
      await fetch(`${base}/api/process/next`, { method: "POST" });
    } catch (e) {
      console.error("[worker] chain kick failed:", e);
    }
  });

  return NextResponse.json({ ok: true, claimed: true, id: claimed.id });
}
