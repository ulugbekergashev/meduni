import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cls } from "../cls";

const baseClass =
  "w-full rounded-control border border-line bg-surface px-3.5 py-2 text-body text-ink placeholder:text-ink-faint shadow-sm outline-none transition-all focus:border-brand focus:ring-[3px] focus:ring-brand/10";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cls(baseClass, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cls(baseClass, "min-h-[96px] resize-y", className)} {...rest} />;
}
