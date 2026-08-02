import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookText, Check, FolderOpen, Layers, List, Lock, Network, Sparkles, Video, X } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { useFlashcards, type Lesson } from "../api";
import type { ContentView } from "./stages";

// 2026-08-01 (buyurtmachi: "фокус не на самом контенте остаётся"): o'rganish
// menyusi CHAP USTUN edi va ekranning ~280px ini doim egallab turardi —
// prezentatsiya/konspekt esa qolgan joyga siqilardi. Endi u bitta gorizontal
// TASMA: turlar (Konspekt/Slaydlar/Video/Xarita/Kartochka) + ikkita tugma
// ("Bo'limlar", "Manbalar") — ikkalasi ham bosilganda ochiladi. Kontent butun
// kenglikni oladi (ZICHLIK §4: ekranda ma'nosiz bo'sh joy qolmaydi).

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const BLOCK_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  slides: Layers,
  video: Video,
  flashcards: Sparkles,
  mindmap: Network,
};

export function StudyToolbar({
  lesson,
  blocks,
  active,
  onBlock,
  sections,
  visibleSection,
  onSection,
  sectionsOpen,
  onToggleSections,
  sourcesCount,
  sourcesOpen,
  onToggleSources,
}: {
  lesson: Lesson;
  blocks: ContentView[];
  active: ContentView;
  onBlock: (v: ContentView) => void;
  sections: Lesson["sections"];
  visibleSection: number | null;
  onSection: (index: number) => void;
  sectionsOpen: boolean;
  onToggleSections: () => void;
  sourcesCount: number;
  sourcesOpen: boolean;
  onToggleSources: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const popRef = useRef<HTMLDivElement>(null);

  // Fleshkartalar qulfi — test yakunlanmaguncha (backend qulfi bilan mos).
  const fc = useFlashcards(lesson.topicId).data;
  const fcLocked = fc?.locked ?? (!!lesson.tabs.quiz && lesson.tabs.quiz.attempt?.status !== "finished");

  const readCount = sections.filter((s) => s.read).length;

  const blockDone = (v: ContentView): boolean => {
    if (v === "konspekt") return sections.length > 0 && sections.every((s) => s.read);
    if (v === "slides") return !!lesson.tabs.slides?.viewed;
    if (v === "video") return !!lesson.tabs.video?.done;
    if (v === "flashcards") return !!fc && !fc.locked && fc.total > 0 && fc.knownCount === fc.total;
    return false;
  };

  // Tashqariga bosilsa bo'limlar ro'yxati yopiladi (popover xatti-harakati).
  useEffect(() => {
    if (!sectionsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onToggleSections();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onToggleSections();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [sectionsOpen, onToggleSections]);

  return (
    <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-line bg-surface px-2 py-1.5">
      {/* Kontent turlari — segmented tasma (mobilda gorizontal skroll) */}
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {blocks.map((v) => {
          const on = v === active;
          const done = blockDone(v);
          const locked = v === "flashcards" && fcLocked;
          return (
            <button
              key={v}
              onClick={() => onBlock(v)}
              className={cls(
                "relative inline-flex shrink-0 items-center gap-1.5 rounded-control px-2.5 py-1.5 text-note font-bold transition-colors",
                FOCUS,
                on ? "text-brand-tint" : locked ? "text-ink-dim" : "text-ink-soft hover:bg-surface-raised hover:text-ink"
              )}
            >
              {on && (
                <motion.span
                  layoutId="study-tab-active"
                  className="absolute inset-0 rounded-control bg-brand-soft"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 40 }}
                />
              )}
              <Icon icon={locked ? Lock : BLOCK_ICON[v]} size={15} className="relative z-[1] shrink-0" />
              <span className="relative z-[1] whitespace-nowrap">{t(`tab_${v}`)}</span>
              {/* "Tugadi" — kontur belgi (§4: yorqin to'ldirilgan chip emas) */}
              {done && <Icon icon={Check} size={13} strokeWidth={3} className="relative z-[1] shrink-0 text-emerald" />}
            </button>
          );
        })}
      </div>

      {/* Bo'limlar — konspekt bo'limlari ro'yxati (bosilganda ochiladi) */}
      {sections.length > 0 && (
        <div className="relative shrink-0" ref={popRef}>
          <button
            onClick={onToggleSections}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-note font-bold transition-colors",
              FOCUS,
              sectionsOpen ? "border-brand bg-brand-soft text-brand-tint" : "border-line text-ink-soft hover:bg-surface-raised hover:text-ink"
            )}
          >
            <Icon icon={List} size={15} />
            <span className="hidden sm:inline">{t("sectionsBtn")}</span>
            <span className="tabular-nums text-micro text-ink-faint">
              {readCount}/{sections.length}
            </span>
          </button>

          <AnimatePresence>
            {sectionsOpen && (
              <motion.ol
                initial={reduce ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] w-[300px] overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-card-hover"
              >
                {sections.map((s) => {
                  const cur = visibleSection === s.index;
                  return (
                    <li key={s.index}>
                      <button
                        onClick={() => onSection(s.index)}
                        className={cls(
                          "flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left transition-colors",
                          FOCUS,
                          cur ? "bg-brand-soft" : "hover:bg-surface-raised"
                        )}
                      >
                        <span
                          className={cls(
                            "mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums",
                            cur ? "bg-brand text-white" : s.read ? "text-emerald" : "bg-line text-ink-dim"
                          )}
                        >
                          {s.read && !cur ? <Icon icon={Check} size={10} strokeWidth={4} /> : s.index + 1}
                        </span>
                        <span className={cls("min-w-0 flex-1 text-note leading-snug", cur ? "font-semibold text-ink" : "text-ink-soft")}>
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
      )}

      {/* Manbalar — o'qituvchi yuklagan fayl/havolalar (bosilganda ochiladi) */}
      {sourcesCount > 0 && (
        <button
          onClick={onToggleSources}
          className={cls(
            "inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-note font-bold transition-colors",
            FOCUS,
            sourcesOpen ? "border-brand bg-brand-soft text-brand-tint" : "border-line text-ink-soft hover:bg-surface-raised hover:text-ink"
          )}
        >
          <Icon icon={sourcesOpen ? X : FolderOpen} size={15} />
          <span className="hidden sm:inline">{t("sourcesBtn")}</span>
          <span className="tabular-nums text-micro text-ink-faint">{sourcesCount}</span>
        </button>
      )}
    </div>
  );
}
