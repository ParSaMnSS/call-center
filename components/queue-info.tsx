"use client";

import { useEffect, useState } from "react";
import type { Call } from "@/lib/supabase/types";
import { formatFaDuration, t } from "@/lib/strings";

// ----- ETA helpers -----

// Median of an array of positive numbers; returns null for empty arrays.
function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Collect recent processing durations from finished calls. Caps at the
// 20 most-recent, ignores outliers > 600s (likely stuck/timed-out runs).
export function medianProcessingSeconds(calls: Call[]): number | null {
  const recent = calls
    .filter((c) => c.status === "done" && typeof c.processing_seconds === "number" && c.processing_seconds! > 0 && c.processing_seconds! < 600)
    .slice(0, 20)
    .map((c) => c.processing_seconds!) as number[];
  return median(recent);
}

// Queue context for a single call:
//   position: 1-indexed slot in the queue (1 = currently processing or next)
//   total:    total pending+processing in flight
//   leadSeconds: seconds of work ahead of this call before it can start
export function queueContext(call: Call, allCalls: Call[], medianSec: number | null): {
  position: number;
  total: number;
  leadSeconds: number;
} {
  // The queue is every call that's pending OR currently being processed,
  // sorted by created_at ascending (matches what the claim RPC does).
  const queue = allCalls
    .filter((c) => c.status === "pending" || c.status === "analyzing" || c.status === "transcribing")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const idx = queue.findIndex((c) => c.id === call.id);
  const position = idx === -1 ? 1 : idx + 1;
  const total = queue.length;

  // Lead time: sum of "still to do" for every call ahead of this one.
  let leadSeconds = 0;
  for (let i = 0; i < idx; i++) {
    const ahead = queue[i];
    if (medianSec === null) break;
    if (ahead.status === "analyzing" || ahead.status === "transcribing") {
      // Already running — subtract elapsed from median guess; floor at 0.
      const started = ahead.processing_started_at ? new Date(ahead.processing_started_at).getTime() : Date.now();
      const elapsed = Math.max(0, (Date.now() - started) / 1000);
      leadSeconds += Math.max(0, medianSec - elapsed);
    } else {
      leadSeconds += medianSec;
    }
  }
  return { position, total, leadSeconds };
}

// ----- Live tick hook -----

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ----- Public components -----

type Props = {
  call: Call;
  allCalls: Call[];
  medianSec: number | null;
  // Compact mode: one short line, used in table rows.
  // Full mode: multi-line block, used on the detail page.
  variant?: "compact" | "full";
};

export function QueueInfo({ call, allCalls, medianSec, variant = "compact" }: Props) {
  const now = useNow();
  const isPending = call.status === "pending";
  const isProcessing = call.status === "analyzing" || call.status === "transcribing";

  if (!isPending && !isProcessing) return null;

  const { position, total, leadSeconds } = queueContext(call, allCalls, medianSec);

  // Elapsed for the currently-running call
  let elapsedSec = 0;
  if (isProcessing && call.processing_started_at) {
    elapsedSec = Math.max(0, (now - new Date(call.processing_started_at).getTime()) / 1000);
  }

  // ETA. For a running call: median - elapsed (floored at 5s so we don't show 0).
  // For a pending call: lead time (sum of work ahead).
  let etaSec: number | null = null;
  if (medianSec !== null) {
    if (isProcessing) {
      etaSec = Math.max(5, medianSec - elapsedSec);
    } else {
      etaSec = Math.max(5, leadSeconds);
    }
  }

  if (variant === "compact") {
    return (
      <div className="text-[11px] text-muted fa-nums leading-tight">
        {isProcessing && (
          <div>{t.elapsed}: <span className="text-text">{formatFaDuration(elapsedSec)}</span></div>
        )}
        {isPending && total > 1 && (
          <div>{t.queuePosition(position, total)}</div>
        )}
        {etaSec !== null && (
          <div>{t.eta}: ~{formatFaDuration(etaSec)}</div>
        )}
      </div>
    );
  }

  // Full variant — used on the detail page progress card.
  return (
    <div className="space-y-2 text-sm fa-nums">
      <div className="flex items-center justify-between">
        <span className="text-muted text-xs">
          {isProcessing ? t.processingHint : t.queuedHint}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t.elapsed} value={isProcessing ? formatFaDuration(elapsedSec) : "—"} />
        <Stat
          label={t.queuePosition(position, total).split(" در صف")[0] + " در صف"}
          value=""
          inline={t.queuePosition(position, total)}
        />
        <Stat
          label={t.eta}
          value={etaSec !== null ? `~${formatFaDuration(etaSec)}` : t.etaUnknown}
          hint={medianSec !== null ? t.basedOnRecent : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, inline, hint }: { label: string; value: string; inline?: string; hint?: string }) {
  return (
    <div className="bg-panel2/50 rounded-lg p-2.5">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{inline || value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
