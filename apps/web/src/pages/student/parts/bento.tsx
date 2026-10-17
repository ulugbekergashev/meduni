import type { ReactNode } from "react";
import { cls } from "@meduni/ui";

/**
 * Talaba sahifalarining kichik umumiy qismlari (Dizayn v3 «Pastel bento»).
 * `components/bento` kit'i ustida — faqat talaba papkasida ishlatiladi.
 */

/** Ingichka progress chizig'i — 0 bo'lsa to'ldirilgan qism chizilmaydi (§4 StatCard 3-qoida). */
export function Line({
  value,
  tone = "brand",
  track = "bg-line",
  className,
}: {
  value: number;
  tone?: "brand" | "emerald" | "rose" | "amber" | "ink";
  /** Boʻsh qism foni — pastel kartada `bg-surface`. */
  track?: string;
  className?: string;
}) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const fill = { brand: "bg-brand", emerald: "bg-emerald", rose: "bg-rose", amber: "bg-amber", ink: "bg-ink" }[tone];
  return (
    <span className={cls("block h-1.5 w-full overflow-hidden rounded-pill", track, className)} aria-hidden>
      {v > 0 && <span className={cls("block h-full rounded-pill", fill)} style={{ width: `${v}%` }} />}
    </span>
  );
}

/** Segmentli chiziq juda ko'p mavzuda o'qilmay qoladi — undan keyin yaxlit chiziq. */
const MAX_SEGMENTS = 24;

/** Mavzular chizig'i: har mavzu bitta segment — tugaganlar to'q, joriysi yarim. */
export function TopicTrack({ done, total }: { done: number; total: number }) {
  if (total <= 0) return null;
  if (total > MAX_SEGMENTS) return <Line value={Math.round((done / total) * 100)} tone="ink" track="bg-ink/10" />;
  return (
    <span className="flex w-full gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cls("h-1.5 flex-1 rounded-pill", i < done ? "bg-ink" : i === done ? "bg-ink/40" : "bg-ink/10")}
        />
      ))}
    </span>
  );
}

/** Kulrang mayda chip (davr, guruh, holat). */
export function SoftChip({
  children,
  className,
  text = "text-ink-2",
}: {
  children: ReactNode;
  className?: string;
  /** Matn rangi — `className` orqali emas (ikki rang klassi toʻqnashmasin). */
  text?: string;
}) {
  return (
    <span className={cls("inline-flex items-center gap-1 rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold", text, className)}>
      {children}
    </span>
  );
}

/**
 * Segmentli tanlagich — faol band QORA pill (`bg-ink text-surface`), qolgani
 * `text-ink-soft`. Har tugma `aria-pressed` bilan.
 */
export function PillTabs<K extends string>({
  items,
  value,
  onChange,
  className,
  label,
}: {
  items: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cls("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-pill bg-surface-raised p-0.5", className)}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(it.key)}
            className={cls(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-note font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              active ? "bg-ink text-surface" : "text-ink-soft hover:text-ink"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Qidiruv maydoni — bento kartochkalar ichida bir xil ko'rinish. */
export function SearchField({
  value,
  onChange,
  placeholder,
  icon,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <label className={cls("relative block min-w-0", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-pill border border-line bg-surface-raised pl-9 pr-4 text-body text-ink outline-none transition-colors placeholder:text-ink-faint hover:border-line-raised focus:border-brand focus:bg-surface"
      />
    </label>
  );
}
