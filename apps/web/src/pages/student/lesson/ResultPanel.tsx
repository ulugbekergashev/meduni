import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ClipboardList, Lock, PartyPopper, Sparkles, Stethoscope, TriangleAlert } from "lucide-react";
import { Card, Icon, ProgressRing, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { finalScore } from "./stages";

function Breakdown({ icon, tone, label, value }: { icon: typeof ClipboardList; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <div className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={15} />
      </div>
      <span className="flex-1 text-body font-semibold text-ink">{label}</span>
      <span className="text-[17px] font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

export function ResultPanel({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const navigate = useNavigate();
  const fs = finalScore(lesson);
  const hasScore = fs.value !== null;

  const next = lesson.nextTopic;
  const nextOpen = !!next && next.state !== "LOCKED";

  return (
    <div className="space-y-3">
      <Card className="flex flex-col items-center gap-3 !p-4 text-center">
        {hasScore ? (
          <>
            <ProgressRing value={fs.value ?? 0} size={96} stroke={10} tone="brand" />
            <div>
              <p className="text-section font-bold text-ink">{t("finalScore")}</p>
              {fs.pendingCase && (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-amber-soft px-3 py-1 text-note font-semibold text-amber">
                  <Icon icon={TriangleAlert} size={13} />
                  {t("finalPendingCase")}
                </p>
              )}
            </div>
            <div className="w-full max-w-sm text-left">
              {fs.quizPart !== null && (
                <Breakdown
                  icon={ClipboardList}
                  tone="bg-blue-soft text-blue"
                  label={t("finalBreakdownQuiz")}
                  value={`${fs.quizPart}%`}
                />
              )}
              {fs.casePart !== null && (
                <Breakdown
                  icon={Stethoscope}
                  tone="bg-rose-soft text-rose"
                  label={t("finalBreakdownCase")}
                  value={String(fs.casePart)}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-soft text-emerald">
              <Icon icon={PartyPopper} size={30} />
            </div>
            <p className="text-section font-bold text-ink">{t("contentOnlyDone")}</p>
            <p className="text-body text-ink-soft">{t("finalNoScore")}</p>
          </>
        )}

        {next ? (
          nextOpen ? (
            <button
              onClick={() => navigate(`/app/topics/${next.id}`)}
              className="flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-body font-bold text-white transition-all hover:bg-brand-deep"
            >
              {t("nextTopicBtn")}
              <Icon icon={ArrowRight} size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-control bg-bg px-5 py-2.5 text-body font-semibold text-ink-faint">
              <Icon icon={Lock} size={15} />
              {next.title}
            </div>
          )
        ) : (
          <button
            onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
            className="rounded-control border border-line bg-surface px-5 py-2.5 text-body font-bold text-brand-deep transition-colors hover:bg-bg"
          >
            {t("backToPath")}
          </button>
        )}
      </Card>

      {/* AI-yordamchi — keyingi sessiya */}
      <Card className="flex items-start gap-2.5 !p-3 opacity-90">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
          <Icon icon={Sparkles} size={18} />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body font-bold text-ink">
            {t("aiChatSoon")}
            <span className="rounded-pill bg-bg px-2 py-0.5 text-note font-bold text-ink-faint">{t("stageSoon")}</span>
          </p>
          <p className="mt-0.5 text-note text-ink-soft">{t("aiChatSoonBody")}</p>
        </div>
      </Card>
    </div>
  );
}
