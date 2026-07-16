import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ClipboardList, FileText, PartyPopper, Stethoscope, Video } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useLesson, type Lesson } from "../api";
import { VideoTab } from "./VideoTab";
import { SlidesTab } from "./SlidesTab";
import { QuizTab } from "./QuizTab";
import { CaseTab } from "./CaseTab";

type TabKey = "video" | "slides" | "quiz" | "case";

const tabColor: Record<string, { active: string; dot: string }> = {
  violet: { active: "bg-violet-soft text-violet", dot: "bg-violet" },
  brand: { active: "bg-brand-soft text-brand-deep", dot: "bg-brand" },
  blue: { active: "bg-blue-soft text-blue", dot: "bg-blue" },
  rose: { active: "bg-rose-soft text-rose", dot: "bg-rose" },
};

function buildTabs(lesson: Lesson) {
  const defs: { key: TabKey; color: string; icon: typeof Video; present: boolean; done: boolean }[] = [
    { key: "video", color: "violet", icon: Video, present: !!lesson.tabs.video, done: !!lesson.tabs.video?.done },
    { key: "slides", color: "brand", icon: FileText, present: !!lesson.tabs.slides, done: !!lesson.tabs.slides?.done },
    {
      key: "quiz",
      color: "blue",
      icon: ClipboardList,
      present: !!lesson.tabs.quiz,
      done: lesson.tabs.quiz?.attempt?.status === "finished" && !!lesson.tabs.quiz?.attempt?.passed,
    },
    { key: "case", color: "rose", icon: Stethoscope, present: !!lesson.tabs.case, done: !!lesson.tabs.case?.attempt },
  ];
  return defs.filter((d) => d.present);
}

export function LessonPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useLesson(topicId);
  const lesson = q.data;

  return (
    <div className="mx-auto max-w-2xl">
      {q.isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner size={26} />
        </div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {lesson && (() => {
            const tabs = buildTabs(lesson);
            const requested = params.get("tab") as TabKey | null;
            const active =
              tabs.find((tb) => tb.key === requested)?.key ??
              tabs.find((tb) => !tb.done)?.key ?? // where the student stopped
              tabs[0]?.key;

            const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

            return (
              <>
                <button
                  onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
                  className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline"
                >
                  <Icon icon={ArrowLeft} size={15} />
                  {t("backToPath")}
                </button>

                <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
                  {t("topic")} {lesson.orderIndex}
                </p>
                <h1 className="text-h1 font-bold text-ink">{lesson.title}</h1>

                {lesson.completed && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-card bg-emerald-soft p-4">
                    <div className="flex items-center gap-2 text-emerald">
                      <Icon icon={PartyPopper} size={20} />
                      <div>
                        <p className="text-[14.5px] font-bold">{t("topicDone")}</p>
                        <p className="text-[12.5px]">{t("nextUnlocked")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
                      className="shrink-0 rounded-control bg-emerald px-3 py-2 text-[13px] font-bold text-white hover:opacity-90"
                    >
                      {t("backToPath")}
                    </button>
                  </div>
                )}

                {/* Tab bar — segmented track; each tab keeps its element color */}
                <div className="mt-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
                  {tabs.map((tb) => {
                    const on = tb.key === active;
                    const c = tabColor[tb.color];
                    return (
                      <button
                        key={tb.key}
                        onClick={() => setTab(tb.key)}
                        className={cls(
                          "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-3.5 py-2 text-[14px] font-semibold transition-all",
                          on ? c.active : "text-ink-soft hover:bg-bg hover:text-ink"
                        )}
                      >
                        <Icon icon={tb.icon} size={16} />
                        {t(`tab_${tb.key}`)}
                        {tb.done && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald text-white">
                            <Icon icon={Check} size={11} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active tab */}
                <div className="mt-5">
                  {active === "video" && lesson.tabs.video && (
                    <VideoTab topicId={topicId} data={lesson.tabs.video} threshold={lesson.thresholds.video} />
                  )}
                  {active === "slides" && lesson.tabs.slides && <SlidesTab topicId={topicId} data={lesson.tabs.slides} />}
                  {active === "quiz" && lesson.tabs.quiz && <QuizTab topicId={topicId} data={lesson.tabs.quiz} />}
                  {active === "case" && lesson.tabs.case && <CaseTab topicId={topicId} data={lesson.tabs.case} />}
                </div>
              </>
            );
          })()}
        </AsyncSection>
      )}
    </div>
  );
}
