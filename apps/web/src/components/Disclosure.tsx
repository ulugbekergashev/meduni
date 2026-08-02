import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

/**
 * "Batafsil" — progressiv ochilish uchun yagona mexanizm.
 *
 * Buyurtmachi qarori (2026-08-02): hech narsa O'CHIRILMAYDI, lekin sukut
 * bo'yicha ekranda 1 asosiy amal turadi, qolgani shu blok ostida yashiringan.
 * Ilgari bu `GenerateSection.tsx` ichida mahalliy `Advanced` edi — endi umumiy.
 *
 * `storageKey` berilsa tanlov localStorage'da saqlanadi (tajribali foydalanuvchi
 * har safar qayta ochmasin).
 */
export function Disclosure({
  label,
  count,
  storageKey,
  defaultOpen = false,
  children,
  className,
}: {
  label: string;
  /** Yorliq yonidagi son — ichida nechta element borligini oldindan aytadi. */
  count?: number;
  /** Berilsa — ochiq/yopiq holati localStorage'da saqlanadi. */
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const v = localStorage.getItem(storageKey);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* private rejimda localStorage yo'q — holat sessiya ichida qoladi */
      }
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-control py-1 text-note font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {label}
        {count !== undefined && count > 0 && (
          <span className="rounded-pill bg-bg px-1.5 text-micro tabular-nums text-ink-faint">{count}</span>
        )}
        <Icon icon={ChevronDown} size={14} className={cls("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
