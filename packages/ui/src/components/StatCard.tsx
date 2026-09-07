import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cls } from "../cls";

export type StatTone = "good" | "warn" | "bad" | "brand";

const INK: Record<StatTone, string> = {
  good: "text-emerald",
  warn: "text-amber",
  bad: "text-rose",
  brand: "text-brand-deep",
};
const FILL: Record<StatTone, string> = {
  good: "bg-emerald",
  warn: "bg-amber",
  bad: "bg-rose",
  brand: "bg-brand",
};

export interface StatCardProps {
  label: string;
  /** Katta raqam (yoki yuklanayotganda "—"). */
  value: ReactNode;
  /** Raqam yonidagi birlik: "%", "/ 18", "so'm". */
  unit?: string;
  /** Raqam ostidagi bir qatorli izoh. */
  hint?: ReactNode;
  /** `hint` bilan bir xil — referens nomi. */
  sub?: ReactNode;

  /**
   * ⚠️ Raqamning rangi. FAQAT raqamning o'zi yomon xabar bo'lganda beriladi.
   * "Guruhlar 5" sariq bo'lsa, go'yo 5 yomon son — aslida muammo izohda.
   */
  tone?: StatTone;
  /** Izohning rangi. Muammo raqamda emas, izohda bo'lsa shu ishlatiladi. */
  subTone?: StatTone;

  /** 0–100. `barCaption` bilan BIRGA beriladi. */
  bar?: number | null;
  barTone?: StatTone;
  /** Chiziq nimaning ulushi ekani — `bar` berilsa majburiy. */
  barCaption?: ReactNode;

  /** Butun kartochkani qizil qiladi — qatordagi BITTA e'tibor raqami uchun. */
  accent?: boolean;
  /** Kartochka filtr vazifasini bajarganda — faol holat. */
  selected?: boolean;
  /** Zich qatorlar uchun kichikroq variant. */
  compact?: boolean;
  onClick?: () => void;
  className?: string;

  /**
   * @deprecated 2026-09 redizayn: ko'rsatkich kartochkasida rangli ikonka-chip
   * YO'Q (referens `UI_UPGRADE_PLAN` 1.4). Prop mavjud chaqiruvlar buzilmasligi
   * uchun qoldirilgan va E'TIBORGA OLINMAYDI.
   */
  icon?: LucideIcon;
}

/**
 * Ko'rsatkich kartochkasi — ilovadagi YAGONA nusxa (2026-09 «Sokin panel»).
 *
 * Tuzilishi: yorliq 12 → raqam 28 → izoh 12 (yoki chiziq + izoh).
 * Ikonka-chip, gradient, soya va uppercase YO'Q: ilgari bir sahifada
 * to'rt xil ko'rsatkich kartasi (StatCard/HeroTile/HeroCard/RailCard)
 * bir vaqtda "qichqirar" edi.
 *
 * Qoidalar (referens chizmasidan):
 *  1. Har `bar` bilan birga `barCaption` — izohsiz chiziq nimaning ulushi
 *     ekanini aytmaydi, ya'ni hech narsa anglatmaydi.
 *  2. `tone` raqamga, `subTone` izohga rang beradi (yuqoridagi izohga qarang).
 *  3. Qiymat 0 bo'lsa chiziq chizilmaydi — ingichka dumcha go'yo biror ish
 *     qilingandek ko'rinadi.
 *  4. Qatorda `accent` faqat BITTA kartochkada.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  sub,
  tone,
  subTone,
  bar,
  barTone = "brand",
  barCaption,
  accent = false,
  selected = false,
  compact = false,
  onClick,
  className,
}: StatCardProps) {
  const caption = sub ?? hint;
  const shell = accent
    ? "bg-rose-soft border-rose-line hover:border-rose"
    : "bg-surface border-line hover:border-line-raised";
  const pct = typeof bar === "number" ? Math.max(0, Math.min(100, bar)) : null;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cls(
        "min-w-0 rounded-card border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        compact ? "px-3.5 py-3" : "p-4",
        shell,
        selected && "!border-brand ring-1 ring-brand",
        onClick && "cursor-pointer",
        className
      )}
    >
      <span className="block truncate text-micro text-ink-soft">{label}</span>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cls(
            "raqam font-bold leading-none",
            compact ? "text-h1" : "text-stat",
            accent ? "text-rose" : tone ? INK[tone] : "text-ink"
          )}
        >
          {value ?? "—"}
        </span>
        {unit && <span className="shrink-0 text-note text-ink-faint">{unit}</span>}
      </div>

      {pct !== null ? (
        <>
          <div className="mt-2.5 h-1 overflow-hidden rounded-pill bg-line">
            {pct > 0 && <div className={cls("h-full rounded-pill", FILL[barTone])} style={{ width: `${pct}%` }} />}
          </div>
          {barCaption && <span className="mt-1.5 block truncate text-micro text-ink-faint">{barCaption}</span>}
        </>
      ) : caption ? (
        <span
          className={cls(
            "mt-1.5 block truncate text-micro",
            accent ? "text-rose-muted" : subTone ? INK[subTone] : "text-ink-faint"
          )}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}

/** Referensdagi nom — yangi kod shuni ishlatadi. */
export const StatTile = StatCard;
