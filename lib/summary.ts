// Pure aggregation helpers for the Group Summary page.
// No React, no Supabase — easy to test, easy to swap to a Postgres view later.

import type { Sentiment } from "@/lib/supabase/types";

export type Range = "today" | "7d" | "30d" | "all";

export const RANGES: Range[] = ["today", "7d", "30d", "all"];

export type DateWindow = { from: Date; to: Date };

export type RangeResult = {
  current: DateWindow;
  prior: DateWindow | null;
};

// Narrow row shape — only the columns the summary needs.
export type CallRow = {
  id: string;
  created_at: string;
  agent_name: string | null;
  category: string | null;
  resolved: boolean | null;
  sentiment_caller: Sentiment | null;
  follow_up_needed: boolean | null;
  tags: string[] | null;
  status: string;
};

export type Bucket = {
  label: string;
  value: number;
  // Used for the agent breakdown to show resolution % inline.
  secondary?: string;
};

export type DailyBucket = { date: string; count: number };

export type Kpi = {
  value: number;
  // Delta as fraction (e.g. 0.12 = +12%). null when no prior period.
  delta: number | null;
  // Absolute change (current - prior). null when no prior period.
  absDelta: number | null;
};

export type SummaryResult = {
  range: Range;
  current: DateWindow;
  prior: DateWindow | null;
  totalCalls: Kpi;
  // Calls not yet processed (status != 'done') in the current window.
  inFlightCount: number;
  resolutionRate: { value: number | null; delta: number | null }; // value is fraction 0..1 or null when no resolved-known calls
  followUp: Kpi;
  negativeCaller: Kpi;
  byCategory: Bucket[];
  byAgent: Bucket[];
  bySentiment: Bucket[];
  byResolution: Bucket[];
  topTags: Bucket[];
  dailyTrend: DailyBucket[];
};

const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function computeRange(range: Range, now: Date = new Date()): RangeResult {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (range === "today") {
    const current = { from: todayStart, to: todayEnd };
    const prior = {
      from: new Date(todayStart.getTime() - MS_DAY),
      to: new Date(todayEnd.getTime() - MS_DAY),
    };
    return { current, prior };
  }

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const current = {
      from: new Date(todayStart.getTime() - (days - 1) * MS_DAY),
      to: todayEnd,
    };
    const span = current.to.getTime() - current.from.getTime();
    const prior = {
      from: new Date(current.from.getTime() - span - 1),
      to: new Date(current.from.getTime() - 1),
    };
    return { current, prior };
  }

  // all-time — no prior period
  return {
    current: { from: new Date(0), to: todayEnd },
    prior: null,
  };
}

function inWindow(t: number, w: DateWindow): boolean {
  return t >= w.from.getTime() && t <= w.to.getTime();
}

function kpiFromCounts(current: number, prior: number | null): Kpi {
  if (prior === null) return { value: current, delta: null, absDelta: null };
  if (prior === 0) {
    return {
      value: current,
      delta: current > 0 ? 1 : 0,
      absDelta: current,
    };
  }
  return {
    value: current,
    delta: (current - prior) / prior,
    absDelta: current - prior,
  };
}

function bucketSort(map: Map<string, number>, opts: { limit?: number; min?: number } = {}): Bucket[] {
  const arr: Bucket[] = [];
  for (const [label, value] of map) {
    if (opts.min != null && value < opts.min) continue;
    arr.push({ label, value });
  }
  arr.sort((a, b) => b.value - a.value);
  return opts.limit ? arr.slice(0, opts.limit) : arr;
}

