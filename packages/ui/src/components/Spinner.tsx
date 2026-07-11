import { cls } from "../cls";

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cls("inline-block animate-spin rounded-full border-2 border-brand-soft border-t-brand", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="loading"
    />
  );
}
