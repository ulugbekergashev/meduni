import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cls } from "../cls";

type Variant = "primary" | "deep" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-brand to-brand-tint text-white shadow-[0_2px_10px_-2px_rgba(79,70,229,0.3)] hover:shadow-[0_4px_14px_-2px_rgba(79,70,229,0.4)] hover:-translate-y-[1px] hover:brightness-105 border border-transparent",
  deep: "bg-brand-deep text-white shadow-sm hover:shadow-md hover:bg-brand hover:-translate-y-[1px]",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface-raised hover:border-line-raised hover:shadow-sm",
  soft: "bg-brand-soft text-brand-deep hover:bg-[#e4e9f7]",
  danger: "bg-gradient-to-r from-rose to-[#fb7185] text-white shadow-sm hover:shadow-md hover:-translate-y-[1px]",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3.5 text-note gap-1.5",
  md: "h-10 px-4 text-body gap-2",
  lg: "h-12 px-5 text-body gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cls(
        "inline-flex items-center justify-center rounded-control font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
