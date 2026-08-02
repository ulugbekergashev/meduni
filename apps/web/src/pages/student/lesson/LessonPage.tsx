import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { COMPACT_QUERY, Icon, Sheet, Spinner, cls, useMediaQuery } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useLesson, useMarkSectionRead, type Lesson } from "../api";
import { Panel } from "./Panel";
import { StudyToolbar } from "./StudyToolbar";
import { MaterialBar } from "./MaterialBar";
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
  "mindmap",
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
      // Har doim renderlanadi — kontent bo'lmasa ContentPanel "tayyorlanmoqda"
      // bo'sh-holatini ko'rsatadi (aks holda "O'rganish" jimgina hech narsa qilmasdi).
      return true;
    case "video":
      return !!lesson.tabs.video;
    case "slides":
      return !!lesson.tabs.slides;
    case "mindmap":
      // Mindmap bo'limli konspektdan quriladi (v2). Bo'lim bo'lmasa yo'q.
      return (lesson.sections?.length ?? 0) > 0;
    case "case":
      return !!lesson.tabs.case;
    case "quiz":
      return !!lesson.tabs.quiz;
    case "patient":
      // Virtual bemor keys YOKI tasdiqlangan konspekt bo'lsa ochiq (keys shart emas).
      return !!lesson.patient?.available;
    case "flashcards":
    case "result":
      return true;
  }
}

/** Chap ustun (o'rganish bloklari + materiallar) holati. Endi u asosiy
 *  navigatsiya — shuning uchun default OCHIQ; tugma faqat kontentga
 *  to'liq fokuslanmoqchi bo'lganda yopadi. */
