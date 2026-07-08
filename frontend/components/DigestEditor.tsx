"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

/* Структура digest_json совпадает с backend/app/ai/prompts/digest.py (схема v1). */
type Bilingual = { uz: string; ru: string };
type Concept = { title_uz: string; title_ru: string; body_uz: string; body_ru: string };
type Term = { uz: string; ru: string; lat?: string };

export type Digest = {
  learning_objectives: Bilingual[];
  key_concepts: Concept[];
  terms: Term[];
  key_facts: Bilingual[];
  illustration_ideas: Bilingual[];
};

function TextRow({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
    />
  );
}

function Section({ title, children, onAdd }: {
  title: string;
  children: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <button onClick={onAdd} className="text-xl leading-none text-teal-600 hover:text-teal-700">+</button>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function RemovableGrid({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="group relative rounded-lg bg-slate-50/60 p-2 pr-8">
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 text-slate-300 hover:text-rose-500"
        title="×"
      >
        ×
      </button>
    </div>
  );
}

export default function DigestEditor({
  initial,
  onSave,
  saving,
  saved,
}: {
  initial: Digest;
  onSave: (digest: Digest) => void;
  saving: boolean;
  saved: boolean;
}) {
  const t = useTranslations("topics");
  const [digest, setDigest] = useState<Digest>(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDigest(initial);
    setDirty(false);
  }, [initial]);

  const patch = (next: Digest) => {
    setDigest(next);
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Section
        title={t("objectives")}
        onAdd={() => patch({ ...digest, learning_objectives: [...digest.learning_objectives, { uz: "", ru: "" }] })}
      >
        {digest.learning_objectives.map((item, i) => (
          <RemovableGrid key={i} onRemove={() =>
            patch({ ...digest, learning_objectives: digest.learning_objectives.filter((_, j) => j !== i) })
          }>
            <TextRow value={item.uz} placeholder="uz" onChange={(v) => {
              const arr = [...digest.learning_objectives]; arr[i] = { ...arr[i], uz: v };
              patch({ ...digest, learning_objectives: arr });
            }} />
            <TextRow value={item.ru} placeholder="ru" onChange={(v) => {
              const arr = [...digest.learning_objectives]; arr[i] = { ...arr[i], ru: v };
              patch({ ...digest, learning_objectives: arr });
            }} />
          </RemovableGrid>
        ))}
      </Section>

      <Section
        title={t("concepts")}
        onAdd={() => patch({ ...digest, key_concepts: [...digest.key_concepts, { title_uz: "", title_ru: "", body_uz: "", body_ru: "" }] })}
      >
        {digest.key_concepts.map((item, i) => (
          <RemovableGrid key={i} onRemove={() =>
            patch({ ...digest, key_concepts: digest.key_concepts.filter((_, j) => j !== i) })
          }>
            <TextRow value={item.title_uz} placeholder="Sarlavha (uz)" onChange={(v) => {
              const arr = [...digest.key_concepts]; arr[i] = { ...arr[i], title_uz: v };
              patch({ ...digest, key_concepts: arr });
            }} />
            <TextRow value={item.title_ru} placeholder="Заголовок (ru)" onChange={(v) => {
              const arr = [...digest.key_concepts]; arr[i] = { ...arr[i], title_ru: v };
              patch({ ...digest, key_concepts: arr });
            }} />
            <TextRow value={item.body_uz} placeholder="Matn (uz)" onChange={(v) => {
              const arr = [...digest.key_concepts]; arr[i] = { ...arr[i], body_uz: v };
              patch({ ...digest, key_concepts: arr });
            }} />
            <TextRow value={item.body_ru} placeholder="Текст (ru)" onChange={(v) => {
              const arr = [...digest.key_concepts]; arr[i] = { ...arr[i], body_ru: v };
              patch({ ...digest, key_concepts: arr });
            }} />
          </RemovableGrid>
        ))}
      </Section>

      <Section
        title={t("terms")}
        onAdd={() => patch({ ...digest, terms: [...digest.terms, { uz: "", ru: "", lat: "" }] })}
      >
        {digest.terms.map((item, i) => (
          <div key={i} className="group relative grid gap-2 rounded-lg bg-slate-50/60 p-2 pr-8 sm:grid-cols-3">
            <TextRow value={item.uz} placeholder="uz" onChange={(v) => {
              const arr = [...digest.terms]; arr[i] = { ...arr[i], uz: v };
              patch({ ...digest, terms: arr });
            }} />
            <TextRow value={item.ru} placeholder="ru" onChange={(v) => {
              const arr = [...digest.terms]; arr[i] = { ...arr[i], ru: v };
              patch({ ...digest, terms: arr });
            }} />
            <TextRow value={item.lat ?? ""} placeholder="lat" onChange={(v) => {
              const arr = [...digest.terms]; arr[i] = { ...arr[i], lat: v };
              patch({ ...digest, terms: arr });
            }} />
            <button onClick={() => patch({ ...digest, terms: digest.terms.filter((_, j) => j !== i) })}
                    className="absolute right-1.5 top-1.5 text-slate-300 hover:text-rose-500">×</button>
          </div>
        ))}
      </Section>

      <Section
        title={t("facts")}
        onAdd={() => patch({ ...digest, key_facts: [...digest.key_facts, { uz: "", ru: "" }] })}
      >
        {digest.key_facts.map((item, i) => (
          <RemovableGrid key={i} onRemove={() =>
            patch({ ...digest, key_facts: digest.key_facts.filter((_, j) => j !== i) })
          }>
            <TextRow value={item.uz} placeholder="uz" onChange={(v) => {
              const arr = [...digest.key_facts]; arr[i] = { ...arr[i], uz: v };
              patch({ ...digest, key_facts: arr });
            }} />
            <TextRow value={item.ru} placeholder="ru" onChange={(v) => {
              const arr = [...digest.key_facts]; arr[i] = { ...arr[i], ru: v };
              patch({ ...digest, key_facts: arr });
            }} />
          </RemovableGrid>
        ))}
      </Section>

      <Section
        title={t("illustrations")}
        onAdd={() => patch({ ...digest, illustration_ideas: [...digest.illustration_ideas, { uz: "", ru: "" }] })}
      >
        {digest.illustration_ideas.map((item, i) => (
          <RemovableGrid key={i} onRemove={() =>
            patch({ ...digest, illustration_ideas: digest.illustration_ideas.filter((_, j) => j !== i) })
          }>
            <TextRow value={item.uz} placeholder="uz" onChange={(v) => {
              const arr = [...digest.illustration_ideas]; arr[i] = { ...arr[i], uz: v };
              patch({ ...digest, illustration_ideas: arr });
            }} />
            <TextRow value={item.ru} placeholder="ru" onChange={(v) => {
              const arr = [...digest.illustration_ideas]; arr[i] = { ...arr[i], ru: v };
              patch({ ...digest, illustration_ideas: arr });
            }} />
          </RemovableGrid>
        ))}
      </Section>

      <div className="sticky bottom-4 flex items-center gap-3">
        <Button onClick={() => { onSave(digest); setDirty(false); }} disabled={saving}>
          {saving ? t("generating") : t("save")}
        </Button>
        {saved && !dirty && <span className="text-sm text-emerald-600">{t("saved")}</span>}
        {dirty && <span className="text-sm text-amber-600">●</span>}
      </div>
    </div>
  );
}
