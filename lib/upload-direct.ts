"use client";

// Browser-side direct upload to Supabase Storage. Goes via a server action to
// mint the signed URL + insert a placeholder row, then PUTs the file with
// XHR so we can show real-time upload progress. XHR is the only cross-browser
// API that exposes `upload.onprogress`; fetch doesn't (yet).

import {
  abortPendingCall,
  createPendingCall,
  finalizePendingCall,
} from "@/app/dashboard/upload/actions";

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;            // 0..100
  bytesPerSec: number;        // smoothed throughput
};

export type UploadHandle = {
  /** Abort the in-flight upload. The placeholder row is marked failed. */
  abort: () => void;
};

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type StartOpts = {
  file: File;
  onProgress?: (p: UploadProgress) => void;
};

// Start a direct upload. Returns the eventual result via promise; the handle
// lets the caller cancel mid-upload.
export function uploadDirect(opts: StartOpts): { handle: UploadHandle; result: Promise<UploadResult> } {
  const xhrRef: { current: XMLHttpRequest | null } = { current: null };
  const aborted = { current: false };
  let pendingId: string | null = null;

  const handle: UploadHandle = {
    abort: () => {
      aborted.current = true;
      xhrRef.current?.abort();
    },
  };

  const result = (async (): Promise<UploadResult> => {
    // 1. Insert placeholder row + get signed URL
    const pre = await createPendingCall(opts.file.name, opts.file.size);
    if (!pre.ok) return { ok: false, error: pre.error };
    if (aborted.current) {
      await abortPendingCall(pre.id, "لغو شده");
      return { ok: false, error: "لغو شده" };
    }
    pendingId = pre.id;

    // 2. PUT the bytes to the signed URL with XHR for progress events.
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", pre.signedUrl, true);
        // Supabase signed upload URLs accept these headers:
        xhr.setRequestHeader("Content-Type", opts.file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "true");

        let lastTickAt = Date.now();
        let lastTickLoaded = 0;
        let smoothedRate = 0;

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const now = Date.now();
          const dt = (now - lastTickAt) / 1000;
          if (dt > 0.1) {
            const dl = e.loaded - lastTickLoaded;
            const instRate = dl / dt;
            // Exponential moving average for stability
            smoothedRate = smoothedRate === 0 ? instRate : smoothedRate * 0.7 + instRate * 0.3;
            lastTickAt = now;
            lastTickLoaded = e.loaded;
          }
          opts.onProgress?.({
            loaded: e.loaded,
            total: e.total,
            percent: e.total > 0 ? (e.loaded / e.total) * 100 : 0,
            bytesPerSec: smoothedRate,
          });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Emit a final 100% progress event so the bar fills.
            opts.onProgress?.({
              loaded: opts.file.size,
              total: opts.file.size,
              percent: 100,
              bytesPerSec: smoothedRate,
            });
            resolve();
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error("خطای شبکه در بارگذاری"));
        xhr.onabort = () => reject(new Error("لغو شده"));

        xhr.send(opts.file);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطای ناشناخته";
      if (pendingId) await abortPendingCall(pendingId, message);
      return { ok: false, error: message };
    }

    // 3. Finalize on the server — sets audio_path + kicks the worker.
    const fin = await finalizePendingCall(pre.id, pre.path);
    if (!fin.ok) {
      await abortPendingCall(pre.id, fin.error);
      return { ok: false, error: fin.error };
    }
    return { ok: true, id: pre.id };
  })();

  return { handle, result };
}

// Format helpers for the progress UI.
export function formatThroughput(bytesPerSec: number): { value: number; unit: "kb" | "mb" } {
  const kb = bytesPerSec / 1024;
  if (kb >= 1024) return { value: kb / 1024, unit: "mb" };
  return { value: kb, unit: "kb" };
}

export function estimateEtaSec(loaded: number, total: number, bytesPerSec: number): number | null {
  if (bytesPerSec <= 0 || total <= 0) return null;
  return Math.max(1, Math.round((total - loaded) / bytesPerSec));
}
