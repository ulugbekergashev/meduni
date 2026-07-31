import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookText, Check, Layers, Lock, Network, Sparkles, Video } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { useFlashcards, type Lesson } from "../api";
import { Panel } from "./Panel";
import type { ContentView } from "./stages";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const BLOCK_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  slides: Layers,
  video: Video,
  flashcards: Sparkles,
  mindmap: Network,
};

/** Chap ustun — o'rganish bloklari; faol blok ostida uning tafsiloti ochiladi
 *  (konspekt → bo'limlar TOC, materiallar → fayl/havola ro'yxati).
 *  2026-07-23: "Materiallar" ilgari IKKI joyda edi (blok + alohida seksiya) —
 *  birlashtirildi. Rail endi karta emas (Panel tone="chrome") — u markazdagi
 *  o'qish ustuniga raqobat qilmaydi. */
export function StudyRail({
  lesson,
  blocks,
  active,
  onBlock,
  sectionActive,
  onSection,
}: {
  lesson: Lesson;
  blocks: ContentView[];
  active: ContentView;
  onBlock: (v: ContentView) => void;
  /** Konspektda ko'rinib turgan bo'lim (yoritish uchun). */
  sectionActive: number | null;
  onSection: (index: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const sections = lesson.sections ?? [];

  // Fleshkartalar holati (takrorlash bloki). Qulf: test bor va yakunlanmagan.
  const fc = useFlashcards(lesson.topicId).data;
  const fcLocked = fc?.locked ?? (!!lesson.tabs.quiz && lesson.tabs.quiz.attempt?.status !== "finished");

  function blockLocked(v: ContentView): boolean {
    return v === "flashcards" && fcLocked;
  }

  function blockSub(v: ContentView): string | null {
    if (v === "konspekt") return sections.length ? t("sectionsN", { n: sections.length }) : null;
    if (v === "slides") return lesson.tabs.slides ? t("slidesN", { n: lesson.tabs.slides.slides.length }) : null;
    if (v === "video") {
      const d = lesson.tabs.video?.durationSec;
      return d ? `${Math.round(d / 60)} ${t("minShort")}` : null;
    }
    if (v === "flashcards") {
      if (fcLocked) return t("flashLockedShort");
      if (fc && fc.total > 0) return `${fc.knownCount}/${fc.total}`;
      return t("flashReady");
    }
    if (v === "mindmap") return sections.length ? t("sectionsN", { n: sections.length }) : null;
    return null;
  }

  function blockDone(v: ContentView): boolean {
    if (v === "konspekt") return sections.length > 0 && sections.every((s) => s.read);
    if (v === "slides") return !!lesson.tabs.slides?.viewed;
    if (v === "video") return !!lesson.tabs.video?.done;
    if (v === "flashcards") return !!fc && !fc.locked && fc.total > 0 && fc.knownCount === fc.total;
    return false;
  }

  const activeSub = blockSub(active);

  return (
    <Panel title={t("stage_study")} icon={BookText} bodyClassName="flex min-h-0 flex-row p-0">
      {/* 1-daraja — o'rganish turlari (ikonka reyi). Qobiq menyusi bilan bir xil
          naqsh: ikonka + kichik yorliq, faol = brand chip. */}
      <div className="flex w-[68px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line p-1.5">
        {blocks.map((v) => {
          const on = v === active;
          const done = blockDone(v);
          const blockLock = blockLocked(v);
          return (
            <button
              key={v}
              onClick={() => onBlock(v)}
              title={t(`tab_${v}`)}
              className={cls(
                "relative flex flex-col items-center gap-1 rounded-control px-1 py-2 text-center transition-colors",
                FOCUS,
                on ? (reduce ? "bg-brand-soft" : "") : "hover:bg-surface-raised"
              )}
            >
              {on && !reduce && (
                <motion.span
                  layoutId="rail-block-active"
                  className="absolute inset-0 rounded-control bg-brand-soft"
                  transition={{ type: "spring", stiffness: 480, damping: 40 }}
                />
              )}
              <span
                className={cls(
                  "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
                  // "Tugadi" — kontur belgi (§4: ekranda 10 ta yashil doira shovqin).
                  done
                    ? "bg-emerald-soft text-emerald"
                    : blockLock
                      ? "bg-surface-raised text-ink-dim"
                      : on
                        ? "bg-brand text-white"
                        : "bg-surface-raised text-ink-soft"
                )}
              >
                <Icon icon={done ? Check : blockLock ? Lock : BLOCK_ICON[v]} size={16} strokeWidth={done ? 3 : 2} />
              </span>
              <span
                className={cls(
                  "relative z-[1] line-clamp-2 w-full break-words text-[11px] font-semibold leading-tight",
                  on ? "text-brand-tint" : blockLock ? "text-ink-dim" : "text-ink-soft"
                )}
              >
                {t(`tab_${v}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2-daraja — faol turning tafsiloti: konspektda bo'limlar ro'yxati. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-2">
        <div className="flex items-baseline gap-2 px-1.5 pb-1">
          <p className="min-w-0 flex-1 truncate text-micro font-extrabold uppercase tracking-wider text-ink-faint">
            {t(`tab_${active}`)}
          </p>
          {activeSub && <span className="shrink-0 text-micro text-ink-dim">{activeSub}</span>}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {active === "konspekt" && sections.length > 0 ? (
            <motion.ol
              key="toc"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {sections.map((s) => {
                const cur = sectionActive === s.index;
                return (
                  <li key={s.index}>
                    <button
                      onClick={() => onSection(s.index)}
                      className={cls(
                        "relative flex w-full items-start gap-2 rounded-control py-1.5 pl-2 pr-1.5 text-left transition-colors",
                        FOCUS,
                        cur ? (reduce ? "bg-brand-soft" : "") : "hover:bg-surface-raised"
                      )}
                    >
                      {cur && !reduce && (
                        <motion.span
                          layoutId="toc-active"
                          className="absolute inset-0 rounded-control bg-brand-soft"
                          transition={{ type: "spring", stiffness: 480, damping: 40 }}
                        />
                      )}
                      <span
                        className={cls(
                          "relative z-[1] mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums",
                          cur ? "bg-brand text-white" : s.read ? "text-emerald" : "bg-line text-ink-dim"
                        )}
                      >
                        {s.read && !cur ? <Icon icon={Check} size={10} strokeWidth={4} /> : s.index + 1}
                      </span>
                      <span
                        className={cls(
                          "relative z-[1] min-w-0 flex-1 text-note leading-snug",
                          cur ? "font-semibold text-ink" : "text-ink-soft"
                        )}
                      >
                        {s.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </motion.ol>
          ) : (
            // Boshqa turlarda tafsilot yo'q — holatini bir qatorda aytamiz
            // (bo'sh ustun qolmasin, §4 ZICHLIK).
            <motion.p
              key={`hint-${active}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-1.5 text-note leading-relaxed text-ink-dim"
            >
              {blockLocked(active) ? t("flashLockedShort") : (activeSub ?? t("stage_study"))}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
