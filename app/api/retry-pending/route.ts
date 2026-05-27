import { NextResponse } from "next/server";
import { claimAndProcessNext } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cron-driven retry. Runs every 10 minutes (see vercel.json). If there is
// any pending row — including ones the worker paused on after a Gemini 503 —
// this kicks the serial worker. If the claim succeeds, the worker chains
// through the rest naturally; if Gemini is still overloaded, the row goes
// back to pending and we wait for the next cron tick.
export async function GET(req: Request) {
  // Vercel cron requests carry this header; reject anything else in prod so
  // the endpoint can't be abused. In dev there's no header — allow it.
  const cronHeader = req.headers.get("x-vercel-cron");
  if (process.env.VERCEL && !cronHeader) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await claimAndProcessNext();
    console.log("[/api/retry-pending] tick:", res);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[/api/retry-pending] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
