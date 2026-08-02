import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestCheckpoint, DigestJson, DigestSection as DigestSectionData, Term } from "./api";

// ---- compact editable primitives ----

function EditableList({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="group flex items-center gap-1.5">
          <input
            value={item}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="w-full rounded-control border border-line px-2.5 py-1.5 text-body outline-none focus:border-brand"
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="rounded-control p-1 text-ink-faint opacity-0 transition-opacity hover:bg-rose-soft hover:text-rose group-hover:opacity-100"
            aria-label="remove"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1 text-note font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={13} /> {t("addItem")}
      </button>
    </div>
  );
}

function TermsTable({ terms, onChange }: { terms: Term[]; onChange: (next: Term[]) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const set = (i: number, key: keyof Term, val: string) =>
    onChange(terms.map((tm, j) => (j === i ? { ...tm, [key]: val } : tm)));
  const cell = "w-full rounded-control border border-line px-2.5 py-1.5 text-body outline-none focus:border-brand";

  return (
    <div className="space-y-1.5">
      <div className="hidden grid-cols-[1fr_1fr_1fr_24px] gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-faint sm:grid">
        <span>{t("termRu")}</span>
        <span>{t("termUz")}</span>
        <span>{t("termLat")}</span>
        <span />
      </div>
      {terms.map((tm, i) => (
        <div key={i} className="group grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[1fr_1fr_1fr_24px]">
          <input value={tm.ru} onChange={(e) => set(i, "ru", e.target.value)} placeholder={t("termRu")} className={cell} />
          <input value={tm.uz} onChange={(e) => set(i, "uz", e.target.value)} placeholder={t("termUz")} className={cell} />
          <input value={tm.lat} onChange={(e) => set(i, "lat", e.target.value)} placeholder={t("termLat")} className={cell} />
          <button
            onClick={() => onChange(terms.filter((_, j) => j !== i))}
            className="justify-self-end rounded-control p-1 text-ink-faint opacity-0 transition-opacity hover:bg-rose-soft hover:text-rose group-hover:opacity-100"
            aria-label="remove"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...terms, { ru: "", uz: "", lat: "" }])}
        className="inline-flex items-center gap-1 text-note font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={13} /> {t("addRow")}
      </button>
    </div>
  );
}

/** Bitta bo'lim checkpoint savolini tahrirlash — savol, 4 variant (to'g'risi
 *  radio bilan), izoh. O'qituvchi AI savolini ko'radi/tuzatadi/o'chiradi. */
function CheckpointCard({
  title,
  cp,
  onChange,
}: {
  title: string;
  cp: DigestCheckpoint | null;
  onChange: (next: DigestCheckpoint | null) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const cell = "w-full rounded-control border border-line px-2.5 py-1.5 text-body outline-none focus:border-brand";

  if (!cp) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-control border border-dashed border-line px-3 py-2">
        <span className="truncate text-note font-semibold text-ink-soft">{title}</span>
        <button
          onClick={() => onChange({ question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" })}
          className="inline-flex shrink-0 items-center gap-1 text-note font-medium text-brand-deep hover:underline"
        >
          <Icon icon={Plus} size={13} /> {t("checkpointAdd")}
        </button>
      </div>
    );
  }

  const set = (p: Partial<DigestCheckpoint>) => onChange({ ...cp, ...p });
  return (
    <div className="space-y-2 rounded-control border border-line bg-bg/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-note font-bold text-ink">{title}</span>
        <button
          onClick={() => onChange(null)}
          className="rounded-control p-1 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose"
          aria-label={t("checkpointRemove")}
          title={t("checkpointRemove")}
        >
          <Icon icon={Trash2} size={14} />
        </button>
      </div>
      <input
        value={cp.question}
        onChange={(e) => set({ question: e.target.value })}
        placeholder={t("checkpointQuestion")}
        className={cls(cell, "font-semibold")}
      />
      <div className="space-y-1.5">
        {cp.options.map((opt, oi) => (
          <div key={oi} className="group flex items-center gap-1.5">
            <input
              type="radio"
              checked={cp.correctIndex === oi}
              onChange={() => set({ correctIndex: oi })}
              className="h-4 w-4 shrink-0 accent-emerald"
              aria-label={t("checkpointCorrect")}
            />
            <input
              value={opt}
              onChange={(e) => set({ options: cp.options.map((x, j) => (j === oi ? e.target.value : x)) })}
              placeholder={`${t("checkpointOption")} ${oi + 1}`}
              className={cls(cell, cp.correctIndex === oi && "border-emerald/50")}
            />
            <button
              onClick={() => {
                const nextOpts = cp.options.filter((_, j) => j !== oi);
                set({ options: nextOpts, correctIndex: Math.max(0, Math.min(cp.correctIndex, nextOpts.length - 1)) });
              }}
              disabled={cp.options.length <= 2}
              className="rounded-control p-1 text-ink-faint opacity-0 transition-opacity hover:bg-rose-soft hover:text-rose group-hover:opacity-100 disabled:opacity-0"
              aria-label="remove"
            >
              <Icon icon={Trash2} size={13} />
            </button>
          </div>
        ))}
        {cp.options.length < 6 && (
          <button
            onClick={() => set({ options: [...cp.options, ""] })}
            className="inline-flex items-center gap-1 text-note font-medium text-brand-deep hover:underline"
          >
            <Icon icon={Plus} size={13} /> {t("checkpointOption")}
          </button>
        )}
      </div>
      <textarea
        value={cp.explanation}
        onChange={(e) => set({ explanation: e.target.value })}
        placeholder={t("checkpointExplanation")}
        rows={2}
        className={cls(cell, "resize-none")}
      />
    </div>
  );
}

/** Collapsible block: header shows title + item count; closed by default. */
function Block({ title, count, defaultOpen = false, children }: { title: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 py-2.5 text-left">
        <span className="text-body font-bold text-ink">{title}</span>
        <span className="rounded-pill bg-bg px-2 py-0.5 text-[12.5px] font-semibold text-ink-soft">{count}</span>
        <Icon icon={ChevronDown} size={15} className={cls("ml-auto text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

/**
 * Konspekt TAHRIRLAGICHI — 20-60+ input maydoni.
 *
 * 2026-08-02: bu endi sukut bo'yicha ko'rinmaydi. Konstruktorga kirganda
 * `DigestPreview` (o'qish) chiziladi; bu yerga faqat "Tahrirlash" bosilganda
 * o'tiladi. Sabab: o'qituvchi qadamni ochishi bilan devor bo'lib turgan
 * formani ko'rib qo'rqib ketardi.
 */
export function DigestEditor({
  draft,
  onPatch,
  sections,
  onSetCheckpoint,
}: {
  draft: DigestJson;
  onPatch: (p: Partial<DigestJson>) => void;
  sections: DigestSectionData[];
  onSetCheckpoint: (index: number, cp: DigestCheckpoint | null) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const checkpointCount = sections.filter((s) => s.checkpoint).length;

  return (
    <>
      <div className="px-5 pt-2">
        <Block title={t("objectives")} count={draft.objectives.length}>
          <EditableList items={draft.objectives} onChange={(v) => onPatch({ objectives: v })} />
        </Block>
        <Block title={t("concepts")} count={draft.concepts.length}>
          <EditableList items={draft.concepts} onChange={(v) => onPatch({ concepts: v })} />
        </Block>
        <Block title={t("terms")} count={draft.terms.length}>
          <TermsTable terms={draft.terms} onChange={(v) => onPatch({ terms: v })} />
        </Block>
        <Block title={t("facts")} count={draft.facts.length}>
          <EditableList items={draft.facts} onChange={(v) => onPatch({ facts: v })} />
        </Block>
        <Block title={t("imageIdeas")} count={draft.imageIdeas.length}>
          <EditableList items={draft.imageIdeas} onChange={(v) => onPatch({ imageIdeas: v })} />
        </Block>
        {sections.length > 0 && (
          <Block title={t("checkpoints")} count={checkpointCount}>
            <p className="mb-2 text-note text-ink-soft">{t("checkpointsHint")}</p>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <CheckpointCard key={s.id ?? i} title={s.title} cp={s.checkpoint ?? null} onChange={(cp) => onSetCheckpoint(i, cp)} />
              ))}
            </div>
          </Block>
        )}
      </div>

      {/* Dosages — medically sensitive, always visible */}
      <div className="mx-5 my-3 rounded-control border border-amber/30 bg-amber-soft p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon icon={TriangleAlert} size={15} className="text-amber" />
          <h3 className="text-note font-bold uppercase tracking-wide text-amber">{t("dosages")}</h3>
          <span className="text-[12.5px] text-ink-soft">— {t("dosagesNote")}</span>
        </div>
        <EditableList items={draft.dosages} onChange={(v) => onPatch({ dosages: v })} />
      </div>
    </>
  );
}
