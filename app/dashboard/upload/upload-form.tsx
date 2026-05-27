"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import { useToast } from "@/components/toast";
import { UploadProgressRow, type RowState } from "@/components/upload-progress-row";
import { extractPhoneFromFilename } from "@/lib/phone";
import { uploadDirect, type UploadHandle } from "@/lib/upload-direct";
import { formatFaDuration, t } from "@/lib/strings";

const MAX_BYTES = 20 * 1024 * 1024;

type Item = {
  key: string;
  file: File;
  phone: string | null;
  state: RowState;
  resultId?: string;
  handle?: UploadHandle;
};

function newKey() { return Math.random().toString(36).slice(2); }

export function UploadForm() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Batch ETA — recomputed every second while uploading.
  const [, force] = useState(0);
  useEffect(() => {
    if (!uploading) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [uploading]);

  function add(files: FileList | File[] | null) {
    if (!files) return;
    const incoming: Item[] = [];
    for (const f of Array.from(files)) {
      const valid = f.size > 0 && f.size <= MAX_BYTES;
      incoming.push({
        key: newKey(),
        file: f,
        phone: extractPhoneFromFilename(f.name),
        state: valid
          ? { kind: "queued" }
          : { kind: "error", message: f.size > MAX_BYTES ? t.fileTooLarge : t.invalidFileType },
      });
    }
    setItems((prev) => [...prev, ...incoming]);
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function uploadAll() {
    const queue = items.filter((i) => i.state.kind === "queued");
    if (queue.length === 0) return;
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;
    let firstId: string | undefined;

    // Sequential — keeps things predictable for the worker queue + the toast log.
    for (const item of queue) {
      const { handle, result } = uploadDirect({
        file: item.file,
        onProgress: (p) => {
          setItems((prev) =>
            prev.map((i) =>
              i.key === item.key ? { ...i, state: { kind: "uploading", progress: p } } : i
            )
          );
        },
      });
      // Stash the handle so the user can cancel.
      setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, handle } : i));

      const res = await result;
      if (res.ok) {
        successCount++;
        if (!firstId) firstId = res.id;
        setItems((prev) =>
          prev.map((i) => i.key === item.key ? { ...i, state: { kind: "done" }, resultId: res.id, handle: undefined } : i)
        );
      } else {
        errorCount++;
        setItems((prev) =>
          prev.map((i) => i.key === item.key ? { ...i, state: { kind: "error", message: res.error }, handle: undefined } : i)
        );
      }
    }

    setUploading(false);

    if (successCount > 0 && errorCount === 0) {
      toast.show(successCount === 1 ? t.uploadSuccess : t.uploadSuccessMany(successCount), "success");
    } else if (successCount > 0 && errorCount > 0) {
      toast.show(`${successCount.toLocaleString("fa-IR")} موفق، ${errorCount.toLocaleString("fa-IR")} ناموفق`, "info");
    } else {
      toast.show(t.uploadError, "error");
    }

    if (successCount === 1 && errorCount === 0 && firstId) {
      router.push(`/dashboard/calls/${firstId}`);
    } else if (successCount > 0) {
      setItems((prev) => prev.filter((i) => i.state.kind !== "done"));
    }
  }

  const queueable = items.filter((i) => i.state.kind === "queued").length;
  const uploadingCount = items.filter((i) => i.state.kind === "uploading").length;
  const doneCount = items.filter((i) => i.state.kind === "done").length;
  const errorCount = items.filter((i) => i.state.kind === "error").length;
  const totalCount = items.length;
  const totalSize = items.reduce((s, i) => s + i.file.size, 0);

  // Batch ETA: sum remaining bytes / aggregate throughput across in-flight uploads.
  const batchEta = computeBatchEta(items);

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
          "cursor-pointer rounded-xl border-2 border-dashed py-10 px-6 text-center transition-colors bg-surface " +
          (dragging
            ? "border-fg bg-surface2"
            : "border-borderStrong hover:border-fg")
        }
      >
        <div className="mx-auto h-11 w-11 rounded-full bg-surface2 flex items-center justify-center mb-3">
          <Upload className="w-5 h-5 text-fg" />
        </div>
        <div className="text-sm font-medium text-fg">{t.dropHere}</div>
        <div className="text-xs text-muted mt-1.5">{t.uploadHint}</div>
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
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div className="text-sm text-muted fa-nums">
              {uploading ? (
                <>
                  {t.uploadBatchProgress(doneCount, totalCount - errorCount)}
                  {" · "}
                  {(totalSize / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت
                  {batchEta !== null && (
                    <>
                      {" · "}
                      <span className="text-fg font-medium">
                        {t.uploadBatchETA(formatFaDuration(batchEta))}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  {t.filesQueued(items.length)}
                  {" · "}
                  {(totalSize / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت
                </>
              )}
            </div>
            {!uploading && (
              <button
                onClick={() => setItems([])}
                disabled={uploading}
                className="btn btn-ghost text-xs text-muted"
              >
                {t.removeAll}
              </button>
            )}
            {uploading && uploadingCount > 0 && (
              <span className="text-xs text-muted">
                {uploadingCount.toLocaleString("fa-IR")} {" در حال بارگذاری"}
              </span>
            )}
          </div>
          <ul>
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <UploadProgressRow
                  key={it.key}
                  filename={it.file.name}
                  sizeBytes={it.file.size}
                  phone={it.phone}
                  state={it.state}
                  removable={!uploading}
                  onRemove={() => remove(it.key)}
                />
              ))}
            </AnimatePresence>
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

// Aggregate ETA across all in-flight uploads. Pretty rough — assumes the
// remaining queued files will upload at the current average throughput.
function computeBatchEta(items: Item[]): number | null {
  let remainingBytes = 0;
  let aggregateRate = 0;
  let hasActive = false;
  for (const it of items) {
    if (it.state.kind === "uploading") {
      remainingBytes += it.state.progress.total - it.state.progress.loaded;
      aggregateRate += it.state.progress.bytesPerSec;
      hasActive = true;
    } else if (it.state.kind === "queued") {
      remainingBytes += it.file.size;
    }
  }
  if (!hasActive || aggregateRate <= 0) return null;
  return Math.max(1, Math.round(remainingBytes / aggregateRate));
}
