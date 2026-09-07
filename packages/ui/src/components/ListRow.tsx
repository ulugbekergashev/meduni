import type { ReactNode } from "react";
import { cls } from "../cls";

export interface ListRowProps {
  /** Chapdagi 32px belgi: ikonka, avatar, tartib raqami yoki holat nuqtasi. */
  lead?: ReactNode;
  title: ReactNode;
  /** Sarlavha ostidagi bir qatorli kontekst. */
  sub?: ReactNode;
  /** O'ng chetdagi qiymat, sana yoki yorliq. */
  value?: ReactNode;
  /** Qiymatdan keyingi amal — tugma yoki chevron. */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Ro'yxatning BIRINCHI qatorida yuqori chiziq chizilmaydi. */
  first?: boolean;
  className?: string;
}

/**
 * Ro'yxat qatori — ilovadagi yagona nusxa (2026-09 «Sokin panel»).
 *
 * Ilgari bir xil qator beshta joyda alohida yozilgan edi (bugungi darslar,
 * "Bugun hal qilinsin", so'nggi natijalar, bildirishnomalar, vazifalar) va
 * ular bir-biridan asta uzoqlashib borardi: birida padding 12, boshqasida 14;
 * birida sarlavha 15px, boshqasida 13px.
 *
 * Ajratgich — qator ICHIDA yuqori chiziq (`border-t`), ya'ni kartochkaning
 * o'z chegarasi bilan to'qnashmaydi va oxirgi qatordan keyin ortiqcha
 * chiziq qolmaydi.
 */
export function ListRow({ lead, title, sub, value, trailing, onClick, first = false, className }: ListRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cls(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        !first && "border-t border-line-soft",
        onClick && "hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
        className
      )}
    >
      {lead && <span className="flex shrink-0 items-center justify-center">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-note text-ink">{title}</span>
        {sub && <span className="truncate text-micro text-ink-faint">{sub}</span>}
      </span>
      {value && <span className="shrink-0 text-right">{value}</span>}
      {trailing && <span className="shrink-0">{trailing}</span>}
    </Tag>
  );
}
