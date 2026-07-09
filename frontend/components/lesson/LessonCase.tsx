"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";

type Bilingual = { uz: string; ru: string };
type CaseJson = {
  complaints?: Bilingual; anamnesis?: Bilingual; objective?: Bilingual;
  labs?: Bilingual; questions?: Bilingual[]; reference_analysis?: Bilingual;
};
type CaseView = {
  content_id: number;
  case_id: number;
  case_json: CaseJson;
  submitted: boolean;
  my_answers: string[];
  teacher_feedback: string | null;
  score: number | null;
  reviewed: boolean;
};

function Block({ label, value }: { label: string; value?: Bilingual }) {
  const locale = useLocale();
  if (!value) return null;
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{locale === "ru" ? value.ru : value.uz}</p>
    </div>
  );
}

export default function LessonCase({ caseView, onDone }: { caseView: CaseView; onDone: () => void }) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const c = caseView.case_json;
  const questions = c.questions ?? [];
  const [answers, setAnswers] = useState<string[]>(
    caseView.submitted ? caseView.my_answers : questions.map(() => ""),
  );
  const [reference, setReference] = useState<Bilingual | null>(c.reference_analysis ?? null);

  const submit = useMutation({
    mutationFn: () =>
      api<{ reference_analysis: Bilingual }>(`/me/learn/cases/${caseView.content_id}/submit`, {
        method: "POST",
        body: { answers },
      }),
    onSuccess: (data) => {
      setReference(data.reference_analysis);
      onDone();
    },
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <Block label={t("complaints")} value={c.complaints} />
        <Block label={t("anamnesis")} value={c.anamnesis} />
        <Block label={t("objective")} value={c.objective} />
        <Block label={t("labs")} value={c.labs} />
      </Card>

      <Card className="space-y-4 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("caseQuestions")}</p>
        {questions.map((q, i) => (
          <div key={i}>
            <p className="mb-1.5 text-sm font-medium text-slate-800">
              {i + 1}. {locale === "ru" ? q.ru : q.uz}
            </p>
            <textarea
              value={answers[i] ?? ""}
              disabled={caseView.submitted}
              onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
            />
          </div>
        ))}
        {!caseView.submitted ? (
          <Button onClick={() => submit.mutate()}
                  disabled={submit.isPending || answers.every((a) => !a.trim())}>
            {t("caseSubmit")}
          </Button>
        ) : (
          <Badge tone="green">{t("caseSubmitted")}</Badge>
        )}
      </Card>

      {caseView.reviewed && (
        <Card className="space-y-2 p-5 ring-1 ring-teal-200">
          <p className="text-sm font-semibold text-teal-700">{t("teacherFeedback")}</p>
          {caseView.score !== null && <Badge tone="teal">{t("score")}: {caseView.score}/100</Badge>}
          <p className="text-sm text-slate-700">{caseView.teacher_feedback}</p>
        </Card>
      )}

      {reference && (
        <Card className="space-y-1 p-5 ring-1 ring-emerald-200">
          <p className="text-sm font-semibold text-emerald-700">{t("referenceAnalysis")}</p>
          <p className="text-sm text-slate-700">{locale === "ru" ? reference.ru : reference.uz}</p>
        </Card>
      )}
    </div>
  );
}
