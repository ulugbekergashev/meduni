import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleHelp, Clock } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { BlockView } from "../../../components/lesson/BlockView";
import { DigestView } from "../../../components/lesson/DigestView";
import type { DigestBlock } from "../../../components/lesson/digestTypes";
import type { DigestJson, DigestSection as DigestSectionData } from "./api";

/** Bitta bo'lim — yig'ilgan qator; ochilsa talaba ko'radigan matn chiziladi. */
function SectionRow({ section, index }: { section: DigestSectionData; index: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const [open, setOpen] = useState(false);
  const blocks = (section.blocks ?? []) as DigestBlock[];
  const cp = section.checkpoint ?? null;

  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg text-micro font-bold tabular-nums text-ink-soft">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{section.title}</span>
        {section.minutes > 0 && (
          <span className="hidden shrink-0 items-center gap-1 text-micro text-ink-faint sm:inline-flex">
            <Icon icon={Clock} size={12} /> {t("sectionMinutes", { n: section.minutes })}
          </span>
        )}
        <span className="shrink-0 rounded-pill bg-bg px-2 py-0.5 text-micro font-semibold tabular-nums text-ink-soft">
          {t("sectionBlocks", { n: blocks.length })}
        </span>
        {cp && (
          <span className="hidden shrink-0 items-center gap-1 text-micro font-semibold text-blue sm:inline-flex">
            <Icon icon={CircleHelp} size={12} /> {t("sectionHasCheckpoint")}
          </span>
        )}
        <Icon icon={ChevronDown} size={15} className={cls("shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-2.5 pb-3 text-read">
          {blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
          {cp && (
            <div className="rounded-control border border-blue/30 bg-blue-soft p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider text-blue">
                <Icon icon={CircleHelp} size={13} /> {t("checkpoints")}
              </p>
              <p className="text-body font-semibold text-ink">{cp.question}</p>
              <ul className="mt-1.5 space-y-1">
                {cp.options.map((o, oi) => (
                  <li
                    key={oi}
                    className={cls(
                      "flex gap-2 text-note",
                      oi === cp.correctIndex ? "font-semibold text-emerald" : "text-ink-soft"
                    )}
                  >
                    <span>{oi === cp.correctIndex ? "✓" : "·"}</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
              {cp.explanation && <p className="mt-2 text-note text-ink-soft">{cp.explanation}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Konspektning O'QISH ko'rinishi — o'qituvchi tasdiqlashdan oldin AYNAN
 * talabaga ketadigan matnni ko'radi.
 *
 * Ataylab talabaning `DigestView` / `BlockView` renderlari qayta ishlatiladi
 * (`components/lesson/`): (a) bitta manba — ko'rinish farq qilmaydi, (b) yangi
 * i18n satri kerak emas, (c) ilgari AI bo'limlarga nima yozganini ko'rish uchun
 * chop etib, talaba bo'lib kirish kerak edi.
 */
export function DigestPreview({ draft }: { draft: DigestJson }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const sections = (draft.sections ?? []) as DigestSectionData[];

  return (
    <div className="space-y-4 px-5 py-4">
      {sections.length > 0 && (
        <section>
          <h3 className="mb-1 text-section font-bold text-ink">{t("sectionsTitle")}</h3>
          <p className="mb-1.5 text-note text-ink-soft">{t("sectionsHint")}</p>
          <div className="rounded-control border border-line px-3">
            {sections.map((s, i) => (
              <SectionRow key={s.id ?? i} section={s} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Maqsad / tushuncha / atama / fakt / doza — talaba ko'rinishi bilan bir xil */}
      <DigestView digest={draft} />
    </div>
  );
}
