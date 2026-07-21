import { useTranslation } from "react-i18next";
import { Download, ExternalLink, FileText, FolderOpen } from "lucide-react";
import { Card, EmptyState, Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { LessonMaterial } from "../api";

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
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Icon icon={FolderOpen} size={15} className="text-ink-faint" />
        <p className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("materialsTitle")}</p>
      </div>

      {materials.length === 0 ? (
        <div className="px-4 py-6">
          <EmptyState icon={<Icon icon={FileText} size={20} />} text={t("materialsEmpty")} />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {materials.map((m) => {
            const inline = INLINE.has(m.fileType);
            return (
              <a
                key={m.id}
                href={`${API_URL}/api/v1/me/materials/${m.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg"
              >
                <div
                  className={cls(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    TYPE_TONE[m.fileType] ?? "bg-bg text-ink-soft"
                  )}
                >
                  <Icon icon={FileText} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{m.fileName}</p>
                  <p className="text-note uppercase text-ink-faint">{m.fileType}</p>
                </div>
                <Icon icon={inline ? ExternalLink : Download} size={16} className="shrink-0 text-ink-faint" />
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}
