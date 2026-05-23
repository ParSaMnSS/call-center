"use client";

import { useState, useRef, useTransition } from "react";
import { uploadCallAudio } from "./actions";
import { t } from "@/lib/strings";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (f.size > 25 * 1024 * 1024) {
      setError(t.fileTooLarge);
      return setFile(null);
    }
    setFile(f);
  }

  async function submit() {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadCallAudio(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          pick(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          "cursor-pointer rounded-xl2 border-2 border-dashed p-10 text-center transition " +
          (dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/60 hover:bg-panel2/40")
        }
      >
        <div className="mx-auto h-12 w-12 rounded-full bg-panel2 flex items-center justify-center mb-3 text-xl">
          ⬆
        </div>
        <div className="text-sm">{t.dropHere}</div>
        <div className="text-xs text-muted mt-1">{t.uploadHint}</div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-panel2/50 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm truncate">{file.name}</div>
            <div className="text-xs text-muted fa-nums">
              {(file.size / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} مگابایت
            </div>
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="btn btn-ghost text-muted text-sm"
          >
            حذف
          </button>
        </div>
      )}

      {error && (
        <div className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!file || pending}
          onClick={submit}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? t.uploading : t.upload}
        </button>
      </div>
    </div>
  );
}
