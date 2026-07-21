import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Icon, Spinner } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useLesson, type Lesson } from "../api";
import { MaterialsPanel } from "./MaterialsPanel";
import { ContentPanel } from "./ContentPanel";
import { StageRail } from "./StageRail";
import { buildStages, defaultView, stageToView, type LessonView, type StageKey } from "./stages";

const ALL_VIEWS: LessonView[] = ["konspekt", "video", "slides", "case", "quiz", "result"];

/** So'ralgan ko'rinish mavjudmi — bo'lmasa sukut ko'rinishga tushadi. */
function viewAvailable(v: LessonView, lesson: Lesson): boolean {
  switch (v) {
    case "konspekt":
      return !!lesson.digest;
    case "video":
      return !!lesson.tabs.video;
    case "slides":
      return !!lesson.tabs.slides;
    case "case":
      return !!lesson.tabs.case;
    case "quiz":
      return !!lesson.tabs.quiz;
    case "result":
      return true;
  }
}

export function LessonPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useLesson(topicId);
  const lesson = q.data;

  if (q.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={26} />
      </div>
    );
  }

  if (q.isError || !lesson) {
    const msg = apiErrorMessage(q.error, locale === "ru" ? "ru" : "uz");
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-body font-semibold text-ink">{msg ?? t("lockedBack")}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-body font-bold text-white transition-colors hover:bg-brand-deep"
        >
          <Icon icon={ArrowLeft} size={15} />
          {t("lockedBack")}
        </button>
      </div>
    );
  }

  // Ko'rinish: ?view= yoki eski ?tab= (mos qiymatlar) yoki sukut.
  const raw = (params.get("view") ?? params.get("tab")) as LessonView | null;
  const requested = raw && ALL_VIEWS.includes(raw) && viewAvailable(raw, lesson) ? raw : null;
  const view: LessonView = requested ?? defaultView(lesson);

  const setView = (v: LessonView) => setParams({ view: v }, { replace: true });
  const onStage = (key: StageKey) => setView(stageToView(key, lesson));

  const stages = buildStages(lesson);

  return (
    <div>
      {/* Shapka */}
      <button
        onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
        className="mb-3 flex items-center gap-1 text-note font-medium text-brand-deep hover:underline"
      >
        <Icon icon={ArrowLeft} size={15} />
        {lesson.subjectName}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-note font-bold uppercase tracking-wide text-ink-faint">
            {t("topic")} {lesson.orderIndex}
          </p>
          <h1 className="text-h1 font-bold text-ink">{lesson.title}</h1>
        </div>
        {lesson.completed && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-soft px-3 py-1 text-note font-bold text-emerald">
            <Icon icon={CheckCircle2} size={14} />
            {t("topicDone")}
          </span>
        )}
      </div>

      {/* 3 panel — mobil: rail → kontent → materiallar; desktop: materiallar | kontent | rail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="order-3 lg:order-1">
          <MaterialsPanel materials={lesson.materials} />
        </div>
        <div className="order-2 min-w-0 lg:order-2">
          <ContentPanel lesson={lesson} topicId={topicId} view={view} setView={setView} />
        </div>
        <div className="order-1 lg:order-3">
          <div className="lg:sticky lg:top-[73px]">
            <StageRail stages={stages} view={view} onSelect={onStage} />
          </div>
        </div>
      </div>
    </div>
  );
}
