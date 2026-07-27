"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cls } from "../cls";
import { Sheet } from "./Sheet";
import type { SidebarItem } from "./SidebarLayout";

export interface BottomNavProps {
  /** Yon paneldagi bilan BIR XIL ro'yxat — birinchi `primaryCount` tasi tab bo'ladi. */
  items: SidebarItem[];
  /** Tab-barda nechta bo'lim ko'rinadi (qolgani "Yana" ichida). */
  primaryCount?: number;
  /** "Yana" tugmasining yorlig'i (i18n). */
  moreLabel: string;
  /** "Yana" panelining pastiga qo'shiladigan blok — til / tema / chiqish. */
  moreExtra?: ReactNode;
  LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
}

function DefaultLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/** Ikonka ustidagi badge — 9 dan katta bo'lsa "9+". */
function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill border-2 border-surface bg-rose px-1 text-micro font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * Mobil navigatsiya — ekran pastida doimiy tab-bar (4 bo'lim + "Yana").
 * `lg` va undan katta ekranda umuman ko'rinmaydi (u yerda yon panel ishlaydi).
 *
 * CLAUDE.md §4: faol holat `layoutId` bilan suziladi, `useReducedMotion`
 * bilan o'chadi, har element `focus-visible:ring`, tap-target ≥ 44px.
 */
export function BottomNav({ items, primaryCount = 4, moreLabel, moreExtra, LinkComponent }: BottomNavProps) {
  const Link = LinkComponent ?? DefaultLink;
  const [moreOpen, setMoreOpen] = useState(false);
  const reduce = useReducedMotion();

  const primary = items.slice(0, primaryCount);
  const rest = items.slice(primaryCount);

  // "Yana" ichidagi bo'lim faol bo'lsa — tugma ham faol ko'rinadi.
  const restActive = rest.some((i) => i.active);
  // Yashiringan bo'limlardagi jami badge — "Yana" ustida ko'rsatiladi.
  const restBadge = rest.reduce((sum, i) => sum + (i.badge ?? 0), 0);

  // min-h-[56px] — tap-target talabi (≥44px) va yorliq bilan birga.
  const cell =
    "relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-2 pb-1.5 min-h-[56px] " +
    "text-micro font-bold leading-none transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset";

  return (
    <>
      <nav
        className={cls(
          // ⚠️ `bg-surface/95` ISHLAMAYDI: ranglar tokenlarda to'liq rang
          // (`var(--surface)`) sifatida saqlanadi, Tailwind shaffoflik
          // modifikatori uchun esa kanal qiymatlari kerak — natijada klass
          // umuman generatsiya qilinmaydi va menyu SHAFFOF bo'lib qoladi
          // (kontent ostidan ko'rinib turadi). Shuning uchun solid `bg-surface`.
          "fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface lg:hidden",
          "pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_16px_rgb(0,0,0,0.06)]"
        )}
        aria-label="asosiy navigatsiya"
      >
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cls(cell, item.active ? "text-brand-deep" : "text-ink-faint")}
          >
            {item.active && (
              <motion.span
                layoutId={reduce ? undefined : "bottomnav-active"}
                className="absolute inset-x-3 top-0 h-[3px] rounded-b-pill bg-brand"
              />
            )}
            <span className="relative shrink-0">
              {item.icon}
              {item.badge !== undefined && item.badge > 0 && <Badge count={item.badge} />}
            </span>
            <span className="w-full truncate text-center">{item.shortLabel ?? item.label}</span>
          </Link>
        ))}

        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={moreLabel}
            aria-expanded={moreOpen}
            className={cls(cell, restActive ? "text-brand-deep" : "text-ink-faint")}
          >
            {restActive && (
              <motion.span
                layoutId={reduce ? undefined : "bottomnav-active"}
                className="absolute inset-x-3 top-0 h-[3px] rounded-b-pill bg-brand"
              />
            )}
            <span className="relative shrink-0">
              <MoreHorizontal size={22} strokeWidth={1.9} />
              {restBadge > 0 && <Badge count={restBadge} />}
            </span>
            <span className="w-full truncate text-center">{moreLabel}</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={moreLabel}>
        {/* Link bosilganda sheet yopiladi — klik yuqoriga ko'tarilib shu yerga yetadi. */}
        <div className="flex flex-col gap-1 pb-2" onClick={() => setMoreOpen(false)}>
          {rest.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cls(
                "flex min-h-[52px] items-center gap-3 rounded-control px-3 text-body font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                item.active ? "bg-brand-soft text-brand-deep" : "text-ink hover:bg-bg"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-pill bg-rose px-2 text-micro font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {moreExtra && <div className="mt-1 border-t border-line pt-3">{moreExtra}</div>}
      </Sheet>
    </>
  );
}
