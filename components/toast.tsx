"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type Toast = {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
};

type ToastContextValue = {
  show: (message: string, kind?: Toast["kind"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastView
              key={t.id}
              toast={t}
              onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const accent =
    toast.kind === "success" ? "border-l-green-500" :
    toast.kind === "error"   ? "border-l-red-500"   :
                                "border-l-zinc-900";
  const Icon =
    toast.kind === "success" ? CheckCircle2 :
    toast.kind === "error"   ? XCircle      : Info;
  const iconColor =
    toast.kind === "success" ? "text-green-600" :
    toast.kind === "error"   ? "text-red-600"   : "text-zinc-700";

  return (
    <motion.div
      onClick={onClose}
      role="status"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
      className={`pointer-events-auto cursor-pointer min-w-[280px] max-w-[420px] rounded-xl border border-border border-l-4 ${accent} bg-surface px-4 py-3 shadow-flat text-sm text-fg flex items-start gap-2.5`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
      <span className="leading-6">{toast.message}</span>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
