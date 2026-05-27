"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRealtimeCalls } from "@/lib/realtime-context";
import type { Call, Sentiment } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/status-badge";
import { SentimentDot } from "@/components/sentiment-dot";
import { formatFaDate, resolvedLabel, t } from "@/lib/strings";
import { cancelAllProcessing, deleteCall, retryAllFailed } from "@/lib/actions";
import { kickWorker } from "@/app/dashboard/upload/actions";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { QueueInfo, medianProcessingSeconds } from "@/components/queue-info";
import { formatFaDuration } from "@/lib/strings";
import { FadeIn, motion } from "@/components/motion";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { DateField } from "@/components/date-field";
import { AnimatePresence } from "framer-motion";
import { Trash2, Loader2, Play, StopCircle, AlertTriangle, Mic, Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";

type ResolvedFilter = "all" | "yes" | "no";
type SentimentFilter = "all" | Sentiment;

export function CallsView({ initial }: { initial: Call[] }) {
  const [calls, setCalls] = useState<Call[]>(initial);

  // Filter state
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [resolvedF, setResolvedF] = useState<ResolvedFilter>("all");
  const [sentF, setSentF] = useState<SentimentFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Auto-kick the serial worker if there's anything pending — handles the
  // case where the user closes the upload page before the worker fires,
  // or a previous deploy left pending rows orphaned.
  useEffect(() => {
    const hasPending = calls.some((c) => c.status === "pending");
    if (hasPending) kickWorker();
    // Only run once on mount; the worker chains itself after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime updates via the shared dashboard channel.
  useRealtimeCalls({
    onInsert: (row) => {
      setCalls((prev) => prev.some((c) => c.id === row.id) ? prev : [row, ...prev]);
    },
    onUpdate: (row) => {
      setCalls((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
    },
    onDelete: (row) => {
      setCalls((prev) => prev.filter((c) => c.id !== row.id));
    },
  });

  const agents = useMemo(() => {
    const s = new Set<string>();
    for (const c of calls) if (c.agent_name) s.add(c.agent_name);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fa"));
  }, [calls]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const c of calls) if (c.category) s.add(c.category);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fa"));
  }, [calls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromDt = from ? new Date(from + "T00:00:00") : null;
    const toDt = to ? new Date(to + "T23:59:59") : null;

    return calls.filter((c) => {
      if (agent && c.agent_name !== agent) return false;
      if (category && c.category !== category) return false;
      if (resolvedF === "yes" && c.resolved !== true) return false;
      if (resolvedF === "no" && c.resolved !== false) return false;
      if (sentF !== "all" && c.sentiment_caller !== sentF && c.sentiment_agent !== sentF) return false;

      const created = new Date(c.created_at);
      if (fromDt && created < fromDt) return false;
      if (toDt && created > toDt) return false;

      if (q) {
        const hay = [
          c.transcript, c.issue_summary, c.caller_name, c.caller_phone,
          c.agent_name, c.notes, c.category, ...(c.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, search, agent, category, resolvedF, sentF, from, to]);

  function clearFilters() {
    setSearch(""); setAgent(""); setCategory("");
    setResolvedF("all"); setSentF("all"); setFrom(""); setTo("");
  }

  const anyFilter = !!(search || agent || category || from || to || resolvedF !== "all" || sentF !== "all");
  const filterCount =
    (agent ? 1 : 0) +
    (category ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (resolvedF !== "all" ? 1 : 0) +
    (sentF !== "all" ? 1 : 0);

  const medianSec = useMemo(() => medianProcessingSeconds(calls), [calls]);

  const failedCount = useMemo(() => calls.filter((c) => c.status === "failed").length, [calls]);
  const processingCount = useMemo(
    () => calls.filter((c) => c.status === "pending" || c.status === "analyzing" || c.status === "transcribing").length,
    [calls],
  );
  // Heuristic: if any pending row carries an error_message, the AI is busy
  // and the cron is the one driving recovery. Show a calm banner so users
  // know it's expected.
  const aiBusy = useMemo(
    () => calls.some((c) => c.status === "pending" && c.error_message),
    [calls],
  );

  return (
    <FadeIn className="space-y-4">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{t.dashboardTitle}</h1>
          <p className="text-sm text-muted mt-1">{t.dashboardSubtitle}</p>
        </div>
        <Link href="/dashboard/upload" className="btn btn-primary text-sm hidden md:inline-flex">
          + {t.newUpload}
        </Link>
      </div>

      {aiBusy && <AIBusyBanner />}
      {(failedCount > 0 || processingCount > 0) && (
        <BulkActionsBar
          failedCount={failedCount}
          processingCount={processingCount}
        />
      )}

      {/* Search bar */}
      <div className="panel p-2 md:p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              className="input ps-10 pe-3"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 end-2 my-auto w-7 h-7 rounded-md text-muted hover:text-fg hover:bg-surface2 transition-colors inline-flex items-center justify-center"
                aria-label="پاک کردن"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={"btn text-sm whitespace-nowrap " + (showFilters || anyFilter ? "btn-primary" : "")}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t.filters}</span>
            {anyFilter && (
              <span className={
                "ms-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold fa-nums " +
                (showFilters || anyFilter ? "bg-surface text-fg" : "bg-fg text-surface")
              }>
                {filterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="panel p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {t.filters}
                </div>
                {anyFilter && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-muted hover:text-fg transition-colors inline-flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t.clearFilters}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                {/* Date range — own row */}
                <FilterGroup label={t.fromDate}>
                  <DateField value={from} onChange={setFrom} placeholder={t.fromDate} max={to || undefined} />
                </FilterGroup>
                <FilterGroup label={t.toDate}>
                  <DateField value={to} onChange={setTo} placeholder={t.toDate} min={from || undefined} />
                </FilterGroup>

                {/* Agent + category dropdowns */}
                <FilterGroup label={t.agent}>
                  <Select
                    value={agent}
                    onChange={setAgent}
                    placeholder={t.allAgents}
                    options={[
                      { value: "", label: t.allAgents },
                      ...agents.map((a) => ({ value: a, label: a })),
                    ]}
                  />
                </FilterGroup>
                <FilterGroup label={t.category}>
                  <Select
                    value={category}
                    onChange={setCategory}
                    placeholder={t.allCategories}
                    options={[
                      { value: "", label: t.allCategories },
                      ...categories.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </FilterGroup>
              </div>

              {/* Segmented controls — full width with their own row */}
              <div className="mt-5 pt-5 border-t border-border space-y-4">
                <FilterGroup label={t.resolvedFilter} inline>
                  <Segmented<ResolvedFilter>
                    value={resolvedF}
                    onChange={setResolvedF}
                    options={[
                      { value: "all", label: t.allStatuses },
                      { value: "yes", label: t.resolvedOnly },
                      { value: "no", label: t.unresolvedOnly },
                    ]}
                  />
                </FilterGroup>

                <FilterGroup label={t.sentiment} inline>
                  <Segmented<SentimentFilter>
                    value={sentF}
                    onChange={setSentF}
                    options={[
                      { value: "all", label: t.allSentiments },
                      { value: "positive", label: t.positive },
                      { value: "neutral", label: t.neutral },
                      { value: "negative", label: t.negative },
                    ]}
                  />
                </FilterGroup>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState hasFilter={anyFilter} totalCount={calls.length} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t.thDate}</th>
                    <th>{t.thCaller}</th>
                    <th>{t.thAgent}</th>
                    <th>{t.thIssue}</th>
                    <th>{t.thCategory}</th>
                    <th>{t.thResolved}</th>
                    <th>{t.thSentiment}</th>
                    <th>{t.thStatus}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CallRow
                      key={c.id}
                      call={c}
                      allCalls={calls}
                      medianSec={medianSec}
                      onDeleted={(id) => setCalls((prev) => prev.filter((x) => x.id !== id))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <CallCard
                key={c.id}
                call={c}
                allCalls={calls}
                medianSec={medianSec}
                onDeleted={(id) => setCalls((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </>
      )}

      <div className="text-xs text-muted text-center fa-nums pt-2">
        نمایش {filtered.length.toLocaleString("fa-IR")} از {calls.length.toLocaleString("fa-IR")} تماس
      </div>
    </FadeIn>
  );
}

function EmptyState({ hasFilter, totalCount }: { hasFilter: boolean; totalCount: number }) {
  if (hasFilter) {
    return (
      <div className="panel p-12 text-center text-muted">
        <Search className="w-8 h-8 mx-auto mb-3 text-subtle" />
        <div className="text-fg font-medium">{t.noCalls}</div>
        <div className="text-xs mt-1">با این فیلترها نتیجه‌ای پیدا نشد.</div>
      </div>
    );
  }
  if (totalCount === 0) {
    return (
      <div className="panel p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-surface2 flex items-center justify-center mb-4">
          <Mic className="w-6 h-6 text-muted" />
        </div>
        <div className="font-semibold text-fg mb-1">هنوز تماسی بارگذاری نشده است</div>
        <div className="text-sm text-muted mb-5">برای شروع، اولین فایل صوتی را بارگذاری کنید.</div>
        <Link href="/dashboard/upload" className="btn btn-primary inline-flex">
          + {t.newUpload}
        </Link>
      </div>
    );
  }
  return <div className="panel p-12 text-center text-muted">{t.noCalls}</div>;
}

function DeleteButton({ id, onDeleted, size = "sm" }: { id: string; onDeleted: (id: string) => void; size?: "sm" | "md" }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirm({
      title: t.confirmDelete,
      message: "این عمل غیرقابل بازگشت است. فایل صوتی و تمام داده‌های تحلیل‌شده پاک می‌شود.",
      confirmLabel: t.delete,
      cancelLabel: "انصراف",
      kind: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCall(id);
      if (res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("تماس حذف شد", "success");
      onDeleted(id);
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={t.delete}
      aria-label={t.delete}
      className={
        "btn btn-ghost text-danger hover:bg-danger/10 inline-flex items-center justify-center " +
        (size === "sm" ? "px-2 py-1.5" : "px-2.5 py-1.5")
      }
    >
      {pending
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Trash2 className="w-4 h-4" />}
    </button>
  );
}

function CallRow({
  call: c, allCalls, medianSec, onDeleted,
}: {
  call: Call;
  allCalls: Call[];
  medianSec: number | null;
  onDeleted: (id: string) => void;
}) {
  const showQueue = c.status === "pending" || c.status === "analyzing" || c.status === "transcribing";
  const isFailed = c.status === "failed";
  return (
    <tr>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block fa-nums text-xs text-muted">
          {formatFaDate(c.created_at)}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <div className="text-sm">{c.caller_name || <span className="text-muted">{t.unknown}</span>}</div>
          {c.caller_phone && (
            <div className="text-xs text-muted fa-nums mt-0.5" dir="ltr">{c.caller_phone}</div>
          )}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block text-sm">
          {c.agent_name || <span className="text-muted">{t.unknown}</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <div className="text-sm line-clamp-2 max-w-[420px] leading-6">
            {c.issue_summary || (c.status !== "done" ? <span className="text-muted">…</span> : <span className="text-muted">{t.unknown}</span>)}
          </div>
          {isFailed && c.error_message && (
            <div className="text-xs text-red-700 mt-1 line-clamp-2 max-w-[420px]" title={c.error_message}>
              {c.error_message}
            </div>
          )}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          {c.category ? <span className="badge badge-info">{c.category}</span> : <span className="text-muted text-xs">—</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          {c.resolved === true && <span className="badge badge-success">{resolvedLabel(true)}</span>}
          {c.resolved === false && <span className="badge badge-danger">{resolvedLabel(false)}</span>}
          {c.resolved == null && <span className="text-muted text-xs">—</span>}
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block">
          <SentimentDot value={c.sentiment_caller} label={t.thCaller} />
        </Link>
      </td>
      <td>
        <Link href={`/dashboard/calls/${c.id}`} className="block space-y-1">
          <StatusBadge status={c.status} />
          {showQueue && (
            <QueueInfo call={c} allCalls={allCalls} medianSec={medianSec} variant="compact" />
          )}
          {c.status === "analyzing" && (
            <div className="text-[11px] text-muted leading-tight">
              <ProcessingPhaseLabel call={c} />
            </div>
          )}
        </Link>
      </td>
      <td className="text-left whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          {isFailed && <InlineRetryButton id={c.id} />}
          <DeleteButton id={c.id} onDeleted={onDeleted} />
        </div>
      </td>
    </tr>
  );
}

// Quick-retry icon button for failed rows. Hits the existing
// /api/process/[id] endpoint that the detail page already uses.
function InlineRetryButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/process/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.show(body.error || "خطا در تلاش مجدد", "error");
      } else {
        toast.show("تحلیل مجدد آغاز شد", "info");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={t.inlineRetry}
      aria-label={t.inlineRetry}
      className="btn btn-ghost text-muted hover:text-fg inline-flex items-center justify-center px-2 py-1.5"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
    </button>
  );
}

// Heuristic phase label derived from processing_started_at. 0-3s = downloading
// audio, 3s+ = sending/awaiting AI, last 2s (if median known) = finalizing.
function ProcessingPhaseLabel({ call }: { call: Call }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const started = call.processing_started_at ? new Date(call.processing_started_at).getTime() : now;
  const elapsedSec = Math.max(0, (now - started) / 1000);

  const label =
    elapsedSec < 3 ? t.phaseDownloading :
    t.phaseAnalyzing;

  return <span>{label}</span>;
}

// Cron runs every minute on the wall clock (`* * * * *`), so the next retry
// fires at the next :00 second of the next minute.
function secondsUntilNextCron(now = new Date()): number {
  return 60 - now.getSeconds();
}

function AIBusyBanner() {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntilNextCron());
  const [manualRetrying, setManualRetrying] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntilNextCron());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const retryingNow = manualRetrying || secondsLeft <= 5;

  async function handleRetryNow() {
    if (manualRetrying) return;
    setManualRetrying(true);
    try {
      const res = await fetch("/api/retry-pending", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(body.error || "خطا در تلاش مجدد", "error");
      } else if (body.processed > 0) {
        toast.show("تحلیل از سر گرفته شد", "success");
      } else if (body.transientStopped) {
        toast.show("سرویس هنوز در دسترس نیست — به‌زودی دوباره تلاش می‌شود", "info");
      } else {
        toast.show("تماس قابل پردازشی پیدا نشد", "info");
      }
    } finally {
      setManualRetrying(false);
    }
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5 flex items-start gap-3 md:gap-4"
    >
      <div className="shrink-0 h-10 w-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-base md:text-lg text-amber-900">
          {t.aiBusyTitle}
        </div>
        <div className="text-sm text-amber-900/80 mt-1 leading-7">
          {t.aiBusyBody}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-lg bg-surface border border-amber-200 px-3 py-1.5">
            {retryingNow ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-700 animate-spin" />
                <span className="text-sm font-semibold text-amber-900">{t.aiBusyRetryingNow}</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600" />
                </span>
                <span className="text-sm font-semibold text-amber-900 fa-nums">
                  {t.aiBusyNextRetry(formatFaDuration(secondsLeft))}
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleRetryNow}
            disabled={manualRetrying}
            className="btn text-sm border-amber-300 bg-surface text-amber-900 hover:bg-amber-50 hover:border-amber-400"
          >
            {manualRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t.aiBusyRetryNow}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function FilterGroup({
  label, inline, children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="text-xs font-medium text-muted">{label}</label>
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs font-medium text-muted mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function BulkActionsBar({
  failedCount, processingCount,
}: {
  failedCount: number;
  processingCount: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [retrying, startRetry] = useTransition();
  const [stopping, startStop] = useTransition();

  async function handleRetryAll() {
    const ok = await confirm({
      title: t.confirmRetryAll,
      message: t.confirmRetryAllMsg,
      confirmLabel: t.retryAllFailed(failedCount),
      cancelLabel: "انصراف",
    });
    if (!ok) return;
    startRetry(async () => {
      const res = await retryAllFailed();
      if (res.error) toast.show(res.error, "error");
      else toast.show(t.bulkRetried(res.count), "success");
    });
  }

  async function handleStopAll() {
    const ok = await confirm({
      title: t.confirmStopAll,
      message: t.confirmStopAllMsg,
      confirmLabel: t.stopAllProcessing(processingCount),
      cancelLabel: "انصراف",
      kind: "danger",
    });
    if (!ok) return;
    startStop(async () => {
      const res = await cancelAllProcessing();
      if (res.error) toast.show(res.error, "error");
      else toast.show(t.bulkCancelled(res.count), "info");
    });
  }

  return (
    <div className="panel p-3 md:p-4 flex flex-wrap items-center gap-2">
      <div className="me-auto" />
      {failedCount > 0 && (
        <button
          onClick={handleRetryAll}
          disabled={retrying}
          className="btn btn-primary text-sm inline-flex items-center gap-1.5"
        >
          {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{retrying ? t.queuedShort : t.retryAllFailed(failedCount)}</span>
        </button>
      )}
      {processingCount > 0 && (
        <button
          onClick={handleStopAll}
          disabled={stopping}
          className="btn btn-danger text-sm inline-flex items-center gap-1.5"
        >
          {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
          <span>{stopping ? t.queuedShort : t.stopAllProcessing(processingCount)}</span>
        </button>
      )}
    </div>
  );
}

function CallCard({
  call: c, allCalls, medianSec, onDeleted,
}: {
  call: Call;
  allCalls: Call[];
  medianSec: number | null;
  onDeleted: (id: string) => void;
}) {
  const showQueue = c.status === "pending" || c.status === "analyzing" || c.status === "transcribing";
  const isFailed = c.status === "failed";
  return (
    <Link href={`/dashboard/calls/${c.id}`} className="block panel p-4 active:bg-surface2 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted fa-nums flex-wrap">
            <span>{formatFaDate(c.created_at)}</span>
            <StatusBadge status={c.status} />
          </div>
          {showQueue && (
            <div className="mt-2">
              <QueueInfo call={c} allCalls={allCalls} medianSec={medianSec} variant="compact" />
              {c.status === "analyzing" && (
                <div className="text-[11px] text-muted leading-tight mt-0.5">
                  <ProcessingPhaseLabel call={c} />
                </div>
              )}
            </div>
          )}
          <div className="mt-2 font-semibold text-sm">
            {c.caller_name || <span className="text-muted">{t.unknown}</span>}
            {c.caller_phone && (
              <span className="ms-2 text-xs text-muted fa-nums" dir="ltr">{c.caller_phone}</span>
            )}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {c.agent_name ? `کارشناس: ${c.agent_name}` : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isFailed && <InlineRetryButton id={c.id} />}
          <DeleteButton id={c.id} onDeleted={onDeleted} />
        </div>
      </div>

      {c.issue_summary && (
        <div className="text-sm mt-3 leading-7 line-clamp-2">{c.issue_summary}</div>
      )}

      {isFailed && c.error_message && (
        <div className="text-xs text-red-700 mt-2 line-clamp-2 leading-5">
          {c.error_message}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {c.category && <span className="badge badge-info">{c.category}</span>}
        {c.resolved === true && <span className="badge badge-success">{resolvedLabel(true)}</span>}
        {c.resolved === false && <span className="badge badge-danger">{resolvedLabel(false)}</span>}
        <SentimentDot value={c.sentiment_caller} />
      </div>
    </Link>
  );
}
