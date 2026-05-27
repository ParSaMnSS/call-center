"use client";

import Link from "next/link";
import { Loader2, Upload } from "lucide-react";
import { useUpload } from "@/lib/upload-context";

// Sidebar widget that shows live upload progress regardless of which page
// the user is on. Clicking it returns them to the upload page where they
// see the full per-file UI.
export function UploadStatusBadge() {
  const { items, uploading } = useUpload();
  if (items.length === 0) return null;

  const total = items.length;
  const done = items.filter((i) => i.state.kind === "done").length;
  const errors = items.filter((i) => i.state.kind === "error").length;
  const inFlight = items.filter((i) => i.state.kind === "uploading").length;

  const inFlightItem = items.find((i) => i.state.kind === "uploading");
  const percent =
    inFlightItem && inFlightItem.state.kind === "uploading"
      ? Math.round(inFlightItem.state.progress.percent)
      : null;

  const label = uploading
    ? `${done.toLocaleString("fa-IR")} / ${total.toLocaleString("fa-IR")}`
    : `${done.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")}`;

  return (
    <Link
      href="/dashboard/upload"
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface2 transition-colors"
      title="بازگشت به صفحه بارگذاری"
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-fg">
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Upload className="w-3.5 h-3.5" />
        )}
      </span>
      <span className="text-xs font-medium text-fg fa-nums">
        {uploading ? `بارگذاری ${label}` : `بارگذاری‌ها ${label}`}
        {percent !== null && (
          <span className="text-muted ms-1">· {percent.toLocaleString("fa-IR")}٪</span>
        )}
        {inFlight > 1 && (
          <span className="text-muted ms-1">· {inFlight.toLocaleString("fa-IR")} فعال</span>
        )}
        {errors > 0 && (
          <span className="text-red-600 ms-1">· {errors.toLocaleString("fa-IR")} ناموفق</span>
        )}
      </span>
    </Link>
  );
}