/** AI-tutor chat default YOPIQ — fokus markazda; tugma bilan ochiladi. */
const CHAT_KEY = "meduni.lesson.chat";

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
  /** Mobilda (lg dan kichik) 3 ustun sig'maydi: kontent yolg'iz qoladi, rail va
   *  chat esa pastdan chiqadigan `Sheet`da ochiladi. Desktop tartibi o'zgarmaydi. */
  const compact = useMediaQuery(COMPACT_QUERY);
  /** Mobil chat paneli HAR DOIM yopiq boshlanadi. */
  const [mobileChat, setMobileChat] = useState(false);

  // 2026-08-01: chap ustun (rail) o'rniga tepadagi tasma — bo'limlar ro'yxati va
  // manbalar TUGMA ortida turadi va faqat so'ralganda ochiladi (kontent sahna).
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Chat default YOPIQ (foydalanuvchi: "chat ko'rinmasin, fokus markazda").
  const [chatOpen, setChatOpen] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(CHAT_KEY) === "open"
  );
  const toggleChat = () => {
    if (compact) return setMobileChat((o) => !o);
    setChatOpen((o) => {
      const next = !o;
      try {
        window.localStorage.setItem(CHAT_KEY, next ? "open" : "closed");
      } catch {}
      return next;
    });
  };

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

  // Faza 1: konspekt bo'limidan "Videoda: mm:ss" chipi — video ko'rinishiga o'tib
  // o'sha sekundga sakraydi (?t=). Rail'dan video ochilsa ?t bo'lmaydi → sakramaydi.
  const seekRaw = params.get("t");
  const seekTo = seekRaw !== null && seekRaw !== "" && Number.isFinite(Number(seekRaw)) ? Number(seekRaw) : null;
  const seekVideo = (sec: number) => setParams({ view: "video", t: String(Math.max(0, Math.floor(sec))) }, { replace: true });

  // Faza 2: mindmap bo'lim tugunidan konspektga o'tib o'sha bo'limga sakraydi.
  const jumpToSection = (i: number) => {
    setView("konspekt");
    setJumpTo(i);
    setTimeout(() => setJumpTo(null), 600);
  };

  // Konspekt endi butunlay ko'rinadi — `section` faqat TOC'dan sakrash uchun,
  // `visibleSection` esa skroll paytida qaysi bo'lim ko'rinayotganini bildiradi.
  const sections = lesson.sections ?? [];

  // O'rganish bloklari (chap ustunda tanlanadi).
  const studyBlocks: ContentView[] = [];
  if (lesson.digest || sections.length > 0) studyBlocks.push("konspekt");
  if (lesson.tabs.slides) studyBlocks.push("slides");
  if (lesson.tabs.video) studyBlocks.push("video");
  // Mindmap — bo'limli konspekt bo'lsa (navigatsiya xaritasi, AI'siz).
  if (sections.length > 0) studyBlocks.push("mindmap");
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
    view === "flashcards" ||
    view === "mindmap";
  /** 3 panel FAQAT o'rganishda. Test/keys/kartalar/natija/overview — FOKUSLI
   *  yakka interfeys: chap rail ham, chat ham ko'rsatilmaydi (foydalanuvchi:
   *  "bu interfeys faqat o'rganish uchun; test/natija/keys/flashcard uchun
   *  alohida interfeys"). Halollik ham shu bilan hal: test paytida material/chat
   *  umuman yo'q. */
  const focusMode = !isStudyView;
  // O'rganish kontenti umuman bo'lmasa (faqat test bor demo mavzu kabi) — bo'sh
  // rail ko'rsatmaymiz; ContentPanel "tayyorlanmoqda" bo'sh-holatini to'liq eninда beradi.
  const hasStudy = studyBlocks.length > 0;
  const chatSheetOpen = compact && mobileChat;
  /** Tugmaning "yoqilgan" ko'rinishi ekran o'lchamiga qarab. */
  const chatActive = compact ? mobileChat : chatOpen;

  /** Test jarayonida (tugallanmagan urinish) — halollik rejimi (o'rganish
   *  ko'rinishiga qaytilganda material/chat qulflanadi). */
  const quizRunning = !!lesson.tabs.quiz?.inProgressId;

  return (
    <div className="flex flex-col lg:h-full">
      {/* Breadcrumb — chap brand aksent chizig'i + mavzu chipi */}
      <div className="relative flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line bg-surface py-2 pl-3 pr-3">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand to-violet" aria-hidden />
        <button
          onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
          className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-note font-bold text-brand-tint transition-colors hover:bg-brand-soft"
        >
          <Icon icon={ArrowLeft} size={14} />
          {lesson.subjectName}
        </button>
        <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-brand-tint">
          {t("topic")} {lesson.orderIndex}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-section font-extrabold tracking-tight text-ink">{lesson.title}</h1>

        {/* O'rganish rejimidagi tugmalar: chap rail + AI-tutor chat toggle. */}
        {!focusMode && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={toggleChat}
              title={t("chatTitle")}
              className={cls(
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                chatActive
                  ? "bg-brand-soft text-brand-tint ring-1 ring-brand/30"
                  : "border border-brand/30 bg-gradient-to-r from-brand/15 to-violet/15 text-brand-tint hover:from-brand/25 hover:to-violet/25"
              )}
            >
              <Icon icon={chatActive ? X : Sparkles} size={16} />
              {/* Mobilda faqat ikonka — sarlavha qatorida joy tor. */}
              <span className="hidden text-note sm:inline">{t("chatTitle")}</span>
            </button>
          </div>
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
              seekTo={seekTo}
              onSeekVideo={seekVideo}
              onJumpSection={jumpToSection}
            />
          )}
        </div>
      ) : (
        /* O'RGANISH REJIMI — KONTENT SAHNA: o'rganish menyusi endi chap ustun
           emas, tepadagi bitta tasma (StudyToolbar). Bo'limlar va manbalar
           tugma ortida — bosilganda ochiladi. Chat yopiq bo'lsa kontent butun
           kenglikni oladi. */
        <div
          className={cls(
            "grid gap-2.5 p-2.5 transition-[grid-template-columns] duration-200 ease-out lg:min-h-0 lg:flex-1",
            chatOpen ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-[minmax(0,1fr)_0px]"
          )}
        >
          <div className="order-1 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
            {hasStudy && (
              <StudyToolbar
                lesson={lesson}
                blocks={studyBlocks}
                active={activeBlock}
                onBlock={(v) => {
                  setJumpTo(null);
                  setSectionsOpen(false);
                  setView(v);
                }}
                sections={lesson.sections ?? []}
                visibleSection={visibleSection}
                onSection={(i) => {
                  if (view !== "konspekt") setView("konspekt");
                  setJumpTo(i);
                  setSectionsOpen(false);
                  // Bir xil bo'limni qayta bosish ham ishlashi uchun darhol tozalanadi.
                  setTimeout(() => setJumpTo(null), 600);
                }}
                sectionsOpen={sectionsOpen}
                onToggleSections={() => setSectionsOpen((o) => !o)}
                sourcesCount={(lesson.materials?.length ?? 0) + (lesson.links?.length ?? 0)}
                sourcesOpen={sourcesOpen}
                onToggleSources={() => setSourcesOpen((o) => !o)}
              />
            )}

            {/* Manbalar — faqat so'ralganda (o'qish maydonini yemasin) */}
            {sourcesOpen && (
              <div className="shrink-0 border-b border-line px-2 py-2">
                <MaterialBar
                  materials={lesson.materials}
                  links={lesson.links}
                  locked={quizRunning}
                  lockedNote={t("materialsLockedQuiz")}
                />
              </div>
            )}

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
              seekTo={seekTo}
              onSeekVideo={seekVideo}
              onJumpSection={jumpToSection}
            />
          </div>

          {/* AI-tutor — YOPIQ bo'lsa umuman yo'q (fokus markazda); ochilsa keng panel.
              Test paytida qulf. Mobilda bu ustun emas, pastdagi Sheet. */}
          <div className="order-2 flex min-h-0 flex-col overflow-hidden lg:order-3">
            {!compact && chatOpen && <ChatPanel topicId={topicId} locked={quizRunning} onClose={toggleChat} />}
          </div>
        </div>
      )}

      {/* ——— Mobil panellar (lg dan kichik). Fokus rejimida (test/keys/natija)
          ular umuman ochilmaydi — halollik strukturaviy. ——— */}
      {compact && !focusMode && (
        <>
          {/* Chat sheet'i balandroq: yozishmani ko'rish uchun. `disableDrag` —
              ichidagi skroll bilan tortish jesti to'qnashmasin. */}
          <Sheet
            open={chatSheetOpen}
            onClose={() => setMobileChat(false)}
            title={t("chatTitle")}
            className="h-[85dvh]"
            disableDrag
          >
            <div className="flex h-[calc(85dvh-72px)] flex-col">
              <ChatPanel topicId={topicId} locked={quizRunning} onClose={() => setMobileChat(false)} />
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}
