"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cls } from "../cls";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.5)] p-4"
      onClick={onClose}
    >
      <div
        className={cls("w-full max-w-lg rounded-card bg-surface p-6 shadow-xl", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-[16px] font-bold text-ink">{title}</h2>}
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
