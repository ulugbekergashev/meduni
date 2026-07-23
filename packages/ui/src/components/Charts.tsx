import type { ReactNode } from "react";

// Lightweight, dependency-free chart primitives (pure SVG / div). All colors come
// from the design tokens (var(--...)) so they follow light/dark theme. Values and
// labels always wear ink tokens — the colored mark alone carries identity.

type ToneKey = "brand" | "blue" | "violet" | "amber" | "rose" | "emerald";

const toneVar: Record<ToneKey, string> = {
  brand: "var(--brand)",
  blue: "var(--blue)",
  violet: "var(--violet)",
  amber: "var(--amber)",
  rose: "var(--rose)",
  emerald: "var(--emerald)",
};

/** SVG donut ring with a value in the middle. `value` is 0–100. */
export function ProgressRing({
  value,
  size = 116,
  stroke = 11,
  tone = "brand",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: ToneKey;
  label?: ReactNode;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneVar[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tabular-nums text-ink">{Math.round(v)}%</span>
        {label && <span className="mt-1 max-w-[80%] truncate text-[12.5px] font-medium text-ink-faint">{label}</span>}
      </div>
    </div>
  );
}

/** Multi-segment donut with a 2px surface gap between segments (adjacent fills
 *  stay readable — CVD-safe with the validated categorical set). Center shows a
 *  headline value; identity comes from a legend the caller renders next to it. */
export function Donut({
  segments,
  size = 148,
  stroke = 16,
  centerValue,
  centerLabel,
}: {
  segments: { value: number; tone: ToneKey }[];
  size?: number;
  stroke?: number;
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2.5 : 0; // px along the circumference

  let offset = 0;
  const arcs = visible.map((s, i) => {
    const len = total > 0 ? (s.value / total) * c : 0;
    const dash = Math.max(0, len - gap);
    const arc = (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={toneVar[s.tone]}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={-offset}
        className="transition-all duration-500"
      />
    );
    offset += len;
    return arc;
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {arcs}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue !== undefined && (
          <span className="text-[24px] font-bold leading-none tabular-nums text-ink">{centerValue}</span>
        )}
        {centerLabel && (
          <span className="mt-1 max-w-[75%] truncate text-[12.5px] font-medium text-ink-faint">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

/** Legend row for Donut/StackedBar: colored square + label + tabular value.
 *  `onClick` beriladi — qator filtr tugmasiga aylanadi (`selected` faol holat). */
export function LegendRow({
  tone,
  label,
  value,
  onClick,
  selected = false,
}: {
  tone: ToneKey;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  const inner = (
    <>
      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: toneVar[tone] }} />
      <span className="min-w-0 flex-1 truncate text-ink-soft">{label}</span>
      {value !== undefined && <span className="shrink-0 font-semibold tabular-nums text-ink">{value}</span>}
    </>
  );
  if (!onClick) return <div className="flex items-center gap-2.5 text-[14px]">{inner}</div>;
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2.5 rounded-control px-1.5 py-1 text-left text-[14px] transition-colors ${
        selected ? "bg-brand-soft ring-1 ring-brand/30" : "hover:bg-bg"
      }`}
    >
      {inner}
    </button>
  );
}

/** Thin horizontal progress bar (0–100). */
export function ProgressBar({ value, tone = "brand", className = "" }: { value: number; tone?: ToneKey; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-pill bg-bg shadow-inner ${className}`}>
      <div className="h-full rounded-pill transition-all duration-500 shadow-sm" style={{ width: `${Math.max(v, 2)}%`, background: toneVar[tone] }} />
    </div>
  );
}

/** A labeled row with a horizontal bar + value — for comparing items (e.g. courses). */
export function BarRow({
  label,
  value,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: number;
  tone?: ToneKey;
  onClick?: () => void;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-4 rounded-control px-2 py-2 text-left transition-all duration-200 ${onClick ? "hover:bg-bg hover:scale-[0.99]" : "cursor-default"}`}
    >
      <span className="w-44 shrink-0 truncate text-[15px] font-semibold text-ink">{label}</span>
      <span className="h-3.5 flex-1 overflow-hidden rounded-pill bg-bg shadow-inner">
        <span className="block h-full rounded-pill transition-all duration-500 shadow-sm" style={{ width: `${Math.max(v, 2)}%`, background: toneVar[tone] }} />
      </span>
      <span className="w-12 shrink-0 text-right text-[14.5px] font-bold tabular-nums text-ink">{Math.round(v)}%</span>
    </button>
  );
}

/** Compact vertical bar timeline (e.g. AI usage per day). One value per bar,
 *  ink-token labels, recessive baseline; native title tooltip per bar. */
export function MiniBars({
  data,
  tone = "brand",
  height = 120,
  format = (v) => String(Math.round(v)),
}: {
  data: { label: string; value: number; tip?: string }[];
  tone?: ToneKey;
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // Nuqta kam bo'lsa ustunlar kengroq va yorliqlar ko'rinadi — bitta ustun
  // "buzuq grafik" bo'lib qolmasin.
  const few = data.length <= 8;
  const barMax = data.length <= 3 ? 44 : data.length <= 6 ? 28 : 16;
  return (
    <div className="w-full">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * height) : 0;
          return (
            <div key={i} className="group relative flex flex-1 items-end justify-center" style={{ height }}>
              {few && d.value > 0 && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11.5px] font-bold tabular-nums text-ink-soft"
                  style={{ bottom: h + 4 }}
                >
                  {format(d.value)}
                </span>
              )}
              <div
                className="w-full rounded-t-[4px] transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:-translate-y-0.5 shadow-sm"
                style={{
                  height: h,
                  maxWidth: barMax,
                  background: d.value > 0 ? toneVar[tone] : "var(--line)",
                  minHeight: d.value > 0 ? 3 : 2,
                }}
                title={d.tip ?? `${d.label}: ${format(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      {few && (
        <div className="mt-1.5 flex gap-[3px]">
          {data.map((d, i) => (
            <span key={i} className="flex-1 truncate text-center text-[11.5px] text-ink-faint" title={d.label}>
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal stacked bar of colored segments (e.g. attendance breakdown).
 *  Segments are separated by a 2px surface gap so adjacent fills stay readable.
 *  Pass `total` when the segments cover only part of the whole — the remainder
 *  stays as the neutral track (e.g. topics with no content yet). */
export function StackedBar({ segments, total: totalProp }: { segments: { value: number; tone: ToneKey }[]; total?: number }) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  const total = Math.max(totalProp ?? sum, sum) || 1;
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-pill bg-bg">
      {segments.map((s, i) =>
        s.value > 0 ? (
          <span
            key={i}
            className="first:rounded-l-pill last:rounded-r-pill"
            style={{ width: `${(s.value / total) * 100}%`, background: toneVar[s.tone] }}
          />
        ) : null
      )}
    </div>
  );
}
