import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cls } from "../cls";

type Variant = "primary" | "deep" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Tugma — soyasiz, ko'tarilmaydi (2026-09 «Sokin panel»).
 *
 * ⚠️ Ilgari har variantda `shadow-sm hover:shadow-md hover:-translate-y-[1px]`
 * bor edi: bir qatorda uchta tugma turganda hammasi sakrar va ekran
 * "titrar" edi. Endi hover — faqat fon/chegara rangi.
 *
 * `deep` — to'q variant (brend fonining quyuqroq ko'rinishi). Qorong'u
 * mavzuda `brand-deep` YORUG' matn rangiga aylangani uchun bu variant
 * `brand-hover` tokenidan foydalanadi (ikkala mavzuda ham oq matn o'qiladi).
 */
const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  deep: "bg-brand-hover text-white hover:bg-brand",
  ghost: "border border-line-raised bg-transparent text-ink hover:bg-surface-raised",
  soft: "bg-brand-soft text-brand-deep hover:bg-brand/15",
  danger: "bg-rose text-white hover:brightness-95",
};

const sizeClass: Record<Size, string> = {
  sm: "h-[30px] px-3 text-micro gap-1.5",
  md: "h-9 px-4 text-note gap-2",
  lg: "h-10 px-5 text-body gap-2",
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
        "inline-flex items-center justify-center rounded-control font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
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
