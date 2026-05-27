"use client";

import { motion } from "framer-motion";
import { useId } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: "sm" | "md";
  className?: string;
};

// Segmented control with an animated "pill" that slides between selections.
// Used for short, mutually-exclusive choices (Yes/No/All, Positive/Neutral/Negative).
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: Props<T>) {
  const groupId = useId();
  const sizeCls = size === "sm" ? "p-0.5 text-xs" : "p-1 text-sm";
  const itemCls = size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";

  return (
    <div
      role="radiogroup"
      className={
        "inline-flex rounded-lg border border-border bg-surface2 " +
        sizeCls +
        " " +
        (className ?? "")
      }
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              "relative inline-flex items-center justify-center gap-1.5 rounded-md transition-colors whitespace-nowrap " +
              itemCls +
              " " +
              (active ? "text-fg font-medium" : "text-muted hover:text-fg")
            }
          >
            {active && (
              <motion.span
                layoutId={`segmented-pill-${groupId}`}
                className="absolute inset-0 bg-surface rounded-md shadow-flat border border-border"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