export function aggregate(
  rows: CallRow[],
  current: DateWindow,
  prior: DateWindow | null,
  range: Range,
  labels: {
    noAgent: string;
    noCategory: string;
    positive: string;
    neutral: string;
    negative: string;
    unknown: string;
    resolvedYes: string;
    resolvedNo: string;
    resolvedUnknown: string;
  },
): SummaryResult {
  const currentRows: CallRow[] = [];
  const priorRows: CallRow[] = [];
  let inFlightCount = 0;

  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (inWindow(t, current)) {
      if (r.status !== "done") inFlightCount++;
      else currentRows.push(r);
    } else if (prior && inWindow(t, prior)) {
      if (r.status === "done") priorRows.push(r);
    }
  }

  // ----- KPIs -----
  const totalCalls = kpiFromCounts(currentRows.length, prior ? priorRows.length : null);

  const followUpCurr = currentRows.filter((r) => r.follow_up_needed === true).length;
  const followUpPrior = priorRows.filter((r) => r.follow_up_needed === true).length;
  const followUp = kpiFromCounts(followUpCurr, prior ? followUpPrior : null);

  const negCurr = currentRows.filter((r) => r.sentiment_caller === "negative").length;
  const negPrior = priorRows.filter((r) => r.sentiment_caller === "negative").length;
  const negativeCaller = kpiFromCounts(negCurr, prior ? negPrior : null);

  // Resolution rate: only count rows where resolved is known (true | false)
  function rate(rs: CallRow[]): number | null {
    let yes = 0, no = 0;
    for (const r of rs) {
      if (r.resolved === true) yes++;
      else if (r.resolved === false) no++;
    }
    const denom = yes + no;
    if (denom === 0) return null;
    return yes / denom;
  }
  const rateCurr = rate(currentRows);
  const ratePrior = prior ? rate(priorRows) : null;
  const resolutionRate = {
    value: rateCurr,
    delta:
      rateCurr === null || ratePrior === null
        ? null
        : rateCurr - ratePrior, // points difference (0..1 scale)
  };

  // ----- Breakdowns -----
  const catMap = new Map<string, number>();
  const agentCount = new Map<string, number>();
  const agentResolved = new Map<string, number>(); // count of resolved===true
  const agentResolvedKnown = new Map<string, number>(); // count of resolved !== null
  const sentMap = new Map<string, number>();
  const resMap = new Map<string, number>();
  const tagMap = new Map<string, number>();

  // Sentiment buckets — fixed order
  sentMap.set(labels.positive, 0);
  sentMap.set(labels.neutral, 0);
  sentMap.set(labels.negative, 0);
  resMap.set(labels.resolvedYes, 0);
  resMap.set(labels.resolvedNo, 0);
  resMap.set(labels.resolvedUnknown, 0);

  for (const r of currentRows) {
    const cat = r.category?.trim() || labels.noCategory;
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);

    const agent = r.agent_name?.trim() || labels.noAgent;
    agentCount.set(agent, (agentCount.get(agent) ?? 0) + 1);
    if (r.resolved === true) agentResolved.set(agent, (agentResolved.get(agent) ?? 0) + 1);
    if (r.resolved !== null) agentResolvedKnown.set(agent, (agentResolvedKnown.get(agent) ?? 0) + 1);

    const sentLabel =
      r.sentiment_caller === "positive" ? labels.positive :
      r.sentiment_caller === "negative" ? labels.negative :
      r.sentiment_caller === "neutral"  ? labels.neutral  : null;
    if (sentLabel) sentMap.set(sentLabel, (sentMap.get(sentLabel) ?? 0) + 1);

    const resLabel =
      r.resolved === true  ? labels.resolvedYes :
      r.resolved === false ? labels.resolvedNo  : labels.resolvedUnknown;
    resMap.set(resLabel, (resMap.get(resLabel) ?? 0) + 1);

    for (const raw of r.tags ?? []) {
      const tag = raw?.trim();
      if (!tag) continue;
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  // Agent buckets with resolution-% secondary
  const byAgent: Bucket[] = [];
  for (const [agent, count] of agentCount) {
    const known = agentResolvedKnown.get(agent) ?? 0;
    const resolved = agentResolved.get(agent) ?? 0;
    let secondary: string | undefined;
    if (known > 0) {
      const pct = Math.round((resolved / known) * 100);
      secondary = `${pct.toLocaleString("fa-IR")}٪`;
    }
    byAgent.push({ label: agent, value: count, secondary });
  }
  byAgent.sort((a, b) => b.value - a.value);
  const byAgentTop = byAgent.slice(0, 10);

  return {
    range,
    current,
    prior,
    totalCalls,
    inFlightCount,
    resolutionRate,
    followUp,
    negativeCaller,
    byCategory: bucketSort(catMap, { limit: 10 }),
    byAgent: byAgentTop,
    bySentiment: Array.from(sentMap, ([label, value]) => ({ label, value })),
    byResolution: Array.from(resMap, ([label, value]) => ({ label, value })),
    topTags: bucketSort(tagMap, { limit: 12, min: 1 }),
    dailyTrend: buildDailyTrend(currentRows, current, range),
  };
}

function buildDailyTrend(rows: CallRow[], current: DateWindow, range: Range): DailyBucket[] {
  // For "all", bucket by month instead of day to avoid hundreds of bars.
  // For "today", we want a single bar covering today.
  if (range === "all") {
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m, ([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Pre-seed every day in the range so empty days render as flat bars
  const result: DailyBucket[] = [];
  const seen = new Map<string, number>();
  let cursor = startOfDay(current.from);
  const end = startOfDay(current.to);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    seen.set(key, 0);
    cursor = new Date(cursor.getTime() + MS_DAY);
  }

  for (const r of rows) {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    if (seen.has(key)) seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const [date, count] of seen) result.push({ date, count });
  return result;
}
