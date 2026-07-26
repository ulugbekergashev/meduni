"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cls } from "../cls";
import { Sheet } from "./Sheet";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Mobilda ham markazda tursin (pastdan chiqadigan sheet bo'lmasin). */
  forceCentered?: boolean;
}

/** `sm` chegarasi (640px) — Tailwind bilan bir xil. */
const MOBILE_QUERY = "(max-width: 639px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/**
 * Modal oynasi. Desktopda — markazda karta; **mobilda avtomat ravishda
 * pastdan chiqadigan `Sheet`** (barmoq bilan pastga tortib yopiladi).
 * Chaqiruvchi kod o'zgarmaydi — barcha modallar birdan mobilga moslashadi.
 */
export function Modal({ open, onClose, title, children, className, forceCentered = false }: ModalProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mobil: sheet (Escape/backdrop/drag yopishni o'zi boshqaradi).
  if (isMobile && !forceCentered) {
    return (
      <Sheet open={open} onClose={onClose} title={title} className={className}>
        {children}
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.5)] p-4"
      onClick={onClose}
    >
      <div
        className={cls(
          "max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-7 shadow-card-hover",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          {title && <h2 className="text-[18px] font-bold text-ink">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded-full p-1 text-ink-soft hover:bg-bg"
            aria-label="close"
          >
            <X size={18} strokeWidth={1.7} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
