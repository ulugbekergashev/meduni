import type { ReactNode } from "react";
import { cls } from "../cls";

export interface NumProps {
  children: ReactNode;
  className?: string;
  /** Sarlavha darajasidagi katta raqam uchun — mono EMAS, faqat tabular. */
  display?: boolean;
  title?: string;
}

/**
 * Raqamli qiymat (2026-09 «Sokin panel»).
 *
 * Jadval ustunlari, telefon, vaqt, sana, ball — **mono** shriftda: raqamlar
 * bir-birining ostiga tushadi va ustun "boshqaruv paneli" ko'rinishini oladi.
 * Matn shriftidagi raqamlar bunday tekislanmaydi.
 *
 * ⚠️ `display` — katta ko'rsatkichlar uchun (28px+): mono shrift bunday
 * o'lchamda "0,5" ni "0 , 5" qilib yoyib yuboradi, shuning uchun u yerda
 * faqat `tabular-nums` ishlatiladi.
 */
export function Num({ children, className, display = false, title }: NumProps) {
  return (
    <span
      title={title}
      className={cls(display ? "tabular-nums [letter-spacing:-0.02em]" : "font-data tabular-nums [letter-spacing:-0.02em]", className)}
    >
      {children}
    </span>
  );
}
