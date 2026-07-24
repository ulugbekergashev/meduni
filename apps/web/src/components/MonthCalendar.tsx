import { useMemo } from "react";
import { cls } from "@meduni/ui";

export type CalTone = "brand" | "emerald" | "amber" | "rose" | "blue" | "line";

export interface CalEntry {
  key: string;
  time: string; // "09:00"
  title: string;
  tone: CalTone;
  onClick?: () => void;
}

const pillTone: Record<CalTone, string> = {
  brand: "border-l-brand bg-brand-soft text-brand-deep",
  emerald: "border-l-emerald bg-emerald-soft text-emerald",
  amber: "border-l-amber bg-amber-soft text-amber",
  rose: "border-l-rose bg-rose-soft text-rose",
  blue: "border-l-blue bg-blue-soft text-blue",
  line: "border-l-line-raised bg-surface-raised text-ink-soft",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Oylik kalendar to'ri (6 hafta × 7 kun). Har katakda darslar "pill" ko'rinishida
 *  (vaqt + fan), rang holat bo'yicha. Ko'p bo'lsa "+N". Kun bosilsa `onSelectDay`
 *  — ota-komponent o'sha kun tafsilotini pastda ko'rsatadi. Backend o'zgarmaydi:
 *  ota-komponent shunchaki oy oralig'ini ({from,to}) so'raydi. */
export function MonthCalendar({
  monthDate,
  weekdayNames,
  entriesByDay,
  selectedKey,
  maxPerCell = 3,
  onSelectDay,
}: {
  monthDate: Date;
  /** 7 ta qisqa nom, Dushanbadan (Mon..Sun). */
  weekdayNames: string[];
  entriesByDay: Map<string, CalEntry[]>;
  selectedKey?: string | null;
  maxPerCell?: number;
  onSelectDay?: (key: string) => void;
}) {
  const todayKey = dayKey(new Date());
  const month = monthDate.getMonth();

  // Oyning birinchi kunidan boshlab, o'sha hafta dushanbasidan 42 kun (6 hafta).
  const days = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthDate]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Hafta kunlari sarlavhasi */}
        <div className="grid grid-cols-7 border-b border-line">
          {weekdayNames.map((n, i) => (
            <div key={i} className="px-2 py-2 text-center text-micro font-bold uppercase tracking-wider text-ink-faint">
              {n}
            </div>
          ))}
        </div>

        {/* 6 hafta */}
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const entries = entriesByDay.get(k) ?? [];
            const inMonth = d.getMonth() === month;
            const isToday = k === todayKey;
            const isSelected = k === selectedKey;
            const shown = entries.slice(0, maxPerCell);
            const extra = entries.length - shown.length;
            return (
              <button
                key={k}
                onClick={() => onSelectDay?.(k)}
                className={cls(
                  "min-h-[104px] border-b border-l border-line p-1.5 text-left align-top transition-colors [&:nth-child(7n)]:border-r-0 hover:bg-bg",
                  !inMonth && "bg-bg/40",
                  isSelected && "ring-2 ring-inset ring-brand"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cls(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-note font-bold tabular-nums",
                      isToday ? "bg-brand text-white" : inMonth ? "text-ink" : "text-ink-faint"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {entries.length > 0 && (
                    <span className="text-micro font-semibold tabular-nums text-ink-faint">{entries.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {shown.map((e) => (
                    <span
                      key={e.key}
                      onClick={(ev) => {
                        if (e.onClick) {
                          ev.stopPropagation();
                          e.onClick();
                        }
                      }}
                      className={cls(
                        "block truncate rounded-[6px] border-l-[3px] px-1.5 py-0.5 text-micro font-semibold",
                        pillTone[e.tone]
                      )}
                      title={`${e.time} · ${e.title}`}
                    >
                      <span className="tabular-nums">{e.time}</span> {e.title}
                    </span>
                  ))}
                  {extra > 0 && <span className="block px-1 text-micro font-semibold text-ink-faint">+{extra}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
