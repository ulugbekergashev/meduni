import type { HTMLAttributes } from "react";
import { cls } from "../cls";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cls(
        "rounded-card border border-line bg-surface p-5 transition-all",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
