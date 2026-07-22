import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, FileText } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { useMaterialText, type LessonMaterial } from "../api";

function MaterialBlock({ material, defaultOpen }: { material: LessonMaterial; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const text = useMaterialText(open ? material.id : null);

  return (
    <section className="rounded-card border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-raised"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink-soft">
          <Icon icon={FileText} size={14} />
        </div>
        <span className="min-w-0 flex-1 truncate text-note font-extrabold text-ink">{material.fileName}</span>
        <Icon
          icon={ChevronDown}
          size={15}
          className={cls("shrink-0 text-ink-dim transition-transform", !open && "-rotate-90")}
        />
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {text.isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size={18} />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-note leading-[1.75] text-ink-strong">
              {text.data?.text}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

/** "Material matni" — manba fayllarning ajratilgan matni (mini-konspekt).
 *  Talaba asl faylni yuklamasdan tez o'qib chiqishi uchun. */
export function MaterialTextView({ materials }: { materials: LessonMaterial[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const withText = materials.filter((m) => m.hasText);

  if (withText.length === 0) {
    return <p className="py-4 text-note text-ink-dim">{t("materialsEmpty")}</p>;
  }

  return (
    <div className="mx-auto max-w-[68ch] space-y-2.5">
      {withText.map((m, i) => (
        <MaterialBlock key={m.id} material={m} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
