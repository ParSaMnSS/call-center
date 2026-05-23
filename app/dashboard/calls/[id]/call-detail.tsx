"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Call } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/status-badge";
import { SentimentDot } from "@/components/sentiment-dot";
import { formatFaDate, resolvedLabel, t } from "@/lib/strings";

export function CallDetail({ initial, audioUrl }: { initial: Call; audioUrl: string | null }) {
  const [call, setCall] = useState<Call>(initial);
  const [reprocessing, startReprocess] = useTransition();

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`call-${call.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${call.id}` },
        (payload) => {
          setCall((prev) => ({ ...prev, ...(payload.new as Call) }));
        }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [call.id]);

  function reprocess() {
    startReprocess(async () => {
      await fetch(`/api/process/${call.id}`, { method: "POST" });
    });
  }

  const isProcessing = call.status === "pending" || call.status === "transcribing" || call.status === "analyzing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="panel p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">{t.callDetail}</h1>
            <div className="text-sm text-muted mt-1 fa-nums">
              {formatFaDate(call.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={call.status} />
            {call.status === "done" && (
              <button onClick={reprocess} disabled={reprocessing} className="btn text-sm">
                {reprocessing ? t.reprocessing : t.reprocess}
              </button>
            )}
            {call.status === "failed" && (
              <button onClick={reprocess} disabled={reprocessing} className="btn btn-primary text-sm">
                {reprocessing ? t.reprocessing : t.reprocess}
              </button>
            )}
          </div>
        </div>

        {call.status === "failed" && call.error_message && (
          <div className="mt-4 text-sm bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2">
            <div className="font-semibold mb-0.5">{t.errorOccurred}</div>
            <div className="text-xs opacity-90">{call.error_message}</div>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4">
            <div className="h-1 w-full bg-panel2 rounded overflow-hidden">
              <div className="h-full w-1/2 bg-gradient-to-r from-accent to-accent2 animate-pulse" />
            </div>
            <div className="text-xs text-muted mt-2">
              این فرایند ممکن است چند دقیقه طول بکشد. می‌توانید این صفحه را باز نگه دارید — به‌روزرسانی به‌صورت زنده انجام می‌شود.
            </div>
          </div>
        )}
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="panel p-5">
          <div className="text-sm text-muted mb-3">{t.audio}</div>
          <audio controls src={audioUrl} className="w-full" />
          {call.audio_duration_sec && (
            <div className="text-xs text-muted mt-2 fa-nums">
              مدت: {Math.floor(call.audio_duration_sec / 60).toLocaleString("fa-IR")}:{String(call.audio_duration_sec % 60).padStart(2, "0")}
            </div>
          )}
        </div>
      )}

      {/* Two columns: extracted + transcript */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Extracted */}
        <div className="lg:col-span-2 panel p-5">
          <h2 className="text-sm font-semibold text-muted mb-4">{t.extracted}</h2>
          <dl className="space-y-3 text-sm">
            <Field label={t.callerName} value={call.caller_name} />
            <Field label={t.callerPhone} value={call.caller_phone} dir="ltr" mono />
            <Field label={t.agentName} value={call.agent_name} />

            <div>
              <dt className="text-xs text-muted mb-1">{t.issueSummary}</dt>
              <dd className="bg-panel2/60 rounded-lg p-3 leading-7">
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
                <dd className="bg-panel2/60 rounded-lg p-3 leading-7 text-sm">{call.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-3 panel p-5">
          <h2 className="text-sm font-semibold text-muted mb-4">{t.transcript}</h2>
          {call.transcript ? (
            <div className="max-h-[70vh] overflow-y-auto leading-8 whitespace-pre-wrap text-sm">
              {call.transcript}
            </div>
          ) : isProcessing ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-10/12" />
              <div className="skeleton h-4 w-9/12" />
              <div className="skeleton h-4 w-full" />
            </div>
          ) : (
            <div className="text-muted text-sm">{t.unknown}</div>
          )}
        </div>
      </div>
    </div>
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
