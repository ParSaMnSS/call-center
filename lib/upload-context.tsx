"use client";

// Global upload state that survives navigation inside the dashboard. The
// dashboard Shell mounts this provider once; pages read and write through the
// hook. XHRs are owned here too, so navigating away from /dashboard/upload
// does not cancel them — the form view simply re-binds to the same items
// when you come back.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { extractPhoneFromFilename } from "@/lib/phone";
import { uploadDirect, type UploadHandle } from "@/lib/upload-direct";
import type { RowState } from "@/components/upload-progress-row";

const MAX_BYTES = 20 * 1024 * 1024;
// How many uploads run at the same time. Higher numbers don't increase your
// upstream bandwidth — they split it — but they do overlap per-request
// overhead (TLS handshake, signed-URL roundtrip, finalize roundtrip).
// 6 keeps the pipe saturated without oversubscribing on slow connections.
const UPLOAD_CONCURRENCY = 6;

export type UploadItem = {
  key: string;
  file: File;
  phone: string | null;
  state: RowState;
  resultId?: string;
  handle?: UploadHandle;
};

type Ctx = {
  items: UploadItem[];
  uploading: boolean;
  addFiles: (files: FileList | File[] | null, opts?: { tooLargeMsg?: string }) => void;
  removeItem: (key: string) => void;
  clearItems: () => void;
  startAll: (handlers?: {
    onAllDone?: (summary: { successCount: number; errorCount: number; firstId?: string }) => void;
  }) => Promise<void>;
};

const UploadContext = createContext<Ctx | null>(null);

function newKey() {
  return Math.random().toString(36).slice(2);
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  const addFiles: Ctx["addFiles"] = useCallback((files, opts) => {
    if (!files) return;
    const tooLarge = opts?.tooLargeMsg ?? "حجم فایل بیش از حد مجاز است";
    const incoming: UploadItem[] = [];
    for (const f of Array.from(files)) {
      const valid = f.size > 0 && f.size <= MAX_BYTES;
      incoming.push({
        key: newKey(),
        file: f,
        phone: extractPhoneFromFilename(f.name),
        state: valid
          ? { kind: "queued" }
          : { kind: "error", message: f.size > MAX_BYTES ? tooLarge : "نوع فایل پشتیبانی نمی‌شود" },
      });
    }
    setItems((prev) => [...prev, ...incoming]);
  }, []);

  const removeItem: Ctx["removeItem"] = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearItems: Ctx["clearItems"] = useCallback(() => {
    setItems([]);
  }, []);

  const startAll: Ctx["startAll"] = useCallback(async (handlers) => {
    const queue = itemsRef.current.filter((i) => i.state.kind === "queued");
    if (queue.length === 0) return;
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;
    let firstId: string | undefined;

    async function runOne(item: UploadItem): Promise<void> {
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
      setItems((prev) =>
        prev.map((i) => (i.key === item.key ? { ...i, handle } : i))
      );

      const res = await result;
      if (res.ok) {
        successCount++;
        if (!firstId) firstId = res.id;
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? { ...i, state: { kind: "done" }, resultId: res.id, handle: undefined }
              : i
          )
        );
      } else {
        errorCount++;
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? { ...i, state: { kind: "error", message: res.error }, handle: undefined }
              : i
          )
        );
      }
    }

    // Fixed-size worker pool. Each "worker" pulls the next queued item until
    // the queue is empty, so we never have more than UPLOAD_CONCURRENCY
    // uploads in flight at once. This is a saturated-pipe scheduler — slow
    // files don't block fast ones from finishing.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const idx = cursor++;
        await runOne(queue[idx]);
      }
    });
    await Promise.all(workers);

    setUploading(false);
    handlers?.onAllDone?.({ successCount, errorCount, firstId });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ items, uploading, addFiles, removeItem, clearItems, startAll }),
    [items, uploading, addFiles, removeItem, clearItems, startAll]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload(): Ctx {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside <UploadProvider>");
  return ctx;
}
