import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, Select, cls, useToast, type BadgeTone } from "@meduni/ui";
import { useUpdateContent, type ContentFull, type Difficulty, type QuizQuestion } from "../topics/api";

const diffTone: Record<Difficulty, BadgeTone> = { RECALL: "blue", UNDERSTAND: "violet", APPLY: "amber" };
const DIFFS: Difficulty[] = ["RECALL", "UNDERSTAND", "APPLY"];

function emptyQuestion(): QuizQuestion {
  return { text: "", options: ["", "", "", ""], correctIndex: 0, explanations: ["", "", "", ""], difficulty: "RECALL", sourceFragment: null };
}

export function QuizEditor({ content }: { content: ContentFull }) {
  const { t } = useTranslation(undefined, { keyPrefix: "quizEditor" });
  const navigate = useNavigate();
  const { show } = useToast();
  const update = useUpdateContent(content.id);

  const [questions, setQuestions] = useState<QuizQuestion[]>(content.quiz!.questions);
  const [passThreshold, setPassThreshold] = useState(String(content.quiz!.passThreshold));

  const patchQ = (i: number, p: Partial<QuizQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...p } : q)));

  const setOption = (qi: number, oi: number, val: string) =>
    patchQ(qi, { options: questions[qi].options.map((o, j) => (j === oi ? val : o)) });
  const setExplanation = (qi: number, oi: number, val: string) =>
    patchQ(qi, { explanations: questions[qi].explanations.map((e, j) => (j === oi ? val : e)) });

  const save = () =>
    update.mutate(
      { passThreshold: Number(passThreshold), questions },
      { onSuccess: () => show(t("saved")) }
    );

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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            {t("passThreshold")}
            <input
              type="number"
              min={0}
              max={100}
              value={passThreshold}
              onChange={(e) => setPassThreshold(e.target.value)}
              className="w-16 rounded-control border border-line px-2 py-1 text-[13px]"
            />
          </label>
          <Button onClick={save} disabled={update.isPending}>
            {t("save")}
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <Card className="mt-6">
          <p className="py-6 text-center text-[13.5px] text-ink-soft">{t("empty")}</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {questions.map((q, qi) => (
            <Card key={qi} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-ink-soft">
                  {t("question")} {qi + 1}
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone={diffTone[q.difficulty]}>{t(`diff.${q.difficulty}`)}</Badge>
                  <Select
                    value={q.difficulty}
                    onChange={(e) => patchQ(qi, { difficulty: e.target.value as Difficulty })}
                    className="w-auto"
                  >
                    {DIFFS.map((d) => (
                      <option key={d} value={d}>
                        {t(`diff.${d}`)}
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== qi))}
                    className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                    aria-label={t("deleteQuestion")}
                  >
                    <Icon icon={Trash2} size={16} />
                  </button>
                </div>
              </div>

              <Input value={q.text} onChange={(e) => patchQ(qi, { text: e.target.value })} placeholder={t("questionText")} />

              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const correct = q.correctIndex === oi;
                  return (
                    <div
                      key={oi}
                      className={cls(
                        "rounded-control border p-2",
                        correct ? "border-emerald/40 bg-emerald-soft" : "border-line"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => patchQ(qi, { correctIndex: oi })}
                          className={cls(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            correct ? "border-emerald bg-emerald text-white" : "border-line text-transparent hover:border-emerald"
                          )}
                          aria-label={t("markCorrect")}
                        >
                          <Icon icon={Check} size={14} />
                        </button>
                        <Input value={opt} onChange={(e) => setOption(qi, oi, e.target.value)} placeholder={`${t("option")} ${oi + 1}`} />
                      </div>
                      <Input
                        value={q.explanations[oi] ?? ""}
                        onChange={(e) => setExplanation(qi, oi, e.target.value)}
                        placeholder={t("explanation")}
                        className="mt-2 text-[12.5px]"
                      />
                    </div>
                  );
                })}
              </div>

              {q.sourceFragment && (
                <p className="text-[12px] text-ink-faint">
                  {t("source")}: {q.sourceFragment}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <button
        onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
        className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={15} /> {t("addQuestion")}
      </button>
    </div>
  );
}
