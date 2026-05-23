import type { Sentiment } from "@/lib/supabase/types";
import { sentimentLabel } from "@/lib/strings";

export function SentimentDot({ value, label }: { value: Sentiment | null; label?: string }) {
  const color =
    value === "positive" ? "bg-success" :
    value === "negative" ? "bg-danger" :
    value === "neutral"  ? "bg-warn"    : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-muted">{label ? `${label}:` : null}</span>
      <span>{sentimentLabel(value)}</span>
    </span>
  );
}
