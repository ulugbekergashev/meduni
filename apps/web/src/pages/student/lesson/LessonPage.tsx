import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, PanelLeft } from "lucide-react";
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

const ALL_VIEWS: LessonView[] = [
  "overview",
  "konspekt",
  "video",
  "slides",
  "materials",
  "case",
  "quiz",
  "flashcards",
  "result",
  "patient",
];

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
    case "materials":
      return lesson.materials.length > 0 || (lesson.links?.length ?? 0) > 0;
    case "case":
      return !!lesson.tabs.case;
    case "quiz":
      return !!lesson.tabs.quiz;
    case "patient":
      // Virtual bemor keys asosida — keys bo'lsa ochiq.
      return !!lesson.tabs.case;
    case "flashcards":
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
  // Materiallar bloki fayl YOKI havola bo'lsa turadi (matn ajratilmagan bo'lsa
  // ham — u holda blok ichida faqat yuklab olish ro'yxati ochiladi).
  if (lesson.materials.length > 0 || (lesson.links?.length ?? 0) > 0) studyBlocks.push("materials");
  // Fleshkartalar — takrorlash bloki (test yoki konspekt bo'lsa hosil bo'ladi;
  // test yakunlanmaguncha rail'da qulf bilan turadi).
  if (lesson.tabs.quiz || lesson.digest) studyBlocks.push("flashcards");
  const activeBlock: ContentView = studyBlocks.includes(view as ContentView)
    ? (view as ContentView)
    : firstContentView(lesson);
  const isStudyView =
    view === "konspekt" ||
    view === "slides" ||
    view === "video" ||
    view === "materials" ||
    view === "flashcards";
  /** 3 panel FAQAT o'rganishda. Test/keys/kartalar/natija/overview — FOKUSLI
   *  yakka interfeys: chap rail ham, chat ham ko'rsatilmaydi (foydalanuvchi:
   *  "bu interfeys faqat o'rganish uchun; test/natija/keys/flashcard uchun
   *  alohida interfeys"). Halollik ham shu bilan hal: test paytida material/chat
   *  umuman yo'q. */
  const focusMode = !isStudyView;

  /** Test jarayonida (tugallanmagan urinish) — halollik rejimi (o'rganish
   *  ko'rinishiga qaytilganda material/chat qulflanadi). */
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
        <span className="text-note font-semibold text-ink-dim">
          {t("topic")} {lesson.orderIndex}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-section font-extrabold tracking-tight text-ink">{lesson.title}</h1>

        {/* Chap ustun toggle — faqat o'rganish rejimida ma'noli. Raqam yo'q:
            rail ochilganda tarkib baribir ko'rinadi. */}
        {!focusMode && (
          <button
            onClick={toggleRail}
            title={t("stage_study")}
            className={cls(
              "inline-flex shrink-0 items-center rounded-control p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              railOpen ? "text-brand-tint" : "text-ink-faint hover:bg-surface-raised hover:text-ink"
            )}
          >
            <Icon icon={PanelLeft} size={15} />
          </button>
        )}
      </div>

      {/* Bosqichlar — obzor ekranida ko'rsatilmaydi (u yerda bosqichlar
          allaqachon katta ro'yxatda; ikki marta chizish shovqin edi). */}
      {view !== "overview" && (
        <StageStepper lesson={lesson} stages={stages} view={view} onSelect={onStage} onOverview={() => setView("overview")} />
      )}

      {focusMode ? (
        /* FOKUS REJIMI — test/keys/kartalar/natija/overview: yakka interfeys,
           rail ham chat ham YO'Q. */
        <div className="flex min-h-0 flex-1 flex-col p-2">
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
      ) : (
        /* O'RGANISH REJIMI — 3 panel: bloklar | kontent | AI-tutor */
        <div
          className={cls(
            "grid gap-2 p-2 transition-[grid-template-columns] duration-200 ease-out lg:min-h-0 lg:flex-1",
            railOpen ? "lg:grid-cols-[264px_minmax(0,1fr)_320px]" : "lg:grid-cols-[0px_minmax(0,1fr)_320px]"
          )}
        >
          {railOpen && (
            <div className="order-3 flex min-h-0 flex-col overflow-hidden lg:order-1">
              {/* O'rganish bloklari + bo'limlar TOC + materiallar.
                  Halollik: test tugallanmagan bo'lsa materiallar qulf. */}
              <StudyRail
                lesson={lesson}
                blocks={studyBlocks}
                active={activeBlock}
                onBlock={(v) => {
                  setJumpTo(null);
                  setView(v);
                }}
                sectionActive={visibleSection}
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
          </div>

          {/* AI-tutor — faqat o'rganishda (test paytida qulf) */}
          <div className="order-2 flex min-h-0 flex-col lg:order-3">
            <ChatPanel topicId={topicId} locked={quizRunning} />
          </div>
        </div>
      )}
    </div>
  );
}
