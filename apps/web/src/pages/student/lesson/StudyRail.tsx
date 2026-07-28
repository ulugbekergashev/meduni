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

  return (
    <Panel title={t("stage_study")} icon={BookText} bodyClassName="flex flex-col p-2">
      <div className="space-y-1">
        {blocks.map((v) => {
          const on = v === active;
          const done = blockDone(v);
          const blockLock = blockLocked(v);
          const sub = blockSub(v);
          return (
            <div key={v}>
              <button
                onClick={() => onBlock(v)}
                className={cls(
                  "relative flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors",
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
                <motion.span
                  key={done ? "done" : blockLock ? "locked" : "icon"}
                  initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  className={cls(
                    "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                    // "Tugadi" endi to'ldirilgan yashil emas — bir ekranda 10+
                    // yorqin belgi bo'lmasin uchun kontur ko'rinishida.
                    done
                      ? "bg-emerald-soft text-emerald"
                      : blockLock
                        ? "bg-surface-raised text-ink-dim"
                        : on
                          ? "bg-brand text-white"
                          : "bg-surface-raised text-ink-soft"
                  )}
                >
                  <Icon
                    icon={done ? Check : blockLock ? Lock : BLOCK_ICON[v]}
                    size={17}
                    strokeWidth={done ? 3 : 2}
                  />
                </motion.span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span
                    className={cls(
                      "block truncate text-body",
                      on ? "font-bold text-brand-tint" : blockLock ? "font-semibold text-ink-soft" : "font-semibold text-ink"
                    )}
                  >
                    {t(`tab_${v}`)}
                  </span>
                  {sub && <span className="block truncate text-note text-ink-soft">{sub}</span>}
                </span>
              </button>

              {/* Faol blokning tafsiloti — shu blok ostida ochiladi */}
              <AnimatePresence initial={false}>
                {on && v === "konspekt" && sections.length > 0 && (
                  <motion.ol
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden pl-2.5"
                  >
                    {sections.map((s) => {
                      const cur = sectionActive === s.index;
                      return (
                        <li key={s.index}>
                          <button
                            onClick={() => onSection(s.index)}
                            className={cls(
                              "relative flex w-full items-start gap-2 rounded-control py-1 pl-2 pr-1.5 text-left transition-colors",
                              FOCUS,
                              cur ? (reduce ? "bg-brand-soft" : "") : "hover:bg-surface"
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
                )}

              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
