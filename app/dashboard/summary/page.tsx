import { createClient } from "@/lib/supabase/server";
import { aggregate, computeRange, RANGES, type Range, type CallRow } from "@/lib/summary";
import { SummaryView } from "./summary-view";
import { t } from "@/lib/strings";

export const dynamic = "force-dynamic";

function parseRange(value: string | string[] | undefined): Range {
  const v = Array.isArray(value) ? value[0] : value;
  return (RANGES as readonly string[]).includes(v ?? "") ? (v as Range) : "7d";
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const { current, prior } = computeRange(range);

  const sb = await createClient();
  const fetchFrom = prior ? prior.from : current.from;

  // Pull only the columns we need for aggregation. Cap at 5k rows; if we
  // outgrow that, swap to a Postgres SQL view (noted in the plan).
  const { data, error } = await sb
    .from("calls")
    .select(
      "id, created_at, agent_name, category, resolved, sentiment_caller, follow_up_needed, tags, status"
    )
    .gte("created_at", fetchFrom.toISOString())
    .lte("created_at", current.to.toISOString())
    .limit(5000);

  const rows: CallRow[] = (data as CallRow[] | null) ?? [];

  const result = aggregate(rows, current, prior, range, {
    noAgent: t.noAgent,
    noCategory: t.noCategory,
    positive: t.positive,
    neutral: t.neutral,
    negative: t.negative,
    unknown: t.unknownBucket,
    resolvedYes: t.resolvedYes,
    resolvedNo: t.resolvedNo,
    resolvedUnknown: t.resolvedUnknown,
  });

  return (
    <div>
      {error && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 mb-4">
          {error.message}
        </div>
      )}
      <SummaryView result={result} />
    </div>
  );
}
