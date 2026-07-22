import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookText, Check, Download, ExternalLink, FileText, Layers, Link2, Lock, Video } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { Lesson } from "../api";
import { Panel } from "./Panel";
import type { ContentView } from "./stages";

const TYPE_TONE: Record<string, string> = {
  pdf: "bg-rose-soft text-rose",
  docx: "bg-blue-soft text-blue",
  pptx: "bg-amber-soft text-amber",
  txt: "bg-surface-raised text-ink-soft",
  md: "bg-surface-raised text-ink-soft",
};
const INLINE = new Set(["pdf", "txt", "md"]);

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const BLOCK_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  slides: Layers,
  video: Video,
  materials: FileText,
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
  locked = false,
  lockedNote,
}: {
  lesson: Lesson;
  blocks: ContentView[];
  active: ContentView;
  onBlock: (v: ContentView) => void;
  /** Konspektda ko'rinib turgan bo'lim (yoritish uchun). */
  sectionActive: number | null;
  onSection: (index: number) => void;
  /** Test paytida materiallar yopiladi (halollik). */
  locked?: boolean;
  lockedNote?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const sections = lesson.sections ?? [];
  const links = lesson.links ?? [];
  const hasResources = lesson.materials.length > 0 || links.length > 0;

  function blockSub(v: ContentView): string | null {
    if (v === "konspekt") return sections.length ? t("sectionsN", { n: sections.length }) : null;
    if (v === "slides") return lesson.tabs.slides ? t("slidesN", { n: lesson.tabs.slides.slides.length }) : null;
    if (v === "video") {
      const d = lesson.tabs.video?.durationSec;
      return d ? `${Math.round(d / 60)} ${t("minShort")}` : null;
    }
    if (v === "materials") {
      const n = lesson.materials.filter((m) => m.hasText).length;
      return n ? t("filesN", { n }) : null;
    }
    return null;
  }

  function blockDone(v: ContentView): boolean {
    if (v === "konspekt") return sections.length > 0 && sections.every((s) => s.read);
    if (v === "slides") return !!lesson.tabs.slides?.viewed;
    if (v === "video") return !!lesson.tabs.video?.done;
    return false;
  }

  return (
    <Panel tone="chrome" bodyClassName="flex flex-col p-1">
      <div className="space-y-0.5">
        {blocks.map((v) => {
          const on = v === active;
          const done = blockDone(v);
          const sub = blockSub(v);
          return (
            <div key={v}>
              <button
                onClick={() => onBlock(v)}
                className={cls(
                  "relative flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors",
                  FOCUS,
                  on ? (reduce ? "bg-brand-soft" : "") : "hover:bg-surface"
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
                  key={done ? "done" : "icon"}
                  initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  className={cls(
                    "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                    // "Tugadi" endi to'ldirilgan yashil emas — bir ekranda 10+
                    // yorqin belgi bo'lmasin uchun kontur ko'rinishida.
                    done
                      ? "bg-surface-raised text-emerald"
                      : on
                        ? "bg-brand text-white"
                        : "bg-surface-raised text-ink-soft"
                  )}
                >
                  <Icon icon={done ? Check : BLOCK_ICON[v]} size={14} strokeWidth={done ? 3 : 2} />
                </motion.span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span
                    className={cls(
                      "block truncate text-note",
                      on ? "font-bold text-brand-tint" : "font-semibold text-ink"
                    )}
                  >
                    {t(`tab_${v}`)}
                  </span>
                  {sub && <span className="block truncate text-micro text-ink-dim">{sub}</span>}
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

                {on && v === "materials" && hasResources && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden pl-2.5"
                  >
                    {locked && (
                      <div className="mb-1 flex gap-2 rounded-control border-l-2 border-amber bg-amber-soft px-2.5 py-2">
                        <Icon icon={Lock} size={12} className="mt-0.5 shrink-0 text-amber" />
                        <p className="text-micro font-bold leading-snug text-amber">{lockedNote}</p>
                      </div>
                    )}
                    <div className={cls("space-y-0.5", locked && "pointer-events-none opacity-40")}>
                      {lesson.materials.map((m) => {
                        const meta = [
                          m.fileType.toUpperCase(),
                          m.pageCount ? t("pagesN", { n: m.pageCount }) : null,
                          m.sizeBytes ? formatSize(m.sizeBytes) : null,
                        ].filter(Boolean);
                        return (
                          <a
                            key={m.id}
                            href={`${API_URL}/api/v1/me/materials/${m.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className={cls(
                              "group flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface",
                              FOCUS
                            )}
                          >
                            <span
                              className={cls(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                                TYPE_TONE[m.fileType] ?? "bg-surface-raised text-ink-soft"
                              )}
                            >
                              <Icon icon={FileText} size={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-micro font-bold text-ink group-hover:text-brand-tint">
                                {m.fileName}
                              </span>
                              <span className="block truncate text-micro text-ink-dim">{meta.join(" · ")}</span>
                            </span>
                            <Icon
                              icon={INLINE.has(m.fileType) ? ExternalLink : Download}
                              size={12}
                              className="shrink-0 -translate-x-1 text-ink-dim opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                            />
                          </a>
                        );
                      })}

                      {links.map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cls(
                            "group flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface",
                            FOCUS
                          )}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-tint">
                            <Icon icon={Link2} size={13} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-micro font-bold text-ink group-hover:text-brand-tint">
                              {l.title}
                            </span>
                            <span className="block truncate text-micro text-ink-dim">{l.note || t("externalLink")}</span>
                          </span>
                          <Icon
                            icon={ExternalLink}
                            size={12}
                            className="shrink-0 -translate-x-1 text-ink-dim opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                          />
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
