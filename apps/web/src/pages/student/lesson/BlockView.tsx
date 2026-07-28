import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestBlock, Term } from "../api";
import { TermText } from "./TermTooltip";

/** Konspekt blokining renderi — 1a (ro'yxat) va 1b (kartochka) ikkalasida bir xil.
 *  `terms` berilsa, matn ichidagi tibbiy/lotincha atamalar tooltip oladi (Smart Tooltip). */
export function BlockView({ block, terms = [] }: { block: DigestBlock; terms?: Term[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  // ⚠️ AI ba'zan blokni noto'g'ri shaklda qaytaradi (masalan `list` — `items`siz,
  // faqat `text` bilan). Bunday holda BUTUN dars sahifasi oq ekran bo'lib
  // qolmasligi kerak: matni bo'lsa oddiy paragraf sifatida ko'rsatamiz, bo'lmasa
  // blokni umuman chizmaymiz. (Backend ham normalizatsiya qiladi — bu ikkinchi
  // himoya qatlami, eski/buzuq konspektlar uchun.)
  const raw = block as { type?: string; text?: string; items?: unknown };
  if (block.type === "list" && (!Array.isArray(raw.items) || raw.items.length === 0)) {
    if (!raw.text) return null;
    return (
      <p className="text-ink-strong">
        <TermText text={raw.text} terms={terms} />
      </p>
    );
  }

  if (block.type === "para") {
    return (
      <p className="text-ink-strong">
        <TermText text={block.text} terms={terms} />
      </p>
    );
  }

  if (block.type === "callout") {
    const warn = block.tone === "warning";
    return (
      <div
        className={cls(
          "flex gap-2.5 rounded-control border-l-2 px-3.5 py-3",
          warn ? "border-amber bg-amber-soft" : "border-brand bg-brand-soft"
        )}
      >
        <Icon
          icon={warn ? TriangleAlert : Info}
          size={15}
          className={cls("mt-0.5 shrink-0", warn ? "text-amber" : "text-brand-tint")}
        />
        <div className="min-w-0">
          <p className={cls("mb-0.5 text-micro font-extrabold uppercase tracking-wider", warn ? "text-amber" : "text-brand-tint")}>
            {warn ? t("calloutWarning") : t("calloutImportant")}
          </p>
          <p className="text-ink-strong">
            <TermText text={block.text} terms={terms} />
          </p>
        </div>
      </div>
    );
  }

  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag className="space-y-2">
      {block.items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          {/* em — markerlar A−/A+ bilan matn bilan birga masshtablanadi */}
          <span
            className={cls(
              "mt-[0.55em] shrink-0",
              block.ordered
                ? "mt-0 flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-surface-raised text-[0.72em] font-bold tabular-nums text-ink-soft"
                : "h-1.5 w-1.5 rounded-full bg-brand"
            )}
          >
            {block.ordered ? i + 1 : null}
          </span>
          <span className="min-w-0 text-ink-strong">
            {it.lead && <strong className="font-bold text-ink">{it.lead}</strong>}
            {it.lead ? " — " : ""}
            <TermText text={it.text} terms={terms} />
          </span>
        </li>
      ))}
    </Tag>
  );
}

/** Faktlar ro'yxati uchun kichik yordamchi (eski yassi konspektда ishlatiladi). */
export function FactItem({ text }: { text: string }) {
  return (
    <li className="flex gap-2.5 text-ink-strong">
      <Icon icon={CheckCircle2} size={16} className="mt-0.5 shrink-0 text-emerald" />
      <span>{text}</span>
    </li>
  );
}
