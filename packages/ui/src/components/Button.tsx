import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cls } from "../cls";

type Variant = "primary" | "deep" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep",
  deep: "bg-brand-deep text-white hover:bg-brand",
  ghost: "bg-surface text-ink border border-line hover:bg-bg",
  soft: "bg-brand-soft text-brand-deep hover:bg-brand/10",
  danger: "bg-rose text-white hover:bg-rose/90",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-[16.5px] gap-2.5",
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
