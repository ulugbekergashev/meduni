import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Icon, cls } from "@meduni/ui";

/** Modul ichidagi bo'lim (ilgari sahifa ustidagi tab). */
export interface SubNavItem {
  key: string;
  label: string;
  /** URL — holat manzilda aks etadi (§5: link ulashiladi, orqaga ishlaydi). */
  to: string;
  icon?: ReactNode;
  badge?: number;
  /** Tashqi sahifa/boshqa modulga o'tish — o'ngda strelka. */
  external?: boolean;
}

/**
 * Ikkinchi darajani QANDAY chizish kerak:
 *  - "panel" — desktopda yon panel (248px), mobilda tasma. Kontekstli, ko'p
 *    bo'limli sahifalar uchun (kurs: 6 bo'lim, guruh: 4 — panel sarlavhasi
 *    kurs/guruh nomini ko'rsatadi va foyda beradi).
 *  - "tabs"  — HAR IKKALA o'lchamda kontent ustidagi gorizontal tasma.
 *    Bo'limlar kam bo'lganda (Bosh sahifa: 3 ta) 248px ustun ochish ortiqcha —
 *    buyurtmachi (2026-08-02): "в курсах можно, но на главной не очень".
 */
export type SubNavVariant = "panel" | "tabs";

export interface SubNavData {
  /** Panel sarlavhasi — modul yoki kontekst nomi (kurs/guruh nomi). */
  title: string;
  items: SubNavItem[];
  activeKey: string;
  /** Panel ostidagi qo'shimcha blok (masalan "Kursga qaytish"). */
  footer?: ReactNode;
  variant?: SubNavVariant;
}

interface Ctx {
  data: SubNavData | null;
  set: (d: SubNavData | null) => void;
}
const SubNavCtx = createContext<Ctx>({ data: null, set: () => {} });

export function SubNavProvider({ children }: { children: ReactNode }) {
  const [data, set] = useState<SubNavData | null>(null);
  const value = useMemo(() => ({ data, set }), [data]);
  return <SubNavCtx.Provider value={value}>{children}</SubNavCtx.Provider>;
}

/** Qobiq (RoleShell) o'qiydi — yon paneldagi ikkinchi daraja. */
export function useSubNavData() {
  return useContext(SubNavCtx).data;
}

/**
 * Sahifa o'z bo'limlarini SIDEBAR paneliga chiqaradi (desktop) va SHU YERDA
 * mobil segmented tasma sifatida chizadi (mobilda yon panel yo'q — §11).
 *
 * ⚠️ Sahifada endi alohida tab-bar YOZILMAYDI: bitta manba — shu komponent
 * (aks holda bir xil boshqaruv ikki joyda takrorlanardi, §4 "bitta fakt —
 * bitta joy").
 */
export function SubNav({ title, items, activeKey, footer, variant = "panel" }: SubNavData) {
  const { set } = useContext(SubNavCtx);
  // Elementlar har renderда yangi massiv bo'ladi — solishtirish uchun barqaror kalit.
  const sig = JSON.stringify(items.map((i) => [i.key, i.label, i.to, i.badge]));

  useEffect(() => {
    // "tabs" rejimida yon panelga HECH NARSA berilmaydi — 248px ustun umuman
    // chizilmaydi (SidebarLayout `panel` bo'lmasa uni o'tkazib yuboradi).
    if (variant === "tabs") {
      set(null);
      return;
    }
    set({ title, items, activeKey, footer });
    return () => set(null);
    // ⚠️ `footer`/`items` — har renderда YANGI obyekt (JSX). Ularni bog'liqlikka
    // qo'ysak: set → render → yangi obyekt → set … cheksiz sikl. Shuning uchun
    // solishtirish `sig` (kalit/yorliq/manzil/badge) bo'yicha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, sig, activeKey, variant]);

  return (
    <>
      <div
      className={cls(
        "mb-3 flex max-w-full snap-x snap-mandatory gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        // "panel" rejimida tasma faqat mobilda (desktopda yon panel bor).
        variant === "panel" && "lg:hidden"
      )}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className={cls(
            "shrink-0 snap-start whitespace-nowrap rounded-[8px] px-4 py-2 text-note font-semibold transition-colors",
            item.key === activeKey ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
          )}
        >
          {item.label}
          {item.badge !== undefined && item.badge > 0 && <span className="ml-1.5 text-micro text-rose">{item.badge}</span>}
        </Link>
      ))}
      </div>
      {/* "tabs" rejimida panel yo'q — footer amali (masalan "Boshlash
          qo'llanmasi") yo'qolib qolmasligi uchun tasma ostida chiziladi. */}
      {variant === "tabs" && footer}
    </>
  );
}

/** Yon paneldagi ko'rinish — RoleShell SidebarLayout'ga uzatadi. */
export function SubNavPanel({ data }: { data: SubNavData }) {
  return (
    <>
      <p className="px-3 pb-1.5 pt-2 text-micro font-extrabold uppercase tracking-wider text-side-soft">{data.title}</p>
      <nav className="flex flex-col gap-0.5">
        {data.items.map((item) => {
          const on = item.key === data.activeKey;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={cls(
                "flex items-center gap-2.5 rounded-control px-3 py-2.5 text-body font-semibold transition-colors",
                on ? "bg-side-active text-side-active-ink" : "text-side-soft hover:bg-side-hover hover:text-side-ink"
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose px-1.5 text-micro font-bold text-white">
                  {item.badge}
                </span>
              )}
              {item.external && <Icon icon={ChevronRight} size={14} className="shrink-0 opacity-60" />}
            </Link>
          );
        })}
      </nav>
      {data.footer && <div className="mt-auto pt-2">{data.footer}</div>}
    </>
  );
}
