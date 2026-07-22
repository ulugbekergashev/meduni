import { useTranslation } from "react-i18next";
import { ArrowLeft, BookText, ClipboardList, FileText, Stethoscope, Trophy, Video } from "lucide-react";
import { EmptyState, Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { Panel } from "./Panel";
import { firstContentView, type ContentView, type LessonView } from "./stages";
import { DigestView } from "./DigestView";
import { SectionReader } from "./SectionReader";
import { VideoTab } from "./VideoTab";
import { SlidesTab } from "./SlidesTab";
import { QuizTab } from "./QuizTab";
import { CaseTab } from "./CaseTab";
import { ResultPanel } from "./ResultPanel";

const SUBTAB_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  video: Video,
  slides: FileText,
};

const SURFACE_ICON = { case: Stethoscope, quiz: ClipboardList, result: Trophy } as const;

export function ContentPanel({
  lesson,
  topicId,
  view,
  setView,
  section,
  onSection,
  onMarkRead,
}: {
  lesson: Lesson;
  topicId: number;
  view: LessonView;
  setView: (v: LessonView) => void;
  /** 1a — faol konspekt bo'limi. */
  section: number;
  onSection: (index: number) => void;
  onMarkRead: (index: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const hasSections = (lesson.sections?.length ?? 0) > 0;

  const contentTabs: ContentView[] = [];
  if (lesson.digest || hasSections) contentTabs.push("konspekt");
  if (lesson.tabs.video) contentTabs.push("video");
  if (lesson.tabs.slides) contentTabs.push("slides");

  const isContentView = view === "konspekt" || view === "video" || view === "slides";

  // ---- Baholash / natija yuzasi: shapkada orqaga qaytish ----
  if (!isContentView) {
    const key = view as "case" | "quiz" | "result";
    return (
      <Panel
        header={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(firstContentView(lesson))}
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-note font-semibold text-brand-deep transition-colors hover:bg-bg"
            >
              <Icon icon={ArrowLeft} size={14} />
              {t("backToContent")}
            </button>
            <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-note font-bold text-ink">
              <Icon icon={SURFACE_ICON[key]} size={14} className="text-ink-faint" />
              {t(`stage_${key === "result" ? "result" : key}`)}
            </span>
          </div>
        }
        bodyClassName="p-3"
      >
        {view === "case" && lesson.tabs.case && <CaseTab topicId={topicId} data={lesson.tabs.case} />}
        {view === "quiz" && lesson.tabs.quiz && <QuizTab topicId={topicId} data={lesson.tabs.quiz} />}
        {view === "result" && <ResultPanel lesson={lesson} />}
      </Panel>
    );
  }

  // ---- Kontent yo'q: o'rta panel hech qachon bo'sh qolmaydi ----
  if (contentTabs.length === 0) {
    return (
      <Panel title={t("tab_konspekt")} icon={BookText} bodyClassName="p-3">
        <EmptyState icon={<Icon icon={BookText} size={20} />} text={t("contentPreparing")} />
      </Panel>
    );
  }

  const active: ContentView = contentTabs.includes(view as ContentView) ? (view as ContentView) : contentTabs[0];
  // Bo'limli o'qish o'z layoutini boshqaradi (pillar + skroll + pastki bar).
  const readerMode = active === "konspekt" && hasSections;

  return (
    <Panel
      header={
        contentTabs.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1">
            {contentTabs.map((c) => {
              const on = c === active;
              return (
                <button
                  key={c}
                  onClick={() => setView(c)}
                  className={cls(
                    "inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-note font-extrabold transition-colors",
                    on ? "bg-brand-soft text-brand-tint" : "text-ink-faint hover:bg-surface-raised hover:text-ink"
                  )}
                >
                  <Icon icon={SUBTAB_ICON[c]} size={14} className={on ? "" : "text-ink-dim"} />
                  {t(`tab_${c}`)}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
      title={contentTabs.length === 1 ? t(`tab_${active}`) : undefined}
      icon={contentTabs.length === 1 ? SUBTAB_ICON[active] : undefined}
      bodyClassName={readerMode ? "p-0" : "p-4"}
    >
      {active === "konspekt" &&
        (readerMode ? (
          <SectionReader
            sections={lesson.sections}
            active={section}
            onActive={onSection}
            onMarkRead={onMarkRead}
          />
        ) : (
          lesson.digest && <DigestView digest={lesson.digest} />
        ))}
      {active === "video" && lesson.tabs.video && (
        <VideoTab topicId={topicId} data={lesson.tabs.video} threshold={lesson.thresholds.video} />
      )}
      {active === "slides" && lesson.tabs.slides && <SlidesTab topicId={topicId} data={lesson.tabs.slides} />}
    </Panel>
  );
}
