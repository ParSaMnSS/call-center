"use client";

import { useEffect, useState } from "react";
import { useRealtimeStatus } from "@/lib/realtime-context";
import { formatFaDuration, t } from "@/lib/strings";

// Tiny dot + label at the sidebar footer. Hovering / focusing shows the
// last-sync time. The dot color reflects the realtime channel status.
export function ConnectionIndicator() {
  const { status, lastSyncAt } = useRealtimeStatus();
  const [, force] = useState(0);

  // Re-render every 5s so the "X seconds ago" stays fresh.
  useEffect(() => {
    if (!lastSyncAt) return;
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [lastSyncAt]);

  const label =
    status === "connected" ? t.connectionLive :
    status === "connecting" ? t.connectionReconnecting :
    t.connectionLost;

  const dot =
    status === "connected" ? "bg-green-500" :
    status === "connecting" ? "bg-zinc-400" :
    "bg-red-500";

  const ringTone =
    status === "connected" ? "bg-green-400" :
    status === "connecting" ? "bg-zinc-300" :
    "bg-red-400";

  const tone =
    status === "connected" ? "text-fg" :
    status === "connecting" ? "text-muted" :
    "text-red-700";

  const lastSyncLabel = lastSyncAt
    ? secondsAgo(lastSyncAt) < 5
      ? t.justNow
      : t.lastSync(formatFaDuration(secondsAgo(lastSyncAt)))
    : null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md" title={lastSyncLabel ?? undefined}>
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {status !== "connected" && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ringTone} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className={"text-xs font-medium " + tone}>{label}</span>
    </div>
  );
}

function secondsAgo(ms: number): number {
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}
