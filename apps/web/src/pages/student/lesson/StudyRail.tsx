import { useTranslation } from "react-i18next";
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

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const BLOCK_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  slides: Layers,
  video: Video,
};

/** Chap ustun — o'rganish bloklari (konspekt / prezentatsiya / video) + faol
 *  konspektning bo'limlar ro'yxati + manba materiallar. Foydalanuvchi talabi:
 *  bu bloklar chapda tursin, o'rtada qator-qator tab bo'lmasin. */
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
  const sections = lesson.sections ?? [];
  const links = lesson.links ?? [];

  function blockSub(v: ContentView): string | null {
    if (v === "konspekt") return sections.length ? t("sectionsN", { n: sections.length }) : null;
    if (v === "slides") return lesson.tabs.slides ? t("slidesN", { n: lesson.tabs.slides.slides.length }) : null;
    if (v === "video") {
      const d = lesson.tabs.video?.durationSec;
      return d ? `${Math.round(d / 60)} ${t("minShort")}` : null;
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
    <Panel title={t("stage_study")} icon={BookText} bodyClassName="flex flex-col p-2">
      {/* O'rganish bloklari */}
      <div className="space-y-0.5">
        {blocks.map((v) => {
          const on = v === active;
          const done = blockDone(v);
          const sub = blockSub(v);
          return (
            <button
              key={v}
              onClick={() => onBlock(v)}
              className={cls(
                "flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors",
                on ? "bg-brand-soft" : "hover:bg-surface-raised"
              )}
            >
              <div
                className={cls(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                  done ? "bg-emerald text-white" : on ? "bg-brand text-white" : "bg-surface-raised text-ink-soft"
                )}
              >
                <Icon icon={done ? Check : BLOCK_ICON[v]} size={14} strokeWidth={done ? 3 : 2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cls("truncate text-note font-extrabold", on ? "text-brand-tint" : "text-ink")}>
                  {t(`tab_${v}`)}
                </p>
                {sub && <p className="truncate text-micro text-ink-dim">{sub}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Faol konspektning bo'limlari (TOC) */}
      {active === "konspekt" && sections.length > 0 && (
        <div className="mt-1 border-t border-line pt-1.5">
          <ol className="space-y-0.5">
            {sections.map((s) => {
              const on = sectionActive === s.index;
              return (
                <li key={s.index}>
                  <button
                    onClick={() => onSection(s.index)}
                    className={cls(
                      "flex w-full items-start gap-2 rounded-control py-1 pl-2 pr-1.5 text-left transition-colors",
                      on ? "bg-surface-raised" : "hover:bg-surface-raised"
                    )}
                  >
                    <span
                      className={cls(
                        "mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-pill text-[10px] font-extrabold tabular-nums",
                        s.read ? "bg-emerald text-white" : on ? "bg-brand text-white" : "bg-line text-ink-dim"
                      )}
                    >
                      {s.read ? <Icon icon={Check} size={9} strokeWidth={4} /> : s.index + 1}
                    </span>
                    <span
                      className={cls(
                        "min-w-0 flex-1 text-micro leading-snug",
                        on ? "font-bold text-ink" : "text-ink-soft"
                      )}
                    >
                      {s.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Manba materiallar */}
      <div className="mt-2 border-t border-line pt-2">
        <p className="px-2 pb-1 text-micro font-extrabold uppercase tracking-wider text-ink-dim">
          {t("materialsTitle")}
        </p>

        {locked && (
          <div className="mb-1.5 flex gap-2 rounded-control border-l-2 border-amber bg-amber-soft px-2.5 py-2">
            <Icon icon={Lock} size={12} className="mt-0.5 shrink-0 text-amber" />
            <p className="text-micro font-bold leading-snug text-amber">{lockedNote}</p>
          </div>
        )}

        {lesson.materials.length === 0 && links.length === 0 ? (
          <p className="px-2 py-1.5 text-micro text-ink-dim">{t("materialsEmpty")}</p>
        ) : (
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
                  className="group flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-raised"
                >
                  <div
                    className={cls(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                      TYPE_TONE[m.fileType] ?? "bg-surface-raised text-ink-soft"
                    )}
                  >
                    <Icon icon={FileText} size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-micro font-bold text-ink group-hover:text-brand-tint">{m.fileName}</p>
                    <p className="truncate text-[10.5px] text-ink-dim">{meta.join(" · ")}</p>
                  </div>
                  <Icon
                    icon={INLINE.has(m.fileType) ? ExternalLink : Download}
                    size={12}
                    className="shrink-0 text-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
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
                className="group flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-raised"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-tint">
                  <Icon icon={Link2} size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-micro font-bold text-ink group-hover:text-brand-tint">{l.title}</p>
                  <p className="truncate text-[10.5px] text-ink-dim">{l.note || t("externalLink")}</p>
                </div>
                <Icon
                  icon={ExternalLink}
                  size={12}
                  className="shrink-0 text-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
