import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookText, ClipboardList, HeartPulse, Stethoscope, Trophy } from "lucide-react";
import { EmptyState, Icon, Spinner } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { Lesson } from "../api";
import { Panel } from "./Panel";
import { firstContentView, nextOpenStage, type ContentView, type LessonView, type StageInfo, type StageKey } from "./stages";
import { DigestView } from "../../../components/lesson/DigestView";
import { SectionReader } from "./SectionReader";
import { NextStageBar } from "./NextStageBar";
import { PodcastTab } from "./PodcastTab";
import { VideoTab } from "./VideoTab";
import { SlidesTab } from "./SlidesTab";
import { QuizTab } from "./QuizTab";
import { CaseTab } from "./CaseTab";
import { PatientTab } from "./PatientTab";
import { FlashcardsTab } from "./FlashcardsTab";

// Natija ekrani anime.js timeline'ini olib keladi (~22kb gzip) — u faqat shu
// yuza ochilganda kerak, shuning uchun alohida chunk.
const ResultPanel = lazy(() => import("./ResultPanel").then((m) => ({ default: m.ResultPanel })));
// Mindmap React Flow + dagre (~130kb) olib keladi — xuddi shu sabab alohida chunk.
const MindmapView = lazy(() => import("./MindmapView").then((m) => ({ default: m.MindmapView })));

const SURFACE_ICON = {
  case: Stethoscope,
  quiz: ClipboardList,
  result: Trophy,
} as const;

