import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

export interface PeriodItem {
  academicYear: string;
  semester: number;
}

/** Kurslarni o'quv yili → semestr bo'yicha guruhlaydi (yangi davr birinchi).
 *  Faqat eng yangi o'quv yili ochiq turadi, qolganlari yig'ilgan — semestrlar
 *  yillar davomida ko'payganda ro'yxat devorga aylanmasin. */
export function groupByPeriod<T extends PeriodItem>(items: T[]) {
  const byYear = new Map<string, Map<number, T[]>>();
  for (const it of items) {
    if (!byYear.has(it.academicYear)) byYear.set(it.academicYear, new Map());
    const sems = byYear.get(it.academicYear)!;
    if (!sems.has(it.semester)) sems.set(it.semester, []);
    sems.get(it.semester)!.push(it);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, sems]) => ({
      year,
      count: [...sems.values()].reduce((n, arr) => n + arr.length, 0),
      semesters: [...sems.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([semester, rows]) => ({ semester, rows })),
    }));
}

/** Yig'iladigan o'quv-yili bo'limi (ichida semestr sarlavhalari). */
export function PeriodSection<T extends PeriodItem>({
  group,
  defaultOpen,
  renderRows,
}: {
  group: ReturnType<typeof groupByPeriod<T>>[number];
  defaultOpen: boolean;
  renderRows: (rows: T[]) => ReactNode;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "period" });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-5 first:mt-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-line pb-2 text-left"
      >
        <Icon icon={ChevronDown} size={16} className={cls("text-ink-faint transition-transform", !open && "-rotate-90")} />
        <h2 className="text-section font-bold text-ink">{t("year", { year: group.year })}</h2>
        <span className="rounded-pill bg-bg px-2 py-0.5 text-note font-semibold text-ink-soft">{group.count}</span>
        {!defaultOpen && <span className="text-note text-ink-faint">{t("archive")}</span>}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {group.semesters.map((s) => (
            <div key={s.semester}>
              <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-faint">
                {t("semester", { n: s.semester })} · {s.rows.length}
              </p>
              {renderRows(s.rows)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Davr filtri (o'quv yili + semestr) — o'qituvchi va admin sahifalarida bir xil. */
export function PeriodFilter({
  years,
  semesters,
  year,
  semester,
  onYear,
  onSemester,
}: {
  years: string[];
  semesters: number[];
  year: string;
  semester: string;
  onYear: (v: string) => void;
  onSemester: (v: string) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "period" });
  const selectCls =
    "rounded-control border border-line bg-surface px-2.5 py-2 text-[14.5px] text-ink outline-none focus:border-brand";
  return (
    <>
      <select value={year} onChange={(e) => onYear(e.target.value)} className={selectCls}>
        <option value="">{t("allYears")}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select value={semester} onChange={(e) => onSemester(e.target.value)} className={selectCls}>
        <option value="">{t("allSemesters")}</option>
        {semesters.map((s) => (
          <option key={s} value={String(s)}>
            {t("semester", { n: s })}
          </option>
        ))}
      </select>
    </>
  );
}

/** Ro'yxatdan mavjud davrlarni yig'ish (alohida so'rovsiz). */
export function usePeriodOptions<T extends PeriodItem>(items: T[]) {
  return useMemo(
    () => ({
      years: [...new Set(items.map((i) => i.academicYear))].sort((a, b) => b.localeCompare(a)),
      semesters: [...new Set(items.map((i) => i.semester))].sort((a, b) => a - b),
    }),
    [items]
  );
}
