"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  kind?: "default" | "danger";
};

type Resolver = (v: boolean) => void;

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolverRef.current = resolve; });
  }, []);

  function close(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  }

  // ESC closes (treated as cancel)
  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            key="confirm-root"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <motion.div
              className="panel relative max-w-md w-full p-6"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <h3 className="text-lg font-semibold tracking-tight text-fg">{opts.title}</h3>
              {opts.message && (
                <p className="text-sm text-muted mt-2 leading-7">{opts.message}</p>
              )}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button onClick={() => close(false)} className="btn">
                  {opts.cancelLabel ?? "انصراف"}
                </button>
                <button
                  onClick={() => close(true)}
                  className={"btn " + (opts.kind === "danger" ? "btn-danger" : "btn-primary")}
                  autoFocus
                >
                  {opts.confirmLabel ?? "تأیید"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
