import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

/** Pastel fonlar — Dizayn v3. Sahifada 1-2 pastel urg'u, qolgani `plain` (oq). */
export type MetricTone = "plain" | "brand" | "violet" | "amber" | "emerald" | "blue" | "rose";

const SHELL: Record<MetricTone, string> = {
  plain: "border border-line bg-surface",
  brand: "bg-brand-soft",
  violet: "bg-violet-soft",
  amber: "bg-amber-soft",
  emerald: "bg-emerald-soft",
  blue: "bg-blue-soft",
  rose: "bg-rose-soft",
};

/** Eng ko'pi bilan shuncha ustun — kartochka torligi sabab. */
const MAX_BARS = 6;

/** Kichik ustunli grafik: har ustun bitta qiymat (0-100). Oxirgisi to'q. */
function Columns({ values }: { values: number[] }) {
  const shown = values.slice(-MAX_BARS);
  // Bitta ustun — taqqoslash yo'q, grafik emas, "buzuq" ko'rinadi.
  if (shown.length < 2) return null;
  return (
    <span className="flex h-10 shrink-0 items-end gap-1.5" aria-hidden>
      {shown.map((v, i) => (
        <span
          key={i}
          className={cls("w-2.5 rounded-pill", i === shown.length - 1 ? "bg-ink" : "bg-ink/25")}
          style={{ height: `${Math.max(12, Math.min(100, v))}%` }}
        />
      ))}
    </span>
  );
}

export interface MetricTileProps {
  label: string;
  /** Raqam yoki tayyor matn ("1/1", "12 525"). `null` — ma'lumot yo'q ("—"). */
  value: number | string | null;
  /** Raqam foiz bo'lsa — `%` qo'shiladi. */
  percent?: boolean;
  sub?: ReactNode;
  tone?: MetricTone;
  /** Raqam rangi — muammo bo'lsa (`rose`), aks holda oddiy. */
  valueTone?: "ink" | "rose" | "emerald" | "amber";
  bars?: number[];
  /** `display` (44px) — sahifadagi asosiy ko'rsatkich; `stat` (28px) — qatordagi oddiy. */
  size?: "display" | "stat";
  onClick?: () => void;
  /** FILTR kartochkasi — `undefined` bo'lsa filtr emas. */
  selected?: boolean;
  className?: string;
}

const VALUE_TONE = { ink: "text-ink", rose: "text-rose", emerald: "text-emerald", amber: "text-amber" };

/**
 * Bento ko'rsatkich kartochkasi — yorliq, katta raqam, izoh va mini-ustunlar.
 * Bosiladigan bo'lsa haqiqiy `<button>`; filtr bo'lsa `aria-pressed`.
 */
export function MetricTile({
  label,
  value,
  percent = false,
  sub,
  tone = "plain",
  valueTone = "ink",
  bars = [],
  size = "display",
  onClick,
  selected,
  className,
}: MetricTileProps) {
  const isFilter = selected !== undefined;
  const shown = value === null ? "—" : percent && typeof value === "number" ? `${value}%` : String(value);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        {/* 2 qatorgacha — tor kartada (mobil 2 ustun) nom qirqilmasin. */}
        <span className="line-clamp-2 text-note font-semibold leading-snug text-ink-2">{label}</span>
        {onClick && !isFilter && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/70 text-ink transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <Icon icon={ArrowUpRight} size={14} />
          </span>
        )}
      </span>
      <span
        className={cls(
          "mt-2 font-semibold tabular-nums",
          size === "display" ? "text-display" : "text-stat",
          VALUE_TONE[valueTone]
        )}
      >
        {shown}
      </span>
      {(sub || bars.length > 1) && (
        <span className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="min-w-0 text-micro text-ink-2">{sub}</span>
          <Columns values={bars} />
        </span>
      )}
    </>
  );

  const base = cls(
    "group flex min-w-0 flex-col rounded-card p-4 text-left transition-[filter,box-shadow]",
    size === "display" && "min-h-36 sm:min-h-44",
    SHELL[tone],
    selected && "ring-2 ring-ink",
    className
  );

  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFilter ? selected : undefined}
      className={cls(base, "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand")}
    >
      {body}
    </button>
  );
}
