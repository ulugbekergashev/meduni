import { useTranslation } from "react-i18next";
import { Download, ExternalLink, FileText, FolderOpen, Link2, Lock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { LessonLink, LessonMaterial } from "../api";
import { Panel } from "./Panel";

const TYPE_TONE: Record<string, string> = {
  pdf: "bg-rose-soft text-rose",
  docx: "bg-blue-soft text-blue",
  pptx: "bg-amber-soft text-amber",
  txt: "bg-surface-raised text-ink-soft",
  md: "bg-surface-raised text-ink-soft",
};

const INLINE = new Set(["pdf", "txt", "md"]);

/** "2.1 MB" / "640 KB" — dizayndagi metama'lumot qatori uchun. */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Chap panel — o'qituvchi manba materiallari + tashqi havolalar.
 *  Test davomida `locked` bo'ladi (halollik rejimi, Faza 4). */
export function MaterialsPanel({
  materials,
  links,
  locked = false,
  lockedNote,
}: {
  materials: LessonMaterial[];
  links: LessonLink[];
  locked?: boolean;
  lockedNote?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  return (
    <Panel title={t("materialsTitle")} icon={FolderOpen} bodyClassName="p-2">
      {locked && (
        <div className="mb-2 flex gap-2 rounded-control border-l-2 border-amber bg-amber-soft px-2.5 py-2">
          <Icon icon={Lock} size={13} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-micro font-bold leading-snug text-amber">{lockedNote}</p>
        </div>
      )}

      {materials.length === 0 && links.length === 0 ? (
        <p className="px-1.5 py-3 text-note text-ink-dim">{t("materialsEmpty")}</p>
      ) : (
        <div className={cls("space-y-1", locked && "pointer-events-none opacity-40")}>
          {materials.map((m) => {
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
                className="group flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-surface-raised"
              >
                <div
                  className={cls(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                    TYPE_TONE[m.fileType] ?? "bg-surface-raised text-ink-soft"
                  )}
                >
                  <Icon icon={FileText} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-note font-bold text-ink transition-colors group-hover:text-brand-tint">
                    {m.fileName}
                  </p>
                  <p className="truncate text-micro text-ink-dim">{meta.join(" · ")}</p>
                </div>
                <Icon
                  icon={INLINE.has(m.fileType) ? ExternalLink : Download}
                  size={13}
                  className="shrink-0 text-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
                />
              </a>
            );
          })}

          {links.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-3 text-micro font-extrabold uppercase tracking-wider text-ink-dim">
                {t("externalLinks")}
              </p>
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-surface-raised"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-tint">
                    <Icon icon={Link2} size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-note font-bold text-ink transition-colors group-hover:text-brand-tint">
                      {l.title}
                    </p>
                    <p className="truncate text-micro text-ink-dim">{l.note || t("externalLink")}</p>
                  </div>
                  <Icon
                    icon={ExternalLink}
                    size={13}
                    className="shrink-0 text-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
