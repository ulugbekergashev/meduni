import { cls } from "../cls";

export function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cls(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill transition-colors disabled:opacity-50",
        checked ? "bg-brand" : "bg-line"
      )}
    >
      <span
        className={cls(
          "inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
