import type { SelectHTMLAttributes } from "react";
import { cls } from "../cls";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cls(
        "w-full rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-brand disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
