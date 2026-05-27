"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeCalls } from "@/lib/realtime-context";
import type { Call } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/status-badge";
import { SentimentDot } from "@/components/sentiment-dot";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { formatFaDate, resolvedLabel, t } from "@/lib/strings";
import { cancelCall, deleteCall } from "@/lib/actions";
import { kickWorker } from "@/app/dashboard/upload/actions";
import { QueueInfo, medianProcessingSeconds } from "@/components/queue-info";
import { FadeIn } from "@/components/motion";

export function CallDetail({ initial, audioUrl }: { initial: Call; audioUrl: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [call, setCall] = useState<Call>(initial);
  // Other in-flight + recently-done calls, used by QueueInfo for position + median ETA.
  const [queueCalls, setQueueCalls] = useState<Call[]>([initial]);

  // Safety net: if the user lands here while the call is still pending,
  // kick the worker. Idempotent — no-op if the worker is already running.
  useEffect(() => {
    if (initial.status === "pending") {
      kickWorker();
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [reprocessing, startReprocess] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const [deleting, startDelete] = useTransition();

  // One-shot fetch of queue context (pending + processing + recent done) so
  // QueueInfo can compute position + median ETA. Realtime updates below keep
  // it fresh — no per-page channel needed.
  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("calls")
        .select("*")
        .or("status.eq.pending,status.eq.analyzing,status.eq.transcribing,status.eq.done")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled && data) setQueueCalls(data as Call[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime updates via the shared dashboard channel. Updates this call AND
  // keeps the queueCalls list in sync so position/ETA stay accurate.
  useRealtimeCalls({
    onInsert: (row) => {
      setQueueCalls((prev) => prev.some((c) => c.id === row.id) ? prev : [row, ...prev]);
    },
    onUpdate: (row) => {
      if (row.id === call.id) setCall((prev) => ({ ...prev, ...row }));
      setQueueCalls((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
    },
    onDelete: (row) => {
      setQueueCalls((prev) => prev.filter((c) => c.id !== row.id));
    },
  });

  const medianSec = medianProcessingSeconds(queueCalls);
  // Make sure THIS call is in queueCalls so position math works even before refresh lands.
  const mergedQueue = queueCalls.some((c) => c.id === call.id)
    ? queueCalls.map((c) => (c.id === call.id ? call : c))
    : [...queueCalls, call];

  function reprocess() {
    startReprocess(async () => {
      const res = await fetch(`/api/process/${call.id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.show(body.error || "خطا در تحلیل مجدد", "error");
      } else {
        toast.show("تحلیل مجدد آغاز شد", "info");
      }
    });
  }

  function handleCancel() {
    startCancel(async () => {
      const res = await cancelCall(call.id);
      if (res.error) toast.show(res.error, "error");
      else toast.show("تماس لغو شد", "info");
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: t.confirmDelete,
      message: "این عمل غیرقابل بازگشت است. فایل صوتی و تمام داده‌های تحلیل‌شده پاک می‌شود.",
      confirmLabel: t.delete,
      cancelLabel: "انصراف",
      kind: "danger",
    });
    if (!ok) return;
    startDelete(async () => {
      const res = await deleteCall(call.id);
      if (res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("تماس حذف شد", "success");
      router.push("/dashboard");
    });
  }

  const isProcessing = call.status === "pending" || call.status === "transcribing" || call.status === "analyzing";

  return (
    <FadeIn className="space-y-5">
      {/* Header */}
      <div className="panel p-4 md:p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold">{t.callDetail}</h1>
            <div className="text-xs md:text-sm text-muted mt-1 fa-nums">
              {formatFaDate(call.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={call.status} />
            {isProcessing && (
              <button onClick={handleCancel} disabled={cancelling} className="btn text-sm">
                {cancelling ? t.cancelling : t.cancel}
              </button>
            )}
            {(call.status === "done" || call.status === "failed") && (
              <button
                onClick={reprocess}
                disabled={reprocessing}
                className={"btn text-sm " + (call.status === "failed" ? "btn-primary" : "")}
              >
                {reprocessing ? t.reprocessing : t.reprocess}
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger text-sm">
              {deleting ? t.deleting : t.delete}
            </button>
          </div>
        </div>

        {call.status === "failed" && call.error_message && (
          <div className="mt-4 text-sm bg-red-50 border border-red-200 text-red-900 rounded-lg px-3 py-2.5">
            <div className="font-semibold mb-0.5">{t.errorOccurred}</div>
            <div className="text-xs text-red-800/90 break-words">{call.error_message}</div>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 space-y-3">
            {call.status !== "pending" && (
              <>
                <div className="h-1 w-full bg-surface2 rounded overflow-hidden">
                  <div className="h-full w-1/2 bg-fg animate-pulse" />
                </div>
                <div className="text-xs text-muted">
                  <DetailPhaseLabel call={call} />
                </div>
              </>
            )}
            <QueueInfo call={call} allCalls={mergedQueue} medianSec={medianSec} variant="full" />
          </div>
        )}
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="panel p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 text-xs text-muted">
            <span>{t.audio}</span>
            {call.audio_duration_sec != null && (
              <span className="fa-nums">
                {Math.floor(call.audio_duration_sec / 60).toLocaleString("fa-IR")}:
                {String(call.audio_duration_sec % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      {/* Two columns: extracted + transcript */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Extracted */}
        <div className="lg:col-span-2 panel p-4 md:p-5 self-start lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold text-muted mb-4">{t.extracted}</h2>
          <dl className="space-y-3 text-sm">
            <Field label={t.callerName} value={call.caller_name} />
            <Field label={t.callerPhone} value={call.caller_phone} dir="ltr" mono />
            <Field label={t.agentName} value={call.agent_name} />

            <div>
              <dt className="text-xs text-muted mb-1">{t.issueSummary}</dt>
              <dd className="bg-surface2 border border-border rounded-lg p-3 leading-7 text-fg">
                {call.issue_summary || <span className="text-muted">{t.unknown}</span>}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted mb-1">{t.thCategory}</dt>
                <dd>{call.category ? <span className="badge badge-info">{call.category}</span> : <span className="text-muted">—</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted mb-1">{t.thResolved}</dt>
                <dd>
                  {call.resolved === true && <span className="badge badge-success">{resolvedLabel(true)}</span>}
                  {call.resolved === false && <span className="badge badge-danger">{resolvedLabel(false)}</span>}
                  {call.resolved == null && <span className="text-muted">—</span>}
                </dd>
              </div>
            </div>

            <Field label={t.agentBehavior} value={call.agent_behavior} />
            <Field label={t.callerBehavior} value={call.caller_behavior} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted mb-1">{t.agentSentiment}</dt>
                <dd><SentimentDot value={call.sentiment_agent} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted mb-1">{t.callerSentiment}</dt>
                <dd><SentimentDot value={call.sentiment_caller} /></dd>
              </div>
            </div>

            <div>
              <dt className="text-xs text-muted mb-1">{t.followUp}</dt>
              <dd>
                {call.follow_up_needed === true && <span className="badge badge-warn">{t.yes}</span>}
                {call.follow_up_needed === false && <span className="badge badge-muted">{t.no}</span>}
                {call.follow_up_needed == null && <span className="text-muted">—</span>}
              </dd>
            </div>

            {call.tags && call.tags.length > 0 && (
              <div>
                <dt className="text-xs text-muted mb-1">{t.tags}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {call.tags.map((tag, i) => (
                    <span key={i} className="badge">{tag}</span>
                  ))}
                </dd>
              </div>
            )}

            {call.notes && (
              <div>
                <dt className="text-xs text-muted mb-1">{t.notes}</dt>
                <dd className="bg-surface2 border border-border rounded-lg p-3 leading-7 text-sm">{call.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-3 panel p-4 md:p-5">
          <h2 className="text-sm font-semibold text-muted mb-4">{t.transcript}</h2>
          {call.transcript ? (
            <div className="max-h-[70vh] overflow-y-auto leading-8 whitespace-pre-wrap text-sm pe-2">
              {call.transcript}
            </div>
          ) : isProcessing ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-10/12" />
              <div className="skeleton h-4 w-9/12" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-8/12" />
            </div>
          ) : (
            <div className="text-muted text-sm">{t.unknown}</div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

function Field({
  label, value, dir, mono,
}: {
  label: string; value: string | null; dir?: "ltr" | "rtl"; mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted mb-1">{label}</dt>
      <dd dir={dir} className={mono ? "fa-nums" : ""}>
        {value || <span className="text-muted">{t.unknown}</span>}
      </dd>
    </div>
  );
}

// Phase hint derived from elapsed time since processing_started_at.
// 0–3s: downloading the audio. 3s+: analyzing with AI. (Heuristic; we don't
// have a real phase column on the row.)
function DetailPhaseLabel({ call }: { call: Call }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const started = call.processing_started_at
    ? new Date(call.processing_started_at).getTime()
    : now;
  const elapsedSec = Math.max(0, (now - started) / 1000);
  const label = elapsedSec < 3 ? t.phaseDownloading : t.phaseAnalyzing;
  return <span>{label}</span>;
}
