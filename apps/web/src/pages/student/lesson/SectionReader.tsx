import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ArrowRight, Check, Clock, FileText, Minus, Plus } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { LessonSection, Term } from "../api";
import { BlockView } from "./BlockView";

/** O'qish shrifti — A−/A+ bilan boshqariladi, tanlov localStorage'da qoladi.
 *  2026-07-23 v3: buyurtmachi "shrift kichik" dedi → default 20px (katta).
 *  Kalit versiyalangan — eski indeks yangi massivda boshqa o'lchamni bildirardi. */
const READ_SIZES = [17, 18, 20, 22, 24];
const SIZE_KEY = "meduni.readSize4";

function useReadSize() {
  const [idx, setIdx] = useState(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(SIZE_KEY) : null;
    const n = raw ? Number(raw) : 2; // default = 20px
    return Number.isInteger(n) && n >= 0 && n < READ_SIZES.length ? n : 2;
  });
  const set = (next: number) => {
    const clamped = Math.max(0, Math.min(READ_SIZES.length - 1, next));
    setIdx(clamped);
    try {
      window.localStorage.setItem(SIZE_KEY, String(clamped));
    } catch {}
  };
  return {
    px: READ_SIZES[idx],
    dec: () => set(idx - 1),
    inc: () => set(idx + 1),
    min: idx === 0,
    max: idx === READ_SIZES.length - 1,
  };
}

/** Konspekt — BARCHA bo'limlar bitta uzluksiz oqimda (foydalanuvchi talabi:
 *  "разделы нужно сразу все показать"). O'qilgani skroll bilan avtomatik
 *  belgilanadi; o'qilganlik BELGISI faqat chap TOC'da (bu yerda takrorlanmaydi —
 *  o'qish ustunida 5 ta yashil belgi matnni kesib tashlardi). */
export function SectionReader({
  sections,
  terms = [],
  activeSection,
  onVisibleSection,
  onMarkRead,
  onFinished,
  finishedLabel,
}: {
  sections: LessonSection[];
  /** Konspekt atamalari — matn ichida Smart Tooltip uchun. */
  terms?: Term[];
  /** Chap TOC'dan tanlangan bo'lim — shu yerga skroll qiladi. */
  activeSection: number | null;
  /** Skroll paytida ko'rinib turgan bo'lim (TOC'ni yoritish uchun). */
  onVisibleSection?: (index: number) => void;
  onMarkRead: (index: number) => void;
  onFinished?: () => void;
  finishedLabel?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const size = useReadSize();
  const scrollRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<Set<number>>(new Set());

  const readCount = sections.filter((s) => s.read).length;
  const allRead = sections.length > 0 && readCount === sections.length;

  // O'qish jarayoni — yupqa chiziq. Uzun konspektda "qayerdaman" hissi.
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  // TOC'dan tanlanganda — o'sha bo'limga skroll.
  useEffect(() => {
    if (activeSection === null) return;
    const el = document.getElementById(`sec-${activeSection}`);
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [activeSection, reduce]);

  // Bo'lim oxirigacha skroll qilingan bo'lsa — o'qildi deb belgilaymiz.
  // Bir marta yuboriladi (markedRef), takroriy so'rov yo'q.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.end);
          if (Number.isInteger(i) && !markedRef.current.has(i) && !sections[i]?.read) {
            markedRef.current.add(i);
            onMarkRead(i);
          }
        }
      },
      { root, threshold: 0.1 }
    );
    root.querySelectorAll("[data-end]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, onMarkRead]);

  // Ko'rinib turgan bo'limni TOC'ga xabar qilish.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onVisibleSection) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const i = Number((visible.target as HTMLElement).dataset.sec);
          if (Number.isInteger(i)) onVisibleSection(i);
        }
      },
      { root, rootMargin: "-10% 0px -70% 0px", threshold: [0, 0.5, 1] }
    );
    root.querySelectorAll("[data-sec]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections.length, onVisibleSection]);

  if (sections.length === 0) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Ixcham shapka — faqat o'qish o'lchami. Hisoblagich/nom yo'q:
          bo'lim nomi TOC'da, bosqich nomi stepper'da turibdi. */}
      <div className="flex shrink-0 items-center justify-end px-3 py-1.5">
        <div className="flex shrink-0 items-center gap-0.5 rounded-control border border-line">
          <button
            onClick={size.dec}
            disabled={size.min}
            aria-label={t("readSmaller")}
            className="flex h-6 w-6 items-center justify-center rounded-l-control text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30"
          >
            <Icon icon={Minus} size={12} />
          </button>
          <span className="px-0.5 text-micro font-extrabold text-ink-faint">A</span>
          <button
            onClick={size.inc}
            disabled={size.max}
            aria-label={t("readBigger")}
            className="flex h-6 w-6 items-center justify-center rounded-r-control text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30"
          >
            <Icon icon={Plus} size={12} />
          </button>
        </div>
      </div>

      {/* O'qish jarayoni chizig'i */}
      <motion.div
        style={{ scaleX: reduce ? scrollYProgress : progress }}
        className="h-0.5 shrink-0 origin-left bg-brand"
      />

      {/* Barcha bo'limlar — bitta oqim. Kontent kenglikni to'ldiradi. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[80ch] px-4 py-6 sm:px-8" style={{ fontSize: `${size.px}px` }}>
          {sections.map((section, si) => (
            <motion.section
              key={section.index}
              id={`sec-${section.index}`}
              data-sec={section.index}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={cls("scroll-mt-4", si > 0 && "mt-7 border-t border-line pt-6")}
            >
              <div className="mb-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-micro font-extrabold uppercase tracking-wider text-brand-tint">
                    {t("sectionOf", { n: section.index + 1, total: sections.length })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-soft">
                    <Icon icon={Clock} size={12} />
                    {t("minutesN", { n: section.minutes })}
                  </span>
                </div>
                {/* em — sarlavha o'qish o'lchami bilan birga masshtablanadi */}
                <h2 className="text-[1.3em] font-extrabold leading-tight tracking-tight text-ink">{section.title}</h2>
                {section.sourceRef && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-micro text-ink-faint">
                    <Icon icon={FileText} size={12} />
                    {t("sourceRef")}: {section.sourceRef}
                  </p>
                )}
              </div>

              <div className="space-y-4 leading-[1.75]">
                {section.blocks.map((b, i) => (
                  <BlockView key={i} block={b} terms={terms} />
                ))}
              </div>

              {/* O'qildi sensori — bo'lim oxiri ko'ringanda belgilanadi */}
              <div data-end={section.index} className="h-px" />
            </motion.section>
          ))}
        </div>
      </div>

      {/* Pastki bar — doim ko'rinadigan, KATTA "keyingi bosqich" tugmasi */}
      {allRead && onFinished && (
        <motion.div
          initial={reduce ? false : { y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 py-3"
        >
          <span className="hidden items-center gap-1.5 text-note font-bold text-emerald sm:inline-flex">
            <Icon icon={Check} size={16} strokeWidth={3} />
            {t("readCount", { n: readCount, total: sections.length })}
          </span>
          <button
            onClick={onFinished}
            className="group ml-auto inline-flex items-center gap-2 rounded-control bg-brand px-5 py-3 text-body font-extrabold text-white transition-[background-color,transform] hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.98]"
          >
            {finishedLabel ?? t("finishReading")}
            <Icon icon={ArrowRight} size={18} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
