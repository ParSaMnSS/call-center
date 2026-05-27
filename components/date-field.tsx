"use client";

import { Calendar, X } from "lucide-react";
import { useRef } from "react";
import { formatFaDateShort } from "@/lib/strings";

type Props = {
  value: string;            // ISO yyyy-mm-dd, empty string = unset
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
};

// Styled date field. The browser's native date picker is the only way to get
// a calendar without a date-picker dependency, but we hide its appearance and
// drive it via a label-wrapped input so the trigger looks like all our other
// fields. Shows a Persian-formatted preview when a date is picked.
export function DateField({ value, onChange, placeholder, min, max }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const display = value
    ? formatFaDateShort(value + "T00:00:00")
    : (placeholder ?? "—");

  function open() {
    const el = ref.current;
    if (!el) return;
    // Chromium/Safari support showPicker(); fall back to focus().
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.focus();
    el.click();
  }

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={
        "group relative w-full inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors cursor-pointer " +
        "hover:border-borderStrong focus-within:border-fg focus-within:ring-2 focus-within:ring-fg/10"
      }
    >
      <Calendar className="w-4 h-4 text-muted shrink-0" />
      <span className={"flex-1 truncate fa-nums text-start " + (value ? "text-fg" : "text-subtle")}>
        {display}
      </span>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          className="shrink-0 text-muted hover:text-fg transition-colors"
          aria-label="پاک کردن"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
