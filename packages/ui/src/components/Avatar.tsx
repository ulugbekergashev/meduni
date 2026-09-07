import { cls } from "../cls";

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  /** 28 — jadval qatori · 36 — ro'yxat · 56 — karta · 112 — profil sarlavhasi. */
  size?: 28 | 36 | 56 | 112;
  className?: string;
}

const TEXT: Record<number, string> = { 28: "text-micro", 36: "text-note", 56: "text-section", 112: "text-stat" };

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Avatar — ilovadagi yagona nusxa (2026-09 «Sokin panel»).
 *
 * ⚠️ `object-top`: profil rasmlari odatda ko'krakdan olinadi, `object-center`
 * da yuz kadrdan chiqib ketadi. Ilgari bu faqat uch joyda yozilgan edi.
 * Initsial NEYTRAL fonda — rangli gradient avatar ekrandagi eng baland
 * ovozli element bo'lib qolardi.
 */
export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  return (
    <span
      className={cls(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised font-bold text-ink-soft",
        TEXT[size],
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover object-top" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
