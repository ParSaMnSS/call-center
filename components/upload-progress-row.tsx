"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Music, X, XCircle } from "lucide-react";
import { formatThroughput, type UploadProgress } from "@/lib/upload-direct";
import { formatFaDuration, t } from "@/lib/strings";

export type RowState =
  | { kind: "queued" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "done" }
  | { kind: "error"; message: string };

type Props = {
  filename: string;
  sizeBytes: number;
  phone: string | null;
  state: RowState;
  onRemove?: () => void;
  removable?: boolean;
};

export function UploadProgressRow({ filename, sizeBytes, phone, state, onRemove, removable }: Props) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
      className="px-4 py-3 flex items-center gap-3 border-b border-border last:border-b-0"
    >
      <div className="h-9 w-9 shrink-0 rounded-lg bg-surface2 flex items-center justify-center text-muted">
        <Music className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate text-fg">{filename}</div>
        <div className="text-xs text-muted fa-nums mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{(sizeBytes / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} مگابایت</span>
          {phone && <span className="badge" dir="ltr">{phone}</span>}
        </div>

        {state.kind === "uploading" && (
          <div className="mt-2">
            <ProgressBar percent={state.progress.percent} />
            <div className="text-[11px] text-muted fa-nums mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-fg font-medium">
                {Math.round(state.progress.percent).toLocaleString("fa-IR")}٪
              </span>
              {state.progress.bytesPerSec > 0 && (
                <Throughput bytesPerSec={state.progress.bytesPerSec} />
              )}
              {state.progress.bytesPerSec > 0 && (
                <span>
                  · {t.uploadBatchETA(
                    formatFaDuration(
                      Math.max(1, Math.round((state.progress.total - state.progress.loaded) / state.progress.bytesPerSec))
                    )
                  )}
                </span>
              )}
            </div>
          </div>
        )}
        {state.kind === "error" && (
          <div className="text-xs text-red-700 mt-1 line-clamp-2 leading-5">
            {state.message}
          </div>
        )}
      </div>

      <Status state={state} />
      {removable && state.kind !== "uploading" && onRemove && (
        <button
          onClick={onRemove}
          className="btn btn-ghost text-muted px-2"
          aria-label="حذف"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.li>
  );
}

function Status({ state }: { state: RowState }) {
  if (state.kind === "queued") {
    return <span className="badge text-xs">{t.status_queued}</span>;
  }
  if (state.kind === "uploading") {
    return (
      <span className="badge text-xs inline-flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t.status_uploading}
      </span>
    );
  }
  if (state.kind === "done") {
    return (
      <span className="badge badge-success text-xs inline-flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {t.status_done}
      </span>
    );
  }
  return (
    <span className="badge badge-danger text-xs inline-flex items-center gap-1">
      <XCircle className="w-3 h-3" />
      {t.status_error}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-1.5 w-full rounded-full bg-surface2 overflow-hidden">
      <motion.div
        className="h-full bg-fg rounded-full"
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.15, ease: "linear" }}
      />
    </div>
  );
}

function Throughput({ bytesPerSec }: { bytesPerSec: number }) {
  const { value, unit } = formatThroughput(bytesPerSec);
  const text = unit === "mb" ? t.throughputMbps(value) : t.throughputKbps(value);
  return <span>· {text}</span>;
}
