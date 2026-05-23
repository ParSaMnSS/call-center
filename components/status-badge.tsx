import { statusLabel } from "@/lib/strings";
import type { CallStatus } from "@/lib/supabase/types";

export function StatusBadge({ status }: { status: CallStatus }) {
  const cls =
    status === "done"
      ? "badge-success"
      : status === "failed"
      ? "badge-danger"
      : status === "pending"
      ? "badge-muted"
      : "badge-info";

  const showPulse = status === "transcribing" || status === "analyzing" || status === "pending";

  return (
    <span className={`badge ${cls}`}>
      {showPulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {statusLabel(status)}
    </span>
  );
}
