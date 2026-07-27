"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cls } from "../cls";
import { MOBILE_QUERY, useMediaQuery } from "../useMediaQuery";
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

/**
 * Modal oynasi. Desktopda — markazda karta; **mobilda avtomat ravishda
 * pastdan chiqadigan `Sheet`** (barmoq bilan pastga tortib yopiladi).
 * Chaqiruvchi kod o'zgarmaydi — barcha modallar birdan mobilga moslashadi.
 */
export function Modal({ open, onClose, title, children, className, forceCentered = false }: ModalProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

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
