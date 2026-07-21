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
    <Panel title={t("materialsTitle")} icon={FolderOpen}>
      {materials.length === 0 ? (
        <p className="px-3 py-4 text-note text-ink-faint">{t("materialsEmpty")}</p>
      ) : (
        <div className="divide-y divide-line">
          {materials.map((m) => (
            <a
              key={m.id}
              href={`${API_URL}/api/v1/me/materials/${m.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-bg"
            >
              <div
                className={cls(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
                  TYPE_TONE[m.fileType] ?? "bg-bg text-ink-soft"
                )}
              >
                <Icon icon={FileText} size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-note font-semibold text-ink">{m.fileName}</p>
                <p className="text-[12px] uppercase text-ink-faint">{m.fileType}</p>
              </div>
              <Icon
                icon={INLINE.has(m.fileType) ? ExternalLink : Download}
                size={14}
                className="shrink-0 text-ink-faint"
              />
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}
