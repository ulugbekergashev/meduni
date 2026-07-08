"use client";

import type { ReactNode } from "react";

/* Дизайн-система M1: маленькие примитивы вместо UI-библиотеки.
   Палитра: teal (бренд) + slate (нейтраль), радиусы xl, лёгкие тени. */

export function cls(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary:
    "bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 disabled:opacity-50",
  outline: "border border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  danger: "text-rose-600 hover:bg-rose-50",
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      {...props}
      className={cls(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cls("block text-sm", className)}>
      <span className="mb-1.5 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(fieldClass, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cls(fieldClass, "appearance-auto", props.className)} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cls("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const badgeTones = {
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
} as const;

export function Badge({
  tone = "slate",
  children,
  onClick,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={cls(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        onClick && "cursor-pointer hover:opacity-80",
      )}
    >
      {children}
    </Tag>
  );
}

const avatarPalette = [
  "bg-teal-600", "bg-sky-600", "bg-violet-600", "bg-rose-500", "bg-amber-500", "bg-emerald-600",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const color = avatarPalette[(name.charCodeAt(0) || 0) % avatarPalette.length];
  return (
    <span
      className={cls(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        color,
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
      )}
    >
      {initials}
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl text-teal-600">
        {icon}
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </Card>
  );
}

export const th = "px-4 py-3 font-medium";
export const td = "px-4 py-3";
