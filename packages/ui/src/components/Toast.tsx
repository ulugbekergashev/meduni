"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cls } from "../cls";

export type ToastKind = "ok" | "warn";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cls(
              "pointer-events-auto flex items-center gap-2 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
            )}
          >
            {item.kind === "ok" ? (
              <Check size={16} strokeWidth={1.7} className="text-emerald" />
            ) : (
              <TriangleAlert size={16} strokeWidth={1.7} className="text-amber" />
            )}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