export function ContentPanel({
  lesson,
  topicId,
  view,
  setView,
  stages,
  onStage,
  section,
  onVisibleSection,
  onMarkRead,
  seekTo = null,
  onSeekVideo,
  onJumpSection,
}: {
  lesson: Lesson;
  topicId: number;
  view: LessonView;
  setView: (v: LessonView) => void;
  stages: StageInfo[];
  onStage: (key: StageKey) => void;
  /** Chap TOC'dan tanlangan bo'lim (skroll uchun). */
  section: number | null;
  onVisibleSection: (index: number) => void;
  onMarkRead: (index: number) => void;
  /** Faza 1: video sekundiga sakrash (konspekt media chipidan ?t=). */
  seekTo?: number | null;
  onSeekVideo?: (sec: number) => void;
  /** Faza 2: mindmap bo'lim tugunidan konspektga sakrash. */
  onJumpSection?: (index: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const hasSections = (lesson.sections?.length ?? 0) > 0;

  const contentTabs: ContentView[] = [];
  if (lesson.digest || hasSections) contentTabs.push("konspekt");
  // Audio-podkast — o'rganish yuzasi (tepadagi tasmadagi "Podkast" bloki).
  if (lesson.podcast) contentTabs.push("podcast");
  if (lesson.tabs.slides) contentTabs.push("slides");
  if (lesson.tabs.video) contentTabs.push("video");

  // ⚠️ Yangi o'rganish yuzasi qo'shsang, uni SHU RO'YXATGA ham qo'sh: aks holda
  // pastdagi "baholash yuzasi" shoxi uni `case|quiz|result` deb qabul qiladi va
  // `SURFACE_ICON[view]` undefined bo'lib sahifa OQ EKRANGA aylanadi
  // (2026-08-02 da aynan shunday bo'ldi — podkast qo'shilganda).
  const isContentView =
    view === "konspekt" ||
    view === "podcast" ||
    view === "video" ||
    view === "slides" ||
    view === "flashcards" ||
    view === "mindmap";

  // ---- Virtual bemor roleplay (amaliyot — fokus rejim) ----
  if (view === "patient") {
    return (
      <Panel
        header={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(lesson.tabs.case ? "case" : firstContentView(lesson))}
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-note font-semibold text-brand-tint transition-colors hover:bg-surface-raised"
            >
              <Icon icon={ArrowLeft} size={14} />
              {t("backToContent")}
            </button>
            <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-note font-bold text-ink">
              <Icon icon={HeartPulse} size={14} className="text-rose" />
              {t("stage_patient")}
            </span>
          </div>
        }
        bodyClassName="flex flex-col p-4"
      >
        <PatientTab topicId={topicId} />
      </Panel>
    );
  }

  // ---- Baholash / natija yuzasi (test/keys/natija — fokus rejim) ----
  if (!isContentView && view !== "overview") {
    const key = view as "case" | "quiz" | "result";
    const terminal =
      (key === "quiz" && lesson.tabs.quiz?.attempt?.status === "finished") ||
      (key === "case" && !!lesson.tabs.case?.attempt);
    return (
      <Panel
        header={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(firstContentView(lesson))}
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-note font-semibold text-brand-tint transition-colors hover:bg-surface-raised"
            >
              <Icon icon={ArrowLeft} size={14} />
              {t("backToContent")}
            </button>
            <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-note font-bold text-ink">
              <Icon icon={SURFACE_ICON[key]} size={14} className="text-ink-faint" />
              {t(`stage_${key}`)}
            </span>
          </div>
        }
        bodyClassName="p-4"
      >
        {/* Fokusli yakka interfeys — markazlashgan, chalg'ituvchi yon panellar yo'q */}
        <div className="mx-auto w-full max-w-[720px]">
          {view === "case" && lesson.tabs.case && <CaseTab topicId={topicId} data={lesson.tabs.case} />}
          {view === "quiz" && lesson.tabs.quiz && <QuizTab topicId={topicId} data={lesson.tabs.quiz} />}
          {view === "result" && (
            <Suspense
              fallback={
                <div className="flex justify-center py-10">
                  <Spinner size={22} />
                </div>
              }
            >
              <ResultPanel lesson={lesson} onView={setView} />
            </Suspense>
          )}
          {terminal && <NextStageBar stages={stages} currentKey={key as StageKey} onSelect={onStage} />}
        </div>
      </Panel>
    );
  }

  // ---- Fleshkartalar (o'rganish bloki — takrorlash) ----
  // Rail + chat bilan 3-panelда ko'rsatiladi; shapka yo'q (nom chap railda).
  if (view === "flashcards") {
    return (
      <Panel bodyClassName="p-4">
        <FlashcardsTab topicId={topicId} />
      </Panel>
    );
  }

  // ---- Mindmap (o'rganish bloki — navigatsiya xaritasi, AI'siz) ----
  if (view === "mindmap") {
    return (
      <Panel bodyClassName="p-0">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner size={22} />
            </div>
          }
        >
          <MindmapView
            topicTitle={lesson.title}
            sections={lesson.sections ?? []}
            terms={lesson.digest?.terms ?? []}
            onJumpSection={(i) => onJumpSection?.(i)}
          />
        </Suspense>
      </Panel>
    );
  }

  // ---- Kontent yo'q ----
  if (contentTabs.length === 0) {
    return (
      <Panel title={t("tab_konspekt")} icon={BookText} bodyClassName="p-3">
        <EmptyState icon={<Icon icon={BookText} size={20} />} text={t("contentPreparing")} />
      </Panel>
    );
  }

  const active: ContentView = contentTabs.includes(view as ContentView) ? (view as ContentView) : contentTabs[0];
  const nextAfterStudy = nextOpenStage(stages, "study");
  const studyDone = stages.find((s) => s.key === "study")?.state === "done";
  const readerMode = active === "konspekt" && hasSections;

  // Bloklar chap ustunda tanlanadi — bu panelда faqat kontent. Shapka YO'Q:
  // faol blok nomi chap railda brand chip bilan allaqachon belgilangan
  // (ilgari bir tushuncha 3 ta shapkada takrorlanardi).
  // 2026-07-28: asl material (PDF) endi alohida blok emas — konspekt USTIDA,
  // o'qish oqimining boshida turadi va joyida ochiladi.
  // 2026-08-01: manbalar (asl PDF/havolalar) endi SHU PANELDA emas — tepadagi
  // "Manbalar" tugmasi ortida (LessonPage). O'qish maydoni to'liq kontentга.

  // ⚠️ Media ko'rinishlari (slayd/video/podkast) — ixcham padding: ular SAHNA,
  // ramka emas (buyurtmachi 2026-08-02: "фокус не на контенте остаётся").
  return (
    <Panel
      bodyClassName={
        active === "konspekt"
          ? "flex flex-col p-0"
          : active === "slides" || active === "video" || active === "podcast" || active === "mindmap"
            ? "p-2"
            : "p-4"
      }
    >
      {active === "konspekt" && (
        <>
          {readerMode ? (
            /* Reader o'z ichida skroll qiladi — material paneli ochilsa u qisqaradi. */
            <div className="min-h-0 flex-1">
              <SectionReader
                sections={lesson.sections}
                terms={lesson.digest?.terms ?? []}
                activeSection={section}
                onVisibleSection={onVisibleSection}
                onMarkRead={onMarkRead}
                onFinished={nextAfterStudy ? () => onStage(nextAfterStudy.key) : undefined}
                finishedLabel={nextAfterStudy ? `${t("nextStage")}: ${t(`stage_${nextAfterStudy.key}`)}` : undefined}
                hasVideo={!!lesson.tabs.video}
                onSeekVideo={onSeekVideo}
                // Podkast bo'lsa — audio SHU YERDA emas, alohida "Podkast" blokida
                // (ikkita pleyer bir ekranda takror bo'lardi, §4).
                audioSrc={
                  !lesson.podcast && lesson.digestAudio
                    ? `${API_URL}/api/v1/me/topics/${topicId}/digest-audio`
                    : null
                }
              />
            </div>
          ) : (
            lesson.digest && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <DigestView digest={lesson.digest} />
              </div>
            )
          )}
        </>
      )}
      {active === "podcast" && lesson.podcast && <PodcastTab topicId={topicId} data={lesson.podcast} />}
      {active === "video" && lesson.tabs.video && (
        <>
          <VideoTab topicId={topicId} data={lesson.tabs.video} threshold={lesson.thresholds.video} seekTo={seekTo} />
          {studyDone && <NextStageBar stages={stages} currentKey="study" onSelect={onStage} />}
        </>
      )}
      {active === "slides" && lesson.tabs.slides && (
        <>
          <SlidesTab topicId={topicId} data={lesson.tabs.slides} />
          {studyDone && <NextStageBar stages={stages} currentKey="study" onSelect={onStage} />}
        </>
      )}
    </Panel>
  );
}
