import { NextResponse } from "next/server";
import { processNextInline } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cron-driven retry. Runs every minute (see vercel.json) AND can be hit
// manually from the dashboard "Retry now" button. Processes inline (not via
// after()) so the work actually completes within this invocation — after()
// callbacks can be cut short when the function instance shuts down, which
// would silently swallow retries.
//
// Chains up to 5 rows per tick so we don't sit on a long queue.
export async function GET(req: Request) {
  // Vercel cron requests carry this header. Manual triggers from the
  // dashboard hit the same route — those are POSTs (see below), so any
  // unauthenticated GET in prod is rejected. In dev there's no header —
  // allow GETs for manual curl testing.
  const cronHeader = req.headers.get("x-vercel-cron");
  if (process.env.VERCEL && !cronHeader) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runTick();
}

// Manual trigger from the dashboard — must be signed-in (Supabase cookie
// auth is enforced by the existing middleware on /api/*).
export async function POST() {
  return runTick();
}

async function runTick() {
  try {
    const res = await processNextInline(5);
    console.log("[/api/retry-pending] tick:", res);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[/api/retry-pending] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
