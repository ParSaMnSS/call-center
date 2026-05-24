type Props = {
  label: string;
  value: string;
  // Optional delta — render as small chip below the number.
  delta?: {
    text: string;             // e.g. "+۱۲٪" or "↑ ۳"
    kind: "good" | "bad" | "neutral";
  } | null;
  // Tiny line under the value (e.g. "X در حال پردازش")
  hint?: string;
};

export function StatCard({ label, value, delta, hint }: Props) {
  const chip =
    delta?.kind === "good" ? "badge-success" :
    delta?.kind === "bad"  ? "badge-danger"  : "badge-muted";

  return (
    <div className="panel p-4 md:p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 text-2xl md:text-3xl font-bold fa-nums">{value}</div>
      <div className="mt-2 flex items-center gap-2 min-h-[1.25rem]">
        {delta && (
          <span className={`badge ${chip} text-xs fa-nums`}>{delta.text}</span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}
