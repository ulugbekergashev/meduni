import type { HTMLAttributes, ReactNode } from "react";
import { cls } from "../cls";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/**
 * Kartochka — soyasiz, 1px chegara (2026-09 «Sokin panel»).
 *
 * ⚠️ Hover'da faqat CHEGARA rangi o'zgaradi. Ilgari `-translate-y-0.5` +
 * soya bor edi: ro'yxatdagi 12 ta kartochka sichqoncha ostida sakrab,
 * sahifa "beqaror" ko'rinardi.
 */
export function Card({ interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cls(
        // ZICHLIK QOIDASI (CLAUDE.md §4): panel padding 12-16px, katta emas.
        "rounded-card border border-line bg-surface p-4 transition-colors duration-150",
        interactive && "cursor-pointer hover:border-line-raised",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Sarlavha ostidagi bir qatorli izoh. */
  hint?: ReactNode;
  /** O'ng chetdagi amal — havola, tugma yoki xulosa matni. */
  right?: ReactNode;
  className?: string;
}

/**
 * Kartochka shapkasi: 16px/600 sarlavha, ostida chiziq, o'ngda amal.
 * `Card`ning `!p-0` variantida ishlatiladi — ro'yxatli kartochkalar shu naqshda.
 */
export function CardHeader({ title, hint, right, className }: CardHeaderProps) {
  return (
    <div
      className={cls(
        "flex items-baseline justify-between gap-3 px-4 pb-3 pt-3.5",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-section font-bold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 truncate text-micro text-ink-soft">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
