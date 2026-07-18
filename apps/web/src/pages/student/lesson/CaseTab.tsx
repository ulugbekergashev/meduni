import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, FlaskConical, HeartPulse, Stethoscope, User } from "lucide-react";
import { Card, Icon, Textarea, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useSubmitCase, type CaseTabData } from "../api";

function Block({ icon, title, text }: { icon: typeof User; title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink-soft">
        <Icon icon={icon} size={14} />
        {title}
      </h4>
      <p className="whitespace-pre-line text-[14.5px] text-ink">{text}</p>
    </div>
  );
}

export function CaseTab({ topicId, data }: { topicId: number; data: CaseTabData }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const { show } = useToast();
  const submit = useSubmitCase(topicId);
  const [answers, setAnswers] = useState<string[]>(data.questions.map(() => ""));
  const [confirm, setConfirm] = useState(false);
  const attempt = data.attempt;

  const allFilled = answers.every((a) => a.trim().length > 0);

  const doSubmit = () =>
    submit.mutate(
      { caseId: data.caseId, answers },
      { onSuccess: () => { setConfirm(false); show(t("submitted")); } }
    );

  return (
    <div className="space-y-4">
      {/* Case blocks */}
      <Card className="space-y-4">
        <Block icon={User} title={t("caseComplaints")} text={data.blocks.complaints} />
        <Block icon={HeartPulse} title={t("caseAnamnesis")} text={data.blocks.anamnesis} />
        <Block icon={Stethoscope} title={t("caseObjective")} text={data.blocks.objectiveStatus} />
        <Block icon={FlaskConical} title={t("caseLab")} text={data.blocks.labData} />
      </Card>

      {/* Answer / review */}
      {data.questions.map((q, i) => (
        <Card key={i} className="space-y-3">
          <p className="text-[15px] font-semibold text-ink">
            {i + 1}. {q}
          </p>

          {attempt ? (
            <>
              <div className="rounded-control border border-line bg-bg p-3 text-[14.5px] text-ink">{attempt.answers[i]}</div>
              <div className="rounded-control bg-emerald-soft p-3">
                <p className="mb-1 text-[13px] font-bold text-emerald">{t("referenceAnswer")}</p>
                <p className="text-[14.5px] text-ink">{attempt.referenceAnswer[i]}</p>
              </div>
            </>
          ) : (
            <Textarea
              value={answers[i]}
              onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t("yourAnswerPlaceholder")}
              rows={3}
            />
          )}
        </Card>
      ))}

      {/* Submit or status */}
      {attempt ? (
        attempt.reviewed ? (
          <Card className="space-y-2 border-emerald/40 bg-emerald-soft">
            <div className="flex items-center gap-2 text-emerald">
              <Icon icon={ClipboardCheck} size={18} />
              <p className="text-[16px] font-bold">
                {t("grade")}: {attempt.score}
              </p>
            </div>
            {attempt.teacherFeedback && <p className="text-[14.5px] text-ink">{attempt.teacherFeedback}</p>}
          </Card>
        ) : (
          <div className="rounded-control bg-amber-soft px-3 py-2.5 text-[14px] font-medium text-amber">{t("underReview")}</div>
        )
      ) : (
        <button
          onClick={() => setConfirm(true)}
          disabled={!allFilled || submit.isPending}
          className="w-full rounded-control bg-rose px-4 py-3 text-[16px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {t("submitCase")}
        </button>
      )}

      <ConfirmDialog
        open={confirm}
        title={t("submitCaseTitle")}
        message={t("submitCaseConfirm")}
        confirmLabel={t("submitCase")}
        confirmVariant="primary"
        loading={submit.isPending}
        onConfirm={doSubmit}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
