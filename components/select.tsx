"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  // Optional: render a custom label/value (e.g. for badge or icon prefixes).
  // Receives the currently-selected option (or null if value is unmatched).
  renderValue?: (opt: SelectOption | null) => React.ReactNode;
  dir?: "rtl" | "ltr";
};

// Custom select with portal-based dropdown so it can never get clipped by
// overflow-hidden parents. Keyboard: ↑/↓ to move, Enter to choose, Esc to
// close, Home/End jump to ends. RTL-aware.
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  renderValue,
  dir = "rtl",
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Reset highlight to the current selection when opening
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(Math.max(0, idx));
      setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    }
  }, [open, options, value]);

  // Close on click outside / esc
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onResize() {
      setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  function commit(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      return;
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(highlight);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const startSide = dir === "rtl" ? "right" : "left";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          "w-full inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg transition-colors hover:border-borderStrong focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 disabled:opacity-50 " +
          (className ?? "")
        }
      >
        <span className="truncate text-start flex-1">
          {renderValue
            ? renderValue(selected)
            : selected
              ? selected.label
              : <span className="text-subtle">{placeholder ?? "—"}</span>}
        </span>
        <ChevronDown
          className={"w-4 h-4 text-muted shrink-0 transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <motion.ul
                ref={listRef}
                role="listbox"
                tabIndex={-1}
                onKeyDown={onListKey}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 0.61, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: rect.bottom + 6,
                  [startSide]: dir === "rtl"
                    ? window.innerWidth - rect.right
                    : rect.left,
                  width: rect.width,
                  zIndex: 70,
                }}
                className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg outline-none"
                autoFocus
              >
                {options.map((opt, i) => {
                  const isSel = opt.value === value;
                  const isHi = i === highlight;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => commit(i)}
                      className={
                        "flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors " +
                        (isHi
                          ? "bg-surface2 text-fg"
                          : "text-fg/90 hover:bg-surface2")
                      }
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSel && <Check className="w-4 h-4 shrink-0 text-fg" />}
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
