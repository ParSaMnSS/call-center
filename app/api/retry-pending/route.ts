import { NextResponse } from "next/server";
import { processNextInline } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cron-driven retry. Runs every minute (see vercel.json) AND can be hit
// manually from the dashboard "Retry now" button or the client-side polling
// in AIBusyBanner. Processes inline (not via after()) so the work actually
// completes within this invocation — after() callbacks can be cut short when
// the function instance shuts down, which would silently swallow retries.
//
// Chains up to 5 rows per tick so we don't sit on a long queue.
//
// Auth: GET requests from Vercel cron carry one of these markers:
//   - Authorization: Bearer ${CRON_SECRET}   (current — set CRON_SECRET in env)
//   - x-vercel-cron header                   (legacy)
//   - User-Agent containing "vercel-cron"    (current — set automatically)
// POST is always allowed (used by the dashboard's client-side timer and the
// Retry-now button — the dashboard is behind Supabase auth already).
export async function GET(req: Request) {
  if (process.env.VERCEL && !isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runTick();
}

export async function POST() {
  return runTick();
}

function isAuthorizedCron(req: Request): boolean {
  // Legacy header
  if (req.headers.get("x-vercel-cron") != null) return true;
  // Bearer token (CRON_SECRET-based)
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${expected}`) return true;
  }
  // Vercel cron User-Agent (final fallback). Vercel sets a recognizable UA
  // for cron invocations even without CRON_SECRET configured.
  const ua = req.headers.get("user-agent") || "";
  if (/vercel-cron/i.test(ua)) return true;
  return false;
}

async function runTick() {
  const t = Date.now();
  try {
    const res = await processNextInline(5);
    console.log("[/api/retry-pending] tick:", res);
    return NextResponse.json({ ok: true, ...res, t });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[/api/retry-pending] failed:", message);
    return NextResponse.json({ error: message, t }, { status: 500 });
  }
}
