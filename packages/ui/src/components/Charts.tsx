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
        {label && <span className="mt-1 max-w-[80%] truncate text-[11.5px] font-medium text-ink-faint">{label}</span>}
      </div>
    </div>
  );
}

/** Thin horizontal progress bar (0–100). */
export function ProgressBar({ value, tone = "brand", className = "" }: { value: number; tone?: ToneKey; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-pill bg-bg ${className}`}>
      <div className="h-full rounded-pill transition-all" style={{ width: `${Math.max(v, 2)}%`, background: toneVar[tone] }} />
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
      className={`flex w-full items-center gap-4 rounded-control px-2 py-2 text-left transition-colors ${onClick ? "hover:bg-bg" : "cursor-default"}`}
    >
      <span className="w-44 shrink-0 truncate text-[14px] font-medium text-ink">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-pill bg-bg">
        <span className="block h-full rounded-pill transition-all" style={{ width: `${Math.max(v, 2)}%`, background: toneVar[tone] }} />
      </span>
      <span className="w-12 shrink-0 text-right text-[13.5px] font-bold tabular-nums text-ink">{Math.round(v)}%</span>
    </button>
  );
}

/** Horizontal stacked bar of colored segments (e.g. attendance breakdown).
 *  Segments are separated by a 2px surface gap so adjacent fills stay readable. */
export function StackedBar({ segments }: { segments: { value: number; tone: ToneKey }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
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
