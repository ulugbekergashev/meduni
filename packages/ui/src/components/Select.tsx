import type { SelectHTMLAttributes } from "react";
import { cls } from "../cls";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cls(
        "w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-body text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
