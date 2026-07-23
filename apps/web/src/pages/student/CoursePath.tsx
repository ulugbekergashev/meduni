import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
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
import { Badge, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale } from "../../lib/useLocale";
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
    "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12.5px] font-medium transition-colors",
    done ? "bg-emerald-soft text-emerald" : "bg-surface-raised text-ink-faint",
    onClick && (done ? "hover:bg-emerald hover:text-white" : "hover:bg-brand-soft hover:text-brand-tint")
  );
  const inner = (
    <>
      <Icon icon={done ? CheckCircle2 : icon} size={13} />
      {label}
      {hint && <span className="font-bold">{hint}</span>}
    </>
  );
  if (!onClick) return <span className={cn}>{inner}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // karta bosilishini ushlab qolmasin
        onClick();
      }}
      className={cn}
    >
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

function Dot({ state }: { state: StudentTopic["state"] }) {
  return (
    <span
      className={cls(
        "z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface",
        state === "COMPLETED" && "border-emerald text-emerald",
        (state === "AVAILABLE" || state === "IN_PROGRESS") && "border-brand text-brand",
        state === "LOCKED" && "border-line text-ink-faint"
      )}
    >
      {state === "COMPLETED" ? (
        <Icon icon={CheckCircle2} size={14} />
      ) : state === "LOCKED" ? (
        <Icon icon={Lock} size={12} />
      ) : (
        <span className="h-2 w-2 rounded-full bg-brand" />
      )}
    </span>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function TopicCard({ topic, last }: { topic: StudentTopic; last: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const locale = useLocale();
  const { show } = useToast();
  const title = topic.title;
  const current = topic.state === "AVAILABLE" || topic.state === "IN_PROGRESS";

  return (
    <motion.li variants={itemVariants} className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <Dot state={topic.state} />
        {!last && <span className="w-0.5 flex-1 bg-line" />}
      </div>

      <div className="flex-1 pb-5">
        <Card
          className={cls(
            "flex flex-col gap-3",
            current && "border-brand shadow-md",
            topic.state === "LOCKED" && "opacity-80"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
                {t("topic")} {topic.orderIndex}
              </p>
              <h3 className={cls("mt-0.5 text-section font-bold", topic.state === "LOCKED" ? "text-ink-soft" : "text-ink")}>{title}</h3>
            </div>
            {topic.state === "COMPLETED" && <Badge tone="emerald">{t("statusDone")}</Badge>}
            {current && <Badge tone="brand">{t("statusCurrent")}</Badge>}
          </div>

          {topic.state !== "LOCKED" && <ElementChips topic={topic} />}

          {current && (
            <>
              <div>
                <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-raised">
                  <div className="h-full rounded-pill bg-brand transition-all" style={{ width: `${Math.max(topic.pct, 2)}%` }} />
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">{topic.pct}% {t("done")}</p>
              </div>
              <Link to={`/app/topics/${topic.id}`}>
                <button className="flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-[15.5px] font-bold text-white transition-all hover:bg-brand-deep">
                  <Icon icon={PlayCircle} size={18} />
                  {t("continue")}
                </button>
              </Link>
            </>
          )}

          {topic.state === "COMPLETED" && (
            <Link to={`/app/topics/${topic.id}`} className="self-start">
              <button className="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-[14px] font-semibold text-ink-soft transition-all hover:bg-surface-raised">
                <Icon icon={RotateCcw} size={14} />
                {t("review")}
              </button>
            </Link>
          )}

          {topic.state === "LOCKED" && topic.reason && (
            <button
              onClick={() => show(locale === "ru" ? topic.reason!.ru : topic.reason!.uz)}
              className="flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2 text-left text-[13.5px] font-medium text-amber"
            >
              <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" />
              {locale === "ru" ? topic.reason.ru : topic.reason.uz}
            </button>
          )}
        </Card>
      </div>
    </motion.li>
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
    <div className="mx-auto max-w-4xl">
      <button onClick={() => navigate("/app")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-tint hover:underline">
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
            <>
              {/* Course header — davr + progress + davom ettirish */}
              <div className="rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-md">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  <span className="rounded-pill bg-white/15 px-2 py-0.5">{c.academicYear}</span>
                  <span className="rounded-pill bg-white/15 px-2 py-0.5">{tp2("semester", { n: c.semester })}</span>
                  {c.groupName && <span className="rounded-pill bg-white/15 px-2 py-0.5">{c.groupName}</span>}
                </div>
                <h1 className="mt-2 text-h1 font-bold leading-tight">{c.subjectName}</h1>
                <p className="mt-0.5 text-[14px] text-white/85">{c.teacherName}</p>
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-pill bg-white/25">
                    <div className="h-full rounded-pill bg-white transition-all" style={{ width: `${Math.max(c.progressPct, 2)}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-[13.5px] text-white/85">
                      {c.progressPct}% {t("done")} · {c.topicsCompleted}/{c.topicsTotal} {t("topics")}
                    </p>
                    {current && (
                      <Link to={`/app/topics/${current.id}`}>
                        <button className="flex items-center gap-1.5 rounded-control bg-white px-3 py-1.5 text-[14px] font-bold text-brand-tint transition-all hover:bg-white/90">
                          <Icon icon={PlayCircle} size={15} />
                          {t("continue")}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {allDone && (
                <div className="mt-4 flex items-center gap-3 rounded-card bg-emerald-soft p-4 text-emerald">
                  <Icon icon={PartyPopper} size={20} />
                  <p className="text-[15px] font-bold">{t("allDone")}</p>
                </div>
              )}

              {/* Topic path */}
              <motion.ol variants={containerVariants} initial="hidden" animate="show" className="mt-3">
                {c.topics.map((topic, i) => (
                  <TopicCard key={topic.id} topic={topic} last={i === c.topics.length - 1} />
                ))}
              </motion.ol>
            </>
            );
          })()}
        </AsyncSection>
      )}
    </div>
  );
}
