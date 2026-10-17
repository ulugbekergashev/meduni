import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  PartyPopper,
  PlayCircle,
  RotateCcw,
  Stethoscope,
  Video,
} from "lucide-react";
import { Button, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { BentoCard } from "../../components/bento";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
import { Line, SoftChip, TopicTrack } from "./parts/bento";
import { useMyCourse, type StudentTopic, type TopicElements } from "./api";

/** Element chipi — bosilsa mavzuning o'sha tabiga to'g'ridan o'tadi. */
function Chip({
  icon,
  label,
  done,
  hint,
  onClick,
}: {
  icon: typeof Video;
  label: string;
  done: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const cn = cls(
    "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-micro font-semibold transition-colors",
    done ? "border-emerald/30 text-emerald" : "border-line text-ink-soft",
    onClick && "hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  );
  const inner = (
    <>
      <Icon icon={done ? CheckCircle2 : icon} size={12} />
      {label}
      {hint && <span className="tabular-nums">{hint}</span>}
    </>
  );
  if (!onClick) return <span className={cn}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} className={cn}>
      {inner}
    </button>
  );
}

function ElementChips({ topic }: { topic: StudentTopic }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();
  const e: TopicElements = topic.elements;
  const complete = topic.state === "COMPLETED";
  // Qulflanmagan mavzuda chip bosilsa — o'sha tabga to'g'ridan-to'g'ri.
  const go = topic.state === "LOCKED" ? undefined : (tab: string) => () => navigate(`/app/topics/${topic.id}?tab=${tab}`);
  const chips = [];
  if (e.video.exists)
    chips.push(<Chip key="v" icon={Video} label={t("elVideo")} done={complete || e.video.watchedPct >= 80} hint={!complete && e.video.watchedPct > 0 && e.video.watchedPct < 80 ? `${e.video.watchedPct}%` : undefined} onClick={go?.("video")} />);
  if (e.slides.exists) chips.push(<Chip key="s" icon={FileText} label={t("elSlides")} done={complete || e.slides.viewed} onClick={go?.("slides")} />);
  if (e.quiz.exists)
    chips.push(<Chip key="q" icon={ClipboardList} label={t("elQuiz")} done={complete || e.quiz.score !== null} hint={e.quiz.score !== null ? `${e.quiz.score}%` : undefined} onClick={go?.("quiz")} />);
  if (e.case.exists) chips.push(<Chip key="c" icon={Stethoscope} label={t("elCase")} done={complete || e.case.reviewed} onClick={go?.("case")} />);
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

/** Yo'l nuqtasi — tugagan = kontur emerald belgi (§4: to'ldirilgan yashil emas). */
function Dot({ state }: { state: StudentTopic["state"] }) {
  return (
    <span
      className={cls(
        "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-surface",
        state === "COMPLETED" && "border-emerald text-emerald",
        (state === "AVAILABLE" || state === "IN_PROGRESS") && "border-ink text-ink",
        state === "LOCKED" && "border-line text-ink-faint"
      )}
    >
      {state === "COMPLETED" ? (
        <Icon icon={CheckCircle2} size={14} />
      ) : state === "LOCKED" ? (
        <Icon icon={Lock} size={12} />
      ) : (
        <span className="h-2 w-2 rounded-full bg-ink" />
      )}
    </span>
  );
}

function TopicItem({ topic, last }: { topic: StudentTopic; last: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const current = topic.state === "AVAILABLE" || topic.state === "IN_PROGRESS";
  const locked = topic.state === "LOCKED";
  const reason = topic.reason ? (locale === "ru" ? topic.reason.ru : topic.reason.uz) : null;

  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center pt-3">
        <Dot state={topic.state} />
        {!last && <span className="mt-1 w-0.5 flex-1 bg-line" />}
      </div>

      <div className={cls("mb-2 min-w-0 flex-1 rounded-control p-3", current && "bg-brand-soft")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-micro font-semibold tabular-nums text-ink-soft">
              {t("topic")} {topic.orderIndex}
            </p>
            {locked ? (
              <h3 className="mt-0.5 text-section font-semibold text-ink-soft">{topic.title}</h3>
            ) : (
              <Link
                to={`/app/topics/${topic.id}`}
                className="mt-0.5 block rounded-control text-section font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {topic.title}
              </Link>
            )}
          </div>
          {topic.state === "COMPLETED" && (
            <span className="shrink-0 rounded-pill border border-emerald/30 px-2 py-0.5 text-micro font-semibold text-emerald">
              {t("statusDone")}
            </span>
          )}
          {current && (
            <span className="shrink-0 rounded-pill bg-ink px-2 py-0.5 text-micro font-semibold text-surface">
              {t("statusCurrent")}
            </span>
          )}
        </div>

        {!locked && (
          <div className="mt-2">
            <ElementChips topic={topic} />
          </div>
        )}

        {current && (
          <div className="mt-3 flex items-center gap-3">
            <Line value={topic.pct} track="bg-surface" className="max-w-md flex-1" />
            <span className="shrink-0 text-micro font-semibold tabular-nums text-ink-2">
              {topic.pct}% {t("done")}
            </span>
          </div>
        )}

        {topic.state === "COMPLETED" && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 rounded-pill"
            icon={<Icon icon={RotateCcw} size={13} />}
            onClick={() => navigate(`/app/topics/${topic.id}`)}
          >
            {t("review")}
          </Button>
        )}

        {locked && reason && (
          <button
            type="button"
            onClick={() => show(reason)}
            className="mt-2 flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2 text-left text-note font-medium text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" />
            {reason}
          </button>
        )}
      </div>
    </li>
  );
}

export function CoursePath() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tp2 } = useTranslation(undefined, { keyPrefix: "period" });
  const navigate = useNavigate();
  const q = useMyCourse(courseId);
  const c = q.data;
  const allDone = !!c && c.topicsTotal > 0 && c.topicsCompleted === c.topicsTotal;

  return (
    <div>
      {/* Yorliq "Kurslarga qaytish" — shuning uchun /app/courses ga (ilgari /app edi). */}
      <button
        type="button"
        onClick={() => navigate("/app/courses")}
        className="mb-3 inline-flex items-center gap-1 rounded-control text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon icon={ArrowLeft} size={15} />
        {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner size={26} />
        </div>
      ) : (
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={!!c && c.topicsTotal === 0}
          emptyText={t("noTopics")}
          onRetry={() => q.refetch()}
        >
          {c && (() => {
            const current = c.topics.find((tp) => tp.state === "IN_PROGRESS") ?? c.topics.find((tp) => tp.state === "AVAILABLE");
            return (
              <div className="space-y-3">
                {/* Kurs shapkasi — sahifaning yagona pastel yuzasi */}
                <section className="flex flex-col gap-4 rounded-card bg-brand-soft p-5 sm:flex-row sm:items-stretch">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SoftChip>{c.academicYear}</SoftChip>
                      <SoftChip>{tp2("semester", { n: c.semester })}</SoftChip>
                      {c.groupName && <SoftChip>{c.groupName}</SoftChip>}
                    </div>
                    <h1 className="mt-3 truncate text-h1 font-semibold text-ink">{c.subjectName}</h1>
                    <p className="mt-0.5 truncate text-note text-ink-2">
                      {c.teacherName} · {t("topicsOfCourse", { done: c.topicsCompleted, total: c.topicsTotal })}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="mb-4 max-w-md">
                        <TopicTrack done={c.topicsCompleted} total={c.topicsTotal} />
                      </div>
                      {current && (
                        <Button size="lg" onClick={() => navigate(`/app/topics/${current.id}`)} title={current.title}>
                          <Icon icon={PlayCircle} size={16} />
                          {t("continue")}
                          <Icon icon={ArrowRight} size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-row items-end justify-between gap-2 border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
                    <p className="text-display font-semibold tabular-nums text-ink">{c.progressPct}%</p>
                    <p className="text-micro text-ink-2">{t("overallProgress")}</p>
                  </div>
                </section>

                {allDone && (
                  <div className="flex items-center gap-3 rounded-card bg-emerald-soft p-4 text-emerald">
                    <Icon icon={PartyPopper} size={20} />
                    <p className="text-body font-semibold">{t("allDone")}</p>
                  </div>
                )}

                <BentoCard title={t("pathTitle")} count={c.topics.length} bodyClassName="px-3 pb-2">
                  <ol>
                    {c.topics.map((topic, i) => (
                      <TopicItem key={topic.id} topic={topic} last={i === c.topics.length - 1} />
                    ))}
                  </ol>
                </BentoCard>
              </div>
            );
          })()}
        </AsyncSection>
      )}
    </div>
  );
}
