import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cls } from "../cls";

const baseClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-brand";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cls(baseClass, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cls(baseClass, "min-h-[96px] resize-y", className)} {...rest} />;
}
