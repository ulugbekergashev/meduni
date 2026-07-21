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
      <div className="flex h-full items-center justify-center py-20">
        <Spinner size={26} />
      </div>
    );
  }

  if (q.isError || !lesson) {
    const msg = apiErrorMessage(q.error, locale === "ru" ? "ru" : "uz");
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-body font-semibold text-ink">{msg ?? t("lockedBack")}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2 text-body font-bold text-white transition-colors hover:bg-brand-deep"
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
    <div className="flex flex-col lg:h-full">
      {/* Ixcham mavzu paneli — ZICHLIK: bitta qator, katta bo'shliqsiz */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-2">
        <button
          onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
          className="inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-note font-semibold text-brand-deep transition-colors hover:bg-bg"
        >
          <Icon icon={ArrowLeft} size={15} />
          {lesson.subjectName}
        </button>
        <span className="text-line">/</span>
        <span className="text-note font-bold uppercase tracking-wide text-ink-faint">
          {t("topic")} {lesson.orderIndex}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-section font-bold text-ink">{lesson.title}</h1>
        {lesson.completed && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-emerald-soft px-2.5 py-0.5 text-[12px] font-bold text-emerald">
            <Icon icon={CheckCircle2} size={13} />
            {t("topicDone")}
          </span>
        )}
      </div>

      {/* Uch panel — to'liq balandlik, ingichka oraliq, har biri o'z ichida skroll */}
      <div className="grid gap-2 p-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <div className="order-3 flex min-h-0 flex-col lg:order-1">
          <MaterialsPanel materials={lesson.materials} />
        </div>
        <div className="order-2 flex min-h-0 min-w-0 flex-col lg:order-2">
          <ContentPanel lesson={lesson} topicId={topicId} view={view} setView={setView} />
        </div>
        <div className="order-1 flex min-h-0 flex-col lg:order-3">
          <StageRail stages={stages} view={view} onSelect={onStage} />
        </div>
      </div>
    </div>
  );
}
