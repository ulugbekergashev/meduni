import { useTranslation } from "react-i18next";
import { Download, ExternalLink, FileText, FolderOpen } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { LessonMaterial } from "../api";
import { Panel } from "./Panel";

const TYPE_TONE: Record<string, string> = {
  pdf: "bg-rose-soft text-rose",
  docx: "bg-blue-soft text-blue",
  pptx: "bg-amber-soft text-amber",
  txt: "bg-bg text-ink-soft",
  md: "bg-bg text-ink-soft",
};

const INLINE = new Set(["pdf", "txt", "md"]);

/** Chap panel — o'qituvchi manba materiallari (asl fayllar). */
export function MaterialsPanel({ materials }: { materials: LessonMaterial[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  return (
    <Panel title={t("materialsTitle")} icon={FolderOpen} bodyClassName="p-2 space-y-2">
      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg text-ink-faint mb-2">
            <Icon icon={FolderOpen} size={22} />
          </div>
          <p className="text-[13.5px] font-medium text-ink-faint leading-snug">{t("materialsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <a
              key={m.id}
              href={`${API_URL}/api/v1/me/materials/${m.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-line/80 bg-surface/60 p-2.5 transition-all duration-200 hover:border-brand/40 hover:bg-surface hover:shadow-md"
            >
              <div
                className={cls(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm transition-transform group-hover:scale-105",
                  TYPE_TONE[m.fileType] ?? "bg-bg text-ink-soft"
                )}
              >
                <Icon icon={FileText} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-ink group-hover:text-brand-deep transition-colors">{m.fileName}</p>
                <span className="inline-block rounded-md bg-bg border border-line px-1.5 py-0.5 text-[10px] font-black uppercase text-ink-faint tracking-wider">
                  {m.fileType}
                </span>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg text-ink-faint group-hover:bg-brand-soft group-hover:text-brand-deep transition-colors">
                <Icon
                  icon={INLINE.has(m.fileType) ? ExternalLink : Download}
                  size={14}
                />
              </div>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}
