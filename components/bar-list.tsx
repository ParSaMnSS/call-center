type Item = {
  label: string;
  value: number;
  secondary?: string;
};

type Props = {
  items: Item[];
  // Optional palette: tint bars by category. Default is solid black.
  tone?: "accent" | "sentiment" | "resolution";
  // Show the bar background as a track for empty/zero values.
  emptyMessage?: string;
};

// Semantic palettes (lightened for the new light theme)
const SENTIMENT_TONES = ["bg-green-500", "bg-amber-500", "bg-red-500"];
const RESOLUTION_TONES = ["bg-green-500", "bg-red-500", "bg-zinc-400"];

function toneFor(tone: Props["tone"], i: number): string {
  if (tone === "sentiment") return SENTIMENT_TONES[i] ?? "bg-fg";
  if (tone === "resolution") return RESOLUTION_TONES[i] ?? "bg-fg";
  return "bg-fg";
}

export function BarList({ items, tone = "accent", emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-muted text-center py-6">
        {emptyMessage ?? "—"}
      </div>
    );
  }

  const max = items.reduce((m, it) => Math.max(m, it.value), 0) || 1;

  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => {
        const pct = Math.max((it.value / max) * 100, it.value > 0 ? 2 : 0);
        return (
          <li key={`${it.label}-${i}`} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="truncate min-w-0 text-fg">{it.label}</span>
              <span className="text-xs text-muted shrink-0 fa-nums flex items-center gap-2">
                {it.secondary && <span>{it.secondary}</span>}
                <span className="text-fg font-medium">{it.value.toLocaleString("fa-IR")}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div
                className={`h-full ${toneFor(tone, i)} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
