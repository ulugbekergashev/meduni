import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Icon, Input, Textarea, useToast } from "@meduni/ui";
import { useUpdateContent, type CaseJson, type ContentFull } from "../topics/api";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </div>
  );
}

export function CaseEditor({ content }: { content: ContentFull }) {
  const { t } = useTranslation(undefined, { keyPrefix: "caseEditor" });
  const navigate = useNavigate();
  const { show } = useToast();
  const update = useUpdateContent(content.id);

  const [draft, setDraft] = useState<CaseJson>(content.clinicalCase!.caseJson);
  const patch = (p: Partial<CaseJson>) => setDraft({ ...draft, ...p });

  const save = () => update.mutate(draft, { onSuccess: () => show(t("saved")) });

  // questions and referenceAnswer are paired by index.
  const rows = Math.max(draft.questions.length, draft.referenceAnswer.length);

  const setQA = (i: number, key: "questions" | "referenceAnswer", val: string) =>
    patch({ [key]: draft[key].map((x, j) => (j === i ? val : x)) } as Partial<CaseJson>);

  const addRow = () => patch({ questions: [...draft.questions, ""], referenceAnswer: [...draft.referenceAnswer, ""] });
  const removeRow = (i: number) =>
    patch({
      questions: draft.questions.filter((_, j) => j !== i),
      referenceAnswer: draft.referenceAnswer.filter((_, j) => j !== i),
    });

  return (
    <div>
      <button
        onClick={() => navigate(`/teach/topics/${content.topicId}`)}
        className="text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        {t("back")}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
        <Button onClick={save} disabled={update.isPending}>
          {t("save")}
        </Button>
      </div>

      {/* Patient case blocks */}
      <Card className="mt-6 space-y-5">
        <Block title={t("complaints")}>
          <Textarea value={draft.complaints} onChange={(e) => patch({ complaints: e.target.value })} />
        </Block>
        <Block title={t("anamnesis")}>
          <Textarea value={draft.anamnesis} onChange={(e) => patch({ anamnesis: e.target.value })} />
        </Block>
        <Block title={t("objectiveStatus")}>
          <Textarea value={draft.objectiveStatus} onChange={(e) => patch({ objectiveStatus: e.target.value })} />
        </Block>
        <Block title={t("labData")}>
          <Textarea value={draft.labData} onChange={(e) => patch({ labData: e.target.value })} />
        </Block>
      </Card>

      {/* Questions + reference answers, paired */}
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-ink-soft">
                {t("question")} {i + 1}
              </span>
              <button
                onClick={() => removeRow(i)}
                className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                aria-label="remove"
              >
                <Icon icon={Trash2} size={16} />
              </button>
            </div>
            <Input value={draft.questions[i] ?? ""} onChange={(e) => setQA(i, "questions", e.target.value)} placeholder={t("question")} />
            <div className="rounded-control bg-emerald-soft p-2">
              <p className="mb-1 text-[12px] font-semibold text-emerald">{t("referenceAnswer")}</p>
              <Textarea
                value={draft.referenceAnswer[i] ?? ""}
                onChange={(e) => setQA(i, "referenceAnswer", e.target.value)}
                placeholder={t("answer")}
              />
            </div>
          </Card>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={15} /> {t("addQuestion")}
      </button>
    </div>
  );
}
