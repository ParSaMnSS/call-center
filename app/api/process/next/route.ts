import { NextResponse } from "next/server";
import { claimAndProcessNext } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Thin wrapper around claimAndProcessNext for external HTTP triggers
// (e.g. browser console debugging). The actual logic lives in lib/process.ts
// so the upload action can call it directly without a self-fetch.
export async function POST() {
  console.log("[/api/process/next] POST received");
  try {
    const res = await claimAndProcessNext();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
