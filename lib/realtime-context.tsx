"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Call } from "@/lib/supabase/types";
import { useToast } from "@/components/toast";
import { t } from "@/lib/strings";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

type CallHandlers = {
  onInsert?: (row: Call) => void;
  onUpdate?: (row: Call, prev?: Call) => void;
  onDelete?: (row: { id: string }) => void;
};

type Ctx = {
  status: RealtimeStatus;
  lastSyncAt: number | null;
  subscribe: (handlers: CallHandlers) => () => void;
};

const RealtimeContext = createContext<Ctx | null>(null);

// One shared Supabase channel for the whole dashboard. Owns the connection
// status, broadcasts row deltas to any number of subscribers, and emits
// toasts for:
//   - connection loss / restoration
//   - calls finishing analysis (status: analyzing → done)
//   - calls failing permanently (any → failed)
//   - AI recovery (an inline retry succeeds after pending+error_message)
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const handlersRef = useRef<Set<CallHandlers>>(new Set());
  const prevCallsRef = useRef<Map<string, Call>>(new Map());
  const aiBusyRef = useRef(false);
  // Track whether we've ever connected so the very first "connected"
  // toast doesn't fire on initial mount.
  const everConnectedRef = useRef(false);

  const subscribe = useCallback((handlers: CallHandlers) => {
    handlersRef.current.add(handlers);
    return () => {
      handlersRef.current.delete(handlers);
    };
  }, []);

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    // The `calls` SELECT policy is scoped `to authenticated`. Supabase Realtime
    // enforces RLS per-socket, so postgres_changes are silently dropped unless
    // the socket carries the user's JWT. Set it BEFORE subscribing, and keep it
    // fresh on token refresh — otherwise the channel reports SUBSCRIBED but no
    // row deltas ever arrive.
    const { data: authSub } = sb.auth.onAuthStateChange((_e, session) => {
      sb.realtime.setAuth(session?.access_token ?? null);
    });

    async function init() {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      sb.realtime.setAuth(data.session?.access_token ?? null);

      channel = sb
      .channel("calls-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        (payload) => {
          setLastSyncAt(Date.now());
          const handlers = Array.from(handlersRef.current);
          if (payload.eventType === "INSERT") {
            const row = payload.new as Call;
            prevCallsRef.current.set(row.id, row);
            for (const h of handlers) h.onInsert?.(row);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Call;
            const prev = prevCallsRef.current.get(row.id);
            prevCallsRef.current.set(row.id, row);
            for (const h of handlers) h.onUpdate?.(row, prev);
            emitStatusToast(row, prev);
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            prevCallsRef.current.delete(old.id);
            for (const h of handlers) h.onDelete?.(old);
          }
        }
      )
      .subscribe((s) => {
        // Supabase emits: "SUBSCRIBED", "TIMED_OUT", "CLOSED", "CHANNEL_ERROR"
        if (s === "SUBSCRIBED") {
          setStatus("connected");
          setLastSyncAt(Date.now());
          if (everConnectedRef.current) {
            toast.show(t.connectionRestoredToast, "success");
          }
          everConnectedRef.current = true;
        } else if (s === "CLOSED" || s === "TIMED_OUT" || s === "CHANNEL_ERROR") {
          setStatus((prev) => {
            // Only emit the toast the first time we transition away from connected.
            if (prev === "connected") {
              toast.show(t.connectionLostToast, "error");
            }
            return "disconnected";
          });
        }
      });

    // Helper: notice status transitions on UPDATE deltas.
    function emitStatusToast(row: Call, prev: Call | undefined) {
      const prevStatus = prev?.status;
      if (prevStatus === row.status) {
        // Status didn't change. But watch for AI-busy recovery:
        // pending + error_message  →  pending + no error_message
        if (row.status === "pending" && prev?.error_message && !row.error_message) {
          if (aiBusyRef.current) {
            toast.show(t.notifyAIRecovered, "success");
            aiBusyRef.current = false;
          }
        }
        return;
      }
      const name = row.caller_name || row.caller_phone || "";

      if (row.status === "done" && (prevStatus === "analyzing" || prevStatus === "transcribing")) {
        toast.show(t.notifyCallDone(name), "success");
      } else if (row.status === "failed") {
        toast.show(t.notifyCallFailed(name), "error");
      } else if (row.status === "pending" && prev?.error_message) {
        // Transient AI failure put it back in queue
        aiBusyRef.current = true;
      } else if (row.status === "analyzing" && aiBusyRef.current) {
        // Picked up again after busy
        toast.show(t.notifyAIRecovered, "success");
        aiBusyRef.current = false;
      }
    }
    }

    init();

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) sb.removeChannel(channel);
    };
    // toast.show is stable from context, ignore dep warning safely
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Ctx>(() => ({ status, lastSyncAt, subscribe }), [status, lastSyncAt, subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): { status: RealtimeStatus; lastSyncAt: number | null } {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtimeStatus must be used inside <RealtimeProvider>");
  return { status: ctx.status, lastSyncAt: ctx.lastSyncAt };
}

export function useRealtimeCalls(handlers: CallHandlers) {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtimeCalls must be used inside <RealtimeProvider>");
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Subscribe ONCE on mount. Depending on `ctx` here is a bug: ctx.value
  // changes every time lastSyncAt updates (i.e. on every realtime event), so
  // a [ctx] dep would tear down + rebuild the subscription on every event,
  // potentially dropping intermediate updates. The subscribe function itself
  // is stable, so a one-shot subscribe via ref capture is safe.
  const subscribeRef = useRef(ctx.subscribe);
  subscribeRef.current = ctx.subscribe;

  useEffect(() => {
    return subscribeRef.current({
      onInsert: (row) => handlersRef.current.onInsert?.(row),
      onUpdate: (row, prev) => handlersRef.current.onUpdate?.(row, prev),
      onDelete: (row) => handlersRef.current.onDelete?.(row),
    });
  }, []);
}
