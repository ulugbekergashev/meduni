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
    <div className="grid gap-6 items-start lg:grid-cols-[1fr_1fr] xl:grid-cols-[450px_1fr]">
      {/* Chap qism: Bemor ma'lumotlari (Sticky) */}
      <div className="space-y-4 lg:sticky lg:top-6">
        <Card className="space-y-5 border-l-4 border-l-brand shadow-sm">
          <div className="border-b border-line pb-3">
            <h3 className="text-[18px] font-black text-ink">Bemor varaqasi</h3>
            <p className="text-[13px] text-ink-soft mt-0.5">Tashxis qo'yish uchun asosiy ma'lumotlar</p>
          </div>
          <Block icon={User} title={t("caseComplaints")} text={data.blocks.complaints} />
          <Block icon={HeartPulse} title={t("caseAnamnesis")} text={data.blocks.anamnesis} />
          <Block icon={Stethoscope} title={t("caseObjective")} text={data.blocks.objectiveStatus} />
          
          {data.blocks.labData && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink-soft">
                <Icon icon={FlaskConical} size={14} />
                {t("caseLab")}
              </h4>
              <div className="rounded-[8px] bg-blue-soft p-3 text-[14px] leading-relaxed text-ink border border-blue/20">
                <div className="whitespace-pre-line font-mono text-[13px] text-ink-soft">
                  {data.blocks.labData}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* O'ng qism: Savollar va Javoblar */}
      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <Card key={i} className="space-y-3 shadow-sm transition-all hover:border-brand/40">
            <p className="text-[15.5px] font-bold text-ink leading-snug">
              <span className="text-brand mr-1">{i + 1}.</span> {q}
            </p>

            {attempt ? (
              <>
                <div className="rounded-control border border-line bg-bg p-3.5 text-[14.5px] text-ink leading-relaxed">{attempt.answers[i]}</div>
                <div className="rounded-control bg-emerald-soft border border-emerald/20 p-3.5">
                  <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-emerald-deep">{t("referenceAnswer")}</p>
                  <p className="text-[14.5px] text-ink-soft leading-relaxed">{attempt.referenceAnswer[i]}</p>
                </div>
              </>
            ) : (
              <Textarea
                value={answers[i]}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={t("yourAnswerPlaceholder")}
                rows={4}
                className="text-[15px] resize-y"
              />
            )}
          </Card>
        ))}

        {/* Submit or status */}
        {attempt ? (
          attempt.reviewed ? (
            <Card className="space-y-3 border-emerald/40 bg-emerald-soft shadow-sm">
              <div className="flex items-center gap-2 text-emerald-deep">
                <Icon icon={ClipboardCheck} size={20} />
                <p className="text-[17px] font-black uppercase tracking-tight">
                  {t("grade")}: <span className="text-[22px]">{attempt.score}</span>/100
                </p>
              </div>
              {attempt.teacherFeedback && (
                <div className="rounded-[8px] bg-white/60 p-3 border border-emerald/10">
                  <p className="text-[12.5px] font-bold text-emerald uppercase mb-1">O'qituvchi izohi</p>
                  <p className="text-[15px] text-ink leading-relaxed">{attempt.teacherFeedback}</p>
                </div>
              )}
            </Card>
          ) : (
            <div className="flex items-center gap-3 rounded-control bg-amber-soft border border-amber/20 px-4 py-3 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-soft text-amber-deep">
                <div className="h-4 w-4 animate-pulse rounded-full bg-amber" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-amber-deep">{t("underReview")}</p>
                <p className="text-[13px] text-amber-deep/80">Javoblaringiz o'qituvchi tekshiruvi uchun yuborilgan.</p>
              </div>
            </div>
          )
        ) : (
          <button
            onClick={() => setConfirm(true)}
            disabled={!allFilled || submit.isPending}
            className="w-full rounded-control bg-gradient-to-r from-brand to-brand-deep px-4 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-brand/20 transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none"
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
    </div>
  );
}
