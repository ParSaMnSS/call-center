"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Range, SummaryResult, Kpi } from "@/lib/summary";
import { StatCard } from "@/components/stat-card";
import { BarList } from "@/components/bar-list";
import { FadeIn } from "@/components/motion";
import { Mic } from "lucide-react";
import { formatFaDateShort, formatFaDayMonth, formatFaPercent, t } from "@/lib/strings";

const RANGE_LABELS: Record<Range, string> = {
  today: t.rangeToday,
  "7d": t.range7d,
  "30d": t.range30d,
  all: t.rangeAll,
};

export function SummaryView({ result }: { result: SummaryResult }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setRange(r: Range) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("range", r);
    startTransition(() => {
      router.push(`/dashboard/summary?${params.toString()}`);
    });
  }

  const totalCallsValue = result.totalCalls.value.toLocaleString("fa-IR");

  const resolutionValue =
    result.resolutionRate.value === null
      ? "—"
      : formatFaPercent(result.resolutionRate.value);

  const resolutionDelta =
    result.resolutionRate.delta === null
      ? null
      : ({
          text: formatFaPercent(result.resolutionRate.delta, { signed: true }),
          kind: result.resolutionRate.delta > 0 ? "good" : result.resolutionRate.delta < 0 ? "bad" : "neutral",
        } as const);

  return (
    <FadeIn className={"space-y-5 transition-opacity " + (pending ? "opacity-60" : "")}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{t.summaryTitle}</h1>
        <p className="text-sm text-muted mt-1">{t.summarySubtitle}</p>
      </div>

      {/* Range selector */}
      <div className="panel p-3 md:p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs md:text-sm text-muted fa-nums">
          {result.range === "all"
            ? "تمام بازه‌ها"
            : `${formatFaDateShort(result.current.from)} — ${formatFaDateShort(result.current.to)}`}
          {" · "}
          <span className="text-fg font-medium">{totalCallsValue} تماس</span>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface2 p-1">
          {(["today", "7d", "30d", "all"] as Range[]).map((r) => {
            const active = result.range === r;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                disabled={pending}
                className={
                  "px-3 py-1.5 rounded-md text-xs md:text-sm transition-colors " +
                  (active
                    ? "bg-surface text-fg font-medium shadow-flat"
                    : "text-muted hover:text-fg")
                }
              >
                {RANGE_LABELS[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {result.totalCalls.value === 0 && result.inFlightCount === 0 ? (
        <div className="panel p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-surface2 flex items-center justify-center mb-4">
            <Mic className="w-6 h-6 text-muted" />
          </div>
          <div className="font-semibold text-fg mb-1">{t.noCallsInRange}</div>
          <div className="text-sm text-muted mb-5">برای شروع، یک فایل صوتی بارگذاری کنید.</div>
          <Link href="/dashboard/upload" className="btn btn-primary inline-flex">+ {t.newUpload}</Link>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard
              label={t.kpiTotal}
              value={totalCallsValue}
              delta={deltaChip(result.totalCalls)}
              hint={result.inFlightCount > 0 ? t.inFlight(result.inFlightCount) : undefined}
            />
            <StatCard
              label={t.kpiResolutionRate}
              value={resolutionValue}
              delta={resolutionDelta}
            />
            <StatCard
              label={t.kpiFollowUp}
              value={result.followUp.value.toLocaleString("fa-IR")}
              delta={deltaChip(result.followUp, /* lowerIsBetter */ true)}
            />
            <StatCard
              label={t.kpiNegativeCaller}
              value={result.negativeCaller.value.toLocaleString("fa-IR")}
              delta={deltaChip(result.negativeCaller, /* lowerIsBetter */ true)}
            />
          </div>

          {/* Daily trend */}
          <div className="panel p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">
                {result.range === "all" ? t.monthlyTrend : t.dailyTrend}
              </h2>
            </div>
            <TrendChart result={result} />
          </div>

          {/* Breakdown grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <Panel title={t.byCategory}>
              <BarList items={result.byCategory} emptyMessage="بدون داده" />
            </Panel>
            <Panel title={t.bySentiment}>
              <BarList items={result.bySentiment} tone="sentiment" />
            </Panel>
            <Panel title={`${t.byAgent} — ${t.topNAgents(Math.min(10, result.byAgent.length))}`}>
              <BarList items={result.byAgent} emptyMessage="بدون داده" />
            </Panel>
            <Panel title={t.byResolution}>
              <BarList items={result.byResolution} tone="resolution" />
            </Panel>
          </div>

          {/* Top tags */}
          {result.topTags.length > 0 && (
            <div className="panel p-4 md:p-5">
              <h2 className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">{t.topTags}</h2>
              <div className="flex flex-wrap gap-2">
                {result.topTags.map((tag) => (
                  <span key={tag.label} className="badge">
                    {tag.label}
                    <span className="ms-1 text-[10px] text-muted fa-nums">{tag.value.toLocaleString("fa-IR")}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </FadeIn>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4 md:p-5">
      <h2 className="text-xs font-semibold text-muted mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function deltaChip(kpi: Kpi, lowerIsBetter = false) {
  if (kpi.delta === null) return null;
  if (kpi.delta === 0 && kpi.absDelta === 0) return null;
  const kind: "good" | "bad" | "neutral" =
    kpi.delta === 0 ? "neutral" :
    lowerIsBetter
      ? (kpi.delta < 0 ? "good" : "bad")
      : (kpi.delta > 0 ? "good" : "bad");
  const arrow = kpi.absDelta != null && kpi.absDelta > 0 ? "↑" : "↓";
  return {
    text: `${arrow} ${formatFaPercent(Math.abs(kpi.delta))}`,
    kind,
  };
}

function TrendChart({ result }: { result: SummaryResult }) {
  const trend = result.dailyTrend;
  if (trend.length === 0) {
    return <div className="text-xs text-muted text-center py-6">—</div>;
  }
  const max = trend.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  return (
    <div>
      <div className="flex items-end gap-1 h-28 md:h-32">
        {trend.map((d) => {
          const pct = (d.count / max) * 100;
          const label =
            result.range === "all"
              ? d.date.replace("-", "/")
              : `${formatFaDayMonth(d.date)} — ${d.count.toLocaleString("fa-IR")} تماس`;
          return (
            <div
              key={d.date}
              title={label}
              className="flex-1 min-w-[6px] flex flex-col justify-end"
            >
              <div
                className={
                  "rounded-t-sm transition-all duration-300 " +
                  (d.count > 0 ? "bg-fg" : "bg-surface2")
                }
                style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      {result.range !== "all" && trend.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted fa-nums">
          <span>{formatFaDateShort(trend[0].date)}</span>
          <span>{formatFaDateShort(trend[trend.length - 1].date)}</span>
        </div>
      )}
    </div>
  );
}
