import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button, Card, Icon, Input, Textarea, useToast } from "@meduni/ui";
import { useUpdateContent, type CaseJson, type CaseStepJson, type ContentFull } from "../topics/api";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
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

  // ---- v2 — bemor kartasi + qadamlar (eski keyslarda steps bo'lmaydi) ----
  const steps = draft.steps ?? [];
  const setSteps = (next: CaseStepJson[]) => patch({ steps: next });
  const patchStep = (si: number, p: Partial<CaseStepJson>) =>
    setSteps(steps.map((s, j) => (j === si ? { ...s, ...p } : s)));
  const patchOption = (si: number, oi: number, p: Partial<CaseStepJson["options"][number]>) =>
    patchStep(si, { options: steps[si].options.map((o, j) => (j === oi ? { ...o, ...p } : o)) });
  /** To'g'ri javob faqat bitta bo'ladi — tanlanganda qolganlari o'chadi. */
  const markCorrect = (si: number, oi: number) =>
    patchStep(si, { options: steps[si].options.map((o, j) => ({ ...o, correct: j === oi })) });
  const addOption = (si: number) =>
    patchStep(si, { options: [...steps[si].options, { text: "", correct: false, feedback: "" }] });
  const removeOption = (si: number, oi: number) =>
    patchStep(si, { options: steps[si].options.filter((_, j) => j !== oi) });
  const addStep = () =>
    setSteps([
      ...steps,
      { title: "", prompt: "", options: [{ text: "", correct: true, feedback: "" }, { text: "", correct: false, feedback: "" }] },
    ]);
  const removeStep = (si: number) => setSteps(steps.filter((_, j) => j !== si));

  const vitals = draft.vitals ?? {};
  const patchVitals = (p: Partial<NonNullable<CaseJson["vitals"]>>) => patch({ vitals: { ...vitals, ...p } });

  return (
    <div>
      <button
        onClick={() => navigate(`/teach/topics/${content.topicId}`)}
        className="text-[14.5px] font-medium text-brand-deep hover:underline"
      >
        {t("back")}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
        <Button onClick={save} disabled={update.isPending}>
          {t("save")}
        </Button>
      </div>

      {/* v2 — bemor kartasi (talabaga keys boshida ko'rinadi) */}
      <Card className="mt-3 space-y-5">
        <Block title={t("patient")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={draft.patientName ?? ""}
              onChange={(e) => patch({ patientName: e.target.value })}
              placeholder={t("patientName")}
            />
            <Input
              value={draft.patientInfo ?? ""}
              onChange={(e) => patch({ patientInfo: e.target.value })}
              placeholder={t("patientInfo")}
            />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Input value={vitals.bp ?? ""} onChange={(e) => patchVitals({ bp: e.target.value })} placeholder={t("vitalsBp")} />
            <Input value={vitals.pulse ?? ""} onChange={(e) => patchVitals({ pulse: e.target.value })} placeholder={t("vitalsPulse")} />
            <Input value={vitals.spo2 ?? ""} onChange={(e) => patchVitals({ spo2: e.target.value })} placeholder={t("vitalsSpo2")} />
            <Input value={vitals.temp ?? ""} onChange={(e) => patchVitals({ temp: e.target.value })} placeholder={t("vitalsTemp")} />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-faint">{t("vitalsHint")}</p>
        </Block>

        {/* Modul 28 — virtual bemor ssenariysi (talaba roleplay'ida qo'llanadi) */}
        <Block title={t("behavior")}>
          <Textarea
            value={draft.patientBehavior ?? ""}
            onChange={(e) => patch({ patientBehavior: e.target.value })}
            placeholder={t("behaviorPlaceholder")}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(t("behaviorTemplates", { returnObjects: true }) as string[]).map((tpl) => (
              <button
                key={tpl}
                onClick={() =>
                  patch({ patientBehavior: (draft.patientBehavior ? draft.patientBehavior.trim() + " " : "") + tpl })
                }
                className="rounded-pill border border-line px-3 py-1 text-[13px] font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-tint"
              >
                + {tpl}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-faint">{t("behaviorHint")}</p>
        </Block>
      </Card>

      {/* Patient case blocks */}
      <Card className="mt-3 space-y-5">
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

      {/* v2 — bosqichma-bosqich qarorlar. To'g'ri javob va izohni o'qituvchi tekshiradi. */}
      <div className="mt-5">
        <h3 className="mb-2 text-[14px] font-bold uppercase tracking-wide text-ink-soft">{t("steps")}</h3>
        {steps.length === 0 ? (
          <p className="rounded-control border border-dashed border-line px-3 py-2.5 text-[13px] text-ink-faint">
            {t("stepsEmpty")}
          </p>
        ) : (
          <div className="space-y-3">
            {steps.map((s, si) => (
              <Card key={si} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-bold text-ink-soft">
                    {t("step")} {si + 1}
                  </span>
                  <button
                    onClick={() => removeStep(si)}
                    className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                    aria-label="remove step"
                  >
                    <Icon icon={Trash2} size={16} />
                  </button>
                </div>
                <Input value={s.title} onChange={(e) => patchStep(si, { title: e.target.value })} placeholder={t("stepTitle")} />
                <Textarea value={s.prompt} onChange={(e) => patchStep(si, { prompt: e.target.value })} placeholder={t("stepPrompt")} />

                <div className="space-y-2">
                  {s.options.map((o, oi) => (
                    <div
                      key={oi}
                      className={`rounded-control border p-2 ${o.correct ? "border-emerald bg-emerald-soft" : "border-line"}`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => markCorrect(si, oi)}
                          title={t("markCorrect")}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-[13px] font-bold ${
                            o.correct ? "bg-emerald text-white" : "bg-bg text-ink-faint hover:text-ink"
                          }`}
                        >
                          {o.correct ? <Icon icon={Check} size={14} /> : String.fromCharCode(65 + oi)}
                        </button>
                        <Input
                          value={o.text}
                          onChange={(e) => patchOption(si, oi, { text: e.target.value })}
                          placeholder={t("optionText")}
                        />
                        <button
                          onClick={() => removeOption(si, oi)}
                          className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                          aria-label="remove option"
                        >
                          <Icon icon={Trash2} size={15} />
                        </button>
                      </div>
                      <Textarea
                        className="mt-2"
                        value={o.feedback}
                        onChange={(e) => patchOption(si, oi, { feedback: e.target.value })}
                        placeholder={t("optionFeedback")}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(si)}
                    className="inline-flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline"
                  >
                    <Icon icon={Plus} size={15} /> {t("addOption")}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
        <button
          onClick={addStep}
          className="mt-3 inline-flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline"
        >
          <Icon icon={Plus} size={15} /> {t("addStep")}
        </button>
      </div>

      {/* Questions + reference answers, paired */}
      <h3 className="mb-2 mt-5 text-[14px] font-bold uppercase tracking-wide text-ink-soft">{t("questions")}</h3>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-ink-soft">
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
              <p className="mb-1 text-[13px] font-semibold text-emerald">{t("referenceAnswer")}</p>
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
        className="mt-4 inline-flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={15} /> {t("addQuestion")}
      </button>
    </div>
  );
}
