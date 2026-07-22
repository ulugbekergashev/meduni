import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, PanelLeft } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useLesson, useMarkSectionRead, type Lesson } from "../api";
import { Panel } from "./Panel";
import { StudyRail } from "./StudyRail";
import { ContentPanel } from "./ContentPanel";
import { ChatPanel } from "./ChatPanel";
import { StageStepper } from "./StageStepper";
import { LessonOverview } from "./LessonOverview";
import {
  buildStages,
  firstContentView,
  resumeView,
  stageToView,
  type ContentView,
  type LessonView,
  type StageKey,
} from "./stages";

const ALL_VIEWS: LessonView[] = ["overview", "konspekt", "video", "slides", "case", "quiz", "result"];

/** So'ralgan ko'rinish mavjudmi — bo'lmasa overview'ga tushadi. */
function viewAvailable(v: LessonView, lesson: Lesson): boolean {
  switch (v) {
    case "overview":
      return true;
    case "konspekt":
      return !!lesson.digest || (lesson.sections?.length ?? 0) > 0;
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

/** Chap ustun (o'rganish bloklari + materiallar) holati. Endi u asosiy
 *  navigatsiya — shuning uchun default OCHIQ; tugma faqat kontentga
 *  to'liq fokuslanmoqchi bo'lganda yopadi. */
const RAIL_KEY = "meduni.lesson.rail";

export function LessonPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useLesson(topicId);
  const lesson = q.data;
  const markRead = useMarkSectionRead(topicId);
  /** TOC'dan tanlangan bo'lim (skroll uchun) va skrollda ko'rinayotgani. */
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const [visibleSection, setVisibleSection] = useState<number | null>(null);
  const [railOpen, setRailOpen] = useState(
    () => typeof window === "undefined" || window.localStorage.getItem(RAIL_KEY) !== "closed"
  );
  const toggleRail = () =>
    setRailOpen((o) => {
      const next = !o;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "open" : "closed");
      } catch {}
      return next;
    });

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

  // Ko'rinish: ?view= yoki eski ?tab= (deep-link) yoki OVERVIEW (layout v2 —
  // "avval bosqichlar ko'rinadi, keyin o'quv jarayoni ochiladi").
  const raw = (params.get("view") ?? params.get("tab")) as LessonView | null;
  const requested = raw && ALL_VIEWS.includes(raw) && viewAvailable(raw, lesson) ? raw : null;
  const view: LessonView = requested ?? "overview";

  const setView = (v: LessonView) => setParams({ view: v }, { replace: true });
  const onStage = (key: StageKey) => setView(stageToView(key, lesson));
  const stages = buildStages(lesson);

  // Konspekt endi butunlay ko'rinadi — `section` faqat TOC'dan sakrash uchun,
  // `visibleSection` esa skroll paytida qaysi bo'lim ko'rinayotganini bildiradi.
  const sections = lesson.sections ?? [];

  // O'rganish bloklari (chap ustunda tanlanadi).
  const studyBlocks: ContentView[] = [];
  if (lesson.digest || sections.length > 0) studyBlocks.push("konspekt");
  if (lesson.tabs.slides) studyBlocks.push("slides");
  if (lesson.tabs.video) studyBlocks.push("video");
  const activeBlock: ContentView = studyBlocks.includes(view as ContentView)
    ? (view as ContentView)
    : firstContentView(lesson);
  const isStudyView = view === "konspekt" || view === "slides" || view === "video";

  const materialsCount = lesson.materials.length + (lesson.links?.length ?? 0);
  /** Test jarayonida (tugallanmagan urinish) — halollik rejimi. */
  const quizRunning = !!lesson.tabs.quiz?.inProgressId;

  return (
    <div className="flex flex-col lg:h-full">
      {/* Breadcrumb — bitta ixcham qator */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1.5">
        <button
          onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
          className="inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-note font-bold text-brand-tint transition-colors hover:bg-surface-raised"
        >
          <Icon icon={ArrowLeft} size={14} />
          {lesson.subjectName}
        </button>
        <span className="text-line">/</span>
        <span className="text-micro font-extrabold uppercase tracking-wider text-ink-dim">
          {t("topic")} {lesson.orderIndex}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-section font-extrabold tracking-tight text-ink">{lesson.title}</h1>

        {lesson.completed && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-emerald-soft px-2 py-0.5 text-micro font-extrabold text-emerald">
            <Icon icon={CheckCircle2} size={12} />
            {t("topicDone")}
          </span>
        )}

        {/* Chap ustun toggle (default ochiq — u asosiy navigatsiya) */}
        <button
          onClick={toggleRail}
          title={t("stage_study")}
          className={cls(
            "inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line px-2 py-1 text-note font-bold transition-colors",
            railOpen ? "bg-brand-soft text-brand-tint" : "text-ink-soft hover:bg-surface-raised"
          )}
        >
          <Icon icon={PanelLeft} size={13} />
          <span className="tabular-nums">{materialsCount}</span>
        </button>
      </div>

      {/* Bosqichlar — yuqori gorizontal stepper (layout v2) */}
      <StageStepper lesson={lesson} stages={stages} view={view} onSelect={onStage} onOverview={() => setView("overview")} />

      {/* Panellar: [o'rganish bloklari] | KONTENT (fokus) | chat */}
      <div
        className={cls(
          "grid gap-2 p-2 lg:min-h-0 lg:flex-1",
          railOpen && view !== "overview"
            ? "lg:grid-cols-[280px_minmax(0,1fr)_340px]"
            : "lg:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {railOpen && view !== "overview" && (
          <div className="order-3 flex min-h-0 flex-col lg:order-1">
            {/* O'rganish bloklari + bo'limlar TOC + materiallar.
                Halollik rejimi: test jarayonida materiallar yopiq. */}
            <StudyRail
              lesson={lesson}
              blocks={studyBlocks}
              active={activeBlock}
              onBlock={(v) => {
                setJumpTo(null);
                setView(v);
              }}
              sectionActive={isStudyView ? visibleSection : null}
              onSection={(i) => {
                if (view !== "konspekt") setView("konspekt");
                setJumpTo(i);
                // Bir xil bo'limni qayta bosish ham ishlashi uchun darhol tozalanadi.
                setTimeout(() => setJumpTo(null), 600);
              }}
              locked={quizRunning}
              lockedNote={t("materialsLockedQuiz")}
            />
          </div>
        )}

        <div className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
          {view === "overview" ? (
            <Panel bodyClassName="lg:overflow-y-auto">
              <LessonOverview
                lesson={lesson}
                stages={stages}
                onStage={onStage}
                onResume={() => setView(resumeView(lesson))}
              />
            </Panel>
          ) : (
            <ContentPanel
              lesson={lesson}
              topicId={topicId}
              view={view}
              setView={setView}
              stages={stages}
              onStage={onStage}
              section={jumpTo}
              onVisibleSection={setVisibleSection}
              onMarkRead={(i) => markRead.mutate(i)}
            />
          )}
        </div>

        {/* O'ng ustun — AI-tutor chat (test paytida qulf — halollik) */}
        <div className="order-2 flex min-h-0 flex-col lg:order-3">
          <ChatPanel topicId={topicId} locked={quizRunning} />
        </div>
      </div>
    </div>
  );
}
