"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadOneCall } from "./actions";
import { useToast } from "@/components/toast";
import { extractPhoneFromFilename } from "@/lib/phone";
import { t } from "@/lib/strings";

const MAX_BYTES = 20 * 1024 * 1024;

type Item = {
  key: string;
  file: File;
  phone: string | null;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  resultId?: string;
};

function newKey() { return Math.random().toString(36).slice(2); }

export function UploadForm() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(files: FileList | File[] | null) {
    if (!files) return;
    const incoming: Item[] = [];
    for (const f of Array.from(files)) {
      const valid = f.size > 0 && f.size <= MAX_BYTES;
      incoming.push({
        key: newKey(),
        file: f,
        phone: extractPhoneFromFilename(f.name),
        status: "queued",
        error: !valid
          ? (f.size > MAX_BYTES ? t.fileTooLarge : t.invalidFileType)
          : undefined,
      });
    }
    setItems((prev) => [...prev, ...incoming]);
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function uploadAll() {
    const queue = items.filter((i) => i.status === "queued" && !i.error);
    if (queue.length === 0) return;
    setUploading(true);

    // Upload sequentially to keep server load + Supabase ordering predictable.
    let successCount = 0;
    let errorCount = 0;
    let firstId: string | undefined;
    for (const item of queue) {
      setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, status: "uploading" } : i));
      const fd = new FormData();
      fd.set("file", item.file);
      const res = await uploadOneCall(fd);
      if (res.ok) {
        successCount++;
        if (!firstId) firstId = res.id;
        setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, status: "done", resultId: res.id } : i));
      } else {
        errorCount++;
        setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, status: "error", error: res.error } : i));
      }
    }

    setUploading(false);

    // Note: the worker kick now happens server-side inside uploadOneCall
    // (via `after()`), so it survives the user navigating away. No client-side
    // kick needed.

    if (successCount > 0 && errorCount === 0) {
      toast.show(successCount === 1 ? t.uploadSuccess : t.uploadSuccessMany(successCount), "success");
    } else if (successCount > 0 && errorCount > 0) {
      toast.show(`${successCount.toLocaleString("fa-IR")} موفق، ${errorCount.toLocaleString("fa-IR")} ناموفق`, "info");
    } else {
      toast.show(t.uploadError, "error");
    }

    // If exactly one succeeded, jump to its detail page; otherwise stay so user sees the list.
    if (successCount === 1 && errorCount === 0 && firstId) {
      router.push(`/dashboard/calls/${firstId}`);
    } else if (successCount > 0) {
      // Clear the successful items, keep errors visible
      setItems((prev) => prev.filter((i) => i.status !== "done"));
    }
  }

  const queueable = items.filter((i) => i.status === "queued" && !i.error).length;
  const totalSize = items.reduce((s, i) => s + i.file.size, 0);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          "cursor-pointer rounded-xl2 border-2 border-dashed py-8 px-6 text-center transition " +
          (dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/60 hover:bg-panel2/30")
        }
      >
        <div className="mx-auto h-10 w-10 rounded-full bg-panel2 flex items-center justify-center mb-2 text-lg">
          ⬆
        </div>
        <div className="text-sm">{t.dropHere}</div>
        <div className="text-xs text-muted mt-1">{t.uploadHint}</div>
        <div className="text-xs text-muted">{t.uploadHintMulti}</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac,.mp4"
          className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="panel divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm text-muted fa-nums">
              {t.filesQueued(items.length)} · {(totalSize / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت
            </div>
            <button
              onClick={() => setItems([])}
              disabled={uploading}
              className="btn btn-ghost text-xs text-muted"
            >
              {t.removeAll}
            </button>
          </div>
          <ul>
            {items.map((it) => (
              <li key={it.key} className="px-4 py-3 flex items-center gap-3">
                <FileIcon />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{it.file.name}</div>
                  <div className="text-xs text-muted fa-nums mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{(it.file.size / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} مگابایت</span>
                    {it.phone && (
                      <span className="badge badge-info" dir="ltr">{it.phone}</span>
                    )}
                  </div>
                </div>
                <ItemStatus item={it} />
                {it.status !== "uploading" && (
                  <button
                    onClick={() => remove(it.key)}
                    disabled={uploading}
                    className="btn btn-ghost text-muted text-xs px-2"
                    aria-label="حذف"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={queueable === 0 || uploading}
            onClick={uploadAll}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading
              ? t.uploading
              : queueable === 1
              ? t.uploadOne
              : t.uploadMany(queueable)}
          </button>
        </div>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <div className="h-9 w-9 shrink-0 rounded-lg bg-panel2 flex items-center justify-center text-muted">
      ♪
    </div>
  );
}

function ItemStatus({ item }: { item: Item }) {
  if (item.status === "queued") {
    if (item.error) return <span className="badge badge-danger text-xs whitespace-nowrap">{item.error}</span>;
    return <span className="badge badge-muted text-xs">{t.status_queued}</span>;
  }
  if (item.status === "uploading") {
    return (
      <span className="badge badge-info text-xs inline-flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        {t.status_uploading}
      </span>
    );
  }
  if (item.status === "done") {
    return <span className="badge badge-success text-xs">✓ {t.status_done}</span>;
  }
  return <span className="badge badge-danger text-xs">{item.error || t.status_error}</span>;
}
