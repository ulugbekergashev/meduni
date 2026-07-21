import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cls } from "../cls";

type Variant = "primary" | "deep" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:shadow-md hover:bg-brand-deep hover:-translate-y-[1px]",
  deep: "bg-brand-deep text-white shadow-sm hover:shadow-md hover:bg-brand hover:-translate-y-[1px]",
  ghost: "bg-surface text-ink border border-line hover:bg-bg hover:border-brand-soft",
  soft: "bg-brand-soft text-brand-deep hover:brightness-[0.97]",
  danger: "bg-rose text-white shadow-sm hover:shadow-md hover:brightness-95 hover:-translate-y-[1px]",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13.5px] gap-1.5",
  md: "h-10 px-4 text-[14.5px] gap-2",
  lg: "h-12 px-5 text-[15.5px] gap-2.5",
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
