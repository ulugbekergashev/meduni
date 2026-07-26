"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { cls } from "../cls";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Sarlavha — berilmasa faqat "grabber" chizig'i ko'rinadi. */
  title?: string;
  children: ReactNode;
  /** Panel tanasiga qo'shimcha class (masalan balandlik cheklovi). */
  className?: string;
  /** Pastga tortib yopishni o'chirish (ichida gorizontal skroll bo'lsa foydali). */
  disableDrag?: boolean;
}

/**
 * Pastdan chiqadigan panel (bottom sheet) — mobil navigatsiya, filtrlar,
 * `Modal`ning mobil ko'rinishi shu komponentga tayanadi.
 *
 * - pastga tortib yopiladi (drag-to-dismiss), backdrop/Escape ham yopadi
 * - ochiq turganda sahifa skroli qulflanadi (panel o'z ichida skroll qiladi)
 * - `useReducedMotion` yoqilgan bo'lsa animatsiya ishlamaydi (CLAUDE.md §4)
 */
export function Sheet({ open, onClose, title, children, className, disableDrag = false }: SheetProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Fon skrolini qulflash — sheet ichidagi skroll fonga "o'tib ketmasin".
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    // Yetarlicha pastga tortilgan YOKI tez silkitilgan bo'lsa — yopamiz.
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-[rgba(15,23,42,.5)]"
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <motion.div
            className={cls(
              "relative max-h-[85dvh] w-full overflow-y-auto rounded-t-card border-t border-line bg-surface shadow-card-hover",
              "pb-[max(1rem,env(safe-area-inset-bottom))]",
              className
            )}
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag={disableDrag || reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={disableDrag || reduce ? undefined : onDragEnd}
          >
            {/* Grabber — "bu panelni tortish mumkin" ishorasi */}
            <div className="sticky top-0 z-10 flex justify-center bg-surface pb-1 pt-2.5">
              <span className="h-1 w-10 rounded-pill bg-line-raised" aria-hidden />
            </div>

            {title && (
              <h2 className="px-4 pb-1 pt-1 text-section font-extrabold tracking-tight text-ink">{title}</h2>
            )}

            <div className="px-4 pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
