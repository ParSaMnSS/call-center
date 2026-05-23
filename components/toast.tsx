"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const color =
    toast.kind === "success" ? "border-success/40 bg-success/10 text-success" :
    toast.kind === "error"   ? "border-danger/40 bg-danger/10 text-danger"   :
                                "border-accent/40 bg-accent/10 text-accent";

  return (
    <div
      onClick={onClose}
      style={{
        transform: enter ? "translateY(0)" : "translateY(10px)",
        opacity: enter ? 1 : 0,
      }}
      className={`pointer-events-auto cursor-pointer min-w-[260px] max-w-[420px] rounded-xl border ${color} backdrop-blur-md px-4 py-3 shadow-soft transition-all duration-200 text-sm`}
    >
      {toast.message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
