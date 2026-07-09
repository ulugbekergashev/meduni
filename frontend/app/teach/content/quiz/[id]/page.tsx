"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconCheck, IconHome, IconPlus, IconSparkles, IconTrash } from "@/components/Icons";
import ReadinessPanel from "@/components/ReadinessPanel";
import Shell from "@/components/Shell";
import { Badge, Button, Card, cls } from "@/components/ui";
import { api, downloadFile } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Bilingual = { uz: string; ru: string };
type Question = {
  id: number;
  question_uz: string;
  question_ru: string;
  options_json: Bilingual[];
  correct_index: number;
  explanations_json: Bilingual[];
  difficulty: string;
  source_fragment: string | null;
  factcheck_status: string;
  factcheck_note: string | null;
};
type QuizDetail = {
  content: { id: number; status: string; topic_id: number };
  pass_threshold: number;
  max_attempts: number;
  questions: Question[];
};

function TA({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
      className={cls("w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20", className)} />
  );
}

export default function QuizEditorPage() {
  const { me } = useRequireRole(["teacher", "admin"]);
  const t = useTranslations("content");
  const tn = useTranslations("nav");
  const params = useParams();
  const contentId = Number(params.id);
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passThreshold, setPassThreshold] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["quiz", contentId],
    queryFn: () => api<QuizDetail>(`/quizzes/${contentId}`),
    enabled: !!me,
  });

  useEffect(() => {
    if (data) {
      setQuestions(data.questions);
      setPassThreshold(data.pass_threshold);
      setMaxAttempts(data.max_attempts);
    }
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quiz", contentId] });

  const save = useMutation({
    mutationFn: () =>
      api(`/quizzes/${contentId}`, {
        method: "PUT",
        body: {
          pass_threshold: passThreshold,
          max_attempts: maxAttempts,
          questions: questions.map((q) => ({
            question_uz: q.question_uz, question_ru: q.question_ru,
            options_json: q.options_json, correct_index: q.correct_index,
            explanations_json: q.explanations_json, difficulty: q.difficulty,
            source_fragment: q.source_fragment,
          })),
        },
      }),
    onSuccess: () => { setSaved(true); invalidate(); },
  });

  const resolveFlag = useMutation({
    mutationFn: (questionId: number) => api(`/questions/${questionId}/resolve-flag`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const patchQ = (i: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
    setSaved(false);
  };

  if (!me || !data) return null;
  const published = data.content.status === "published";
  const download = (format: string) => {
    const ext = format === "moodle_xml" ? "xml" : format === "gift" ? "gift.txt" : "pdf";
    downloadFile(`/quizzes/${contentId}/export?format=${format}&lang=ru`, `quiz_${contentId}.${ext}`);
  };

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href={`/teach/topics/${data.content.topic_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("backToTopic")}
      </Link>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconSparkles className="text-teal-600" /> {t("quiz")}
      </h1>

      {published && (
        <p className="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{t("publishedLocked")}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {/* Настройки */}
          <Card className="flex flex-wrap gap-4 p-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">{t("passThreshold")}</span>
              <input type="number" min={1} max={100} value={passThreshold} disabled={published}
                     onChange={(e) => { setPassThreshold(Number(e.target.value)); setSaved(false); }}
                     className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">{t("maxAttempts")}</span>
              <input type="number" min={1} max={10} value={maxAttempts} disabled={published}
                     onChange={(e) => { setMaxAttempts(Number(e.target.value)); setSaved(false); }}
                     className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </Card>

          {questions.map((q, i) => (
            <Card key={i} className={cls("p-4", q.factcheck_status === "flagged" && "ring-2 ring-rose-400/40")}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">{t("question")} {i + 1}</span>
                <div className="flex items-center gap-2">
                  <select value={q.difficulty} disabled={published}
                          onChange={(e) => patchQ(i, { difficulty: e.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                    <option value="recall">{t("recall")}</option>
                    <option value="understand">{t("understand")}</option>
                    <option value="apply">{t("apply")}</option>
                  </select>
                  {!published && (
                    <button onClick={() => { setQuestions((qs) => qs.filter((_, j) => j !== i)); setSaved(false); }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <IconTrash className="text-base" />
                    </button>
                  )}
                </div>
              </div>

              {q.factcheck_status === "flagged" && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2">
                  <p className="text-sm text-rose-700">
                    <strong>{t("factcheckFlag")}.</strong> {q.factcheck_note}
                  </p>
                  <button onClick={() => resolveFlag.mutate(q.id)}
                          className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
                    {t("confirmFlag")}
                  </button>
                </div>
              )}
              {q.factcheck_status === "resolved" && (
                <Badge tone="green">{t("factcheckResolved")}</Badge>
              )}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <TA value={q.question_uz} placeholder="Savol (uz)" onChange={(v) => patchQ(i, { question_uz: v })} />
                <TA value={q.question_ru} placeholder="Вопрос (ru)" onChange={(v) => patchQ(i, { question_ru: v })} />
              </div>

              <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">{t("options")}</p>
              <div className="space-y-2">
                {q.options_json.map((opt, oi) => (
                  <div key={oi} className={cls("flex items-start gap-2 rounded-lg p-2",
                    oi === q.correct_index ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50")}>
                    <button onClick={() => patchQ(i, { correct_index: oi })} disabled={published}
                            title={t("correct")}
                            className={cls("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                              oi === q.correct_index ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
                      {oi === q.correct_index && <IconCheck className="text-[10px]" />}
                    </button>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <TA value={opt.uz} placeholder={`${String.fromCharCode(65 + oi)} (uz)`}
                          onChange={(v) => {
                            const options = [...q.options_json]; options[oi] = { ...options[oi], uz: v };
                            patchQ(i, { options_json: options });
                          }} />
                      <TA value={opt.ru} placeholder={`${String.fromCharCode(65 + oi)} (ru)`}
                          onChange={(v) => {
                            const options = [...q.options_json]; options[oi] = { ...options[oi], ru: v };
                            patchQ(i, { options_json: options });
                          }} />
                    </div>
                  </div>
                ))}
              </div>
              {q.source_fragment && (
                <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs italic text-slate-400">
                  {t("sourceFragment")}: {q.source_fragment}
                </p>
              )}
            </Card>
          ))}

          {!published && (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => {
                setQuestions((qs) => [...qs, {
                  id: -Date.now(), question_uz: "", question_ru: "",
                  options_json: [{ uz: "", ru: "" }, { uz: "", ru: "" }, { uz: "", ru: "" }, { uz: "", ru: "" }],
                  correct_index: 0, explanations_json: [], difficulty: "understand",
                  source_fragment: null, factcheck_status: "resolved", factcheck_note: null,
                }]);
                setSaved(false);
              }}>
                <IconPlus /> {t("addQuestion")}
              </Button>
            </div>
          )}
        </div>

        {/* Правая колонка: сохранение, готовность, экспорт */}
        <div className="space-y-4">
          {!published && (
            <div className="flex items-center gap-3">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
              {saved && <span className="text-sm text-emerald-600">{t("saved")}</span>}
            </div>
          )}
          <ReadinessPanel contentId={contentId} status={data.content.status} onChanged={invalidate} />
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("export")}</h3>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => download("moodle_xml")}>{t("exportMoodle")}</Button>
              <Button variant="outline" onClick={() => download("gift")}>{t("exportGift")}</Button>
              <Button variant="outline" onClick={() => download("pdf")}>{t("exportPdf")}</Button>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
