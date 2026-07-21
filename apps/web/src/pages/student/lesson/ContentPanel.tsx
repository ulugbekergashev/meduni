import { useTranslation } from "react-i18next";
import { ArrowLeft, BookText, FileText, Video } from "lucide-react";
import { Card, EmptyState, Icon, cls } from "@meduni/ui";
import type { Lesson } from "../api";
import { firstContentView, type ContentView, type LessonView } from "./stages";
import { DigestView } from "./DigestView";
import { VideoTab } from "./VideoTab";
import { SlidesTab } from "./SlidesTab";
import { QuizTab } from "./QuizTab";
import { CaseTab } from "./CaseTab";
import { ResultPanel } from "./ResultPanel";

const SUBTAB_TONE: Record<ContentView, string> = {
  konspekt: "bg-brand-soft text-brand-deep",
  video: "bg-violet-soft text-violet",
  slides: "bg-brand-soft text-brand-deep",
};

const SUBTAB_ICON: Record<ContentView, typeof BookText> = {
  konspekt: BookText,
  video: Video,
  slides: FileText,
};

export function ContentPanel({
  lesson,
  topicId,
  view,
  setView,
}: {
  lesson: Lesson;
  topicId: number;
  view: LessonView;
  setView: (v: LessonView) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  const contentTabs: ContentView[] = [];
  if (lesson.digest) contentTabs.push("konspekt");
  if (lesson.tabs.video) contentTabs.push("video");
  if (lesson.tabs.slides) contentTabs.push("slides");

  const isContentView = view === "konspekt" || view === "video" || view === "slides";

  // Assessment / natija yuzasi — to'liq kenglik + "kontentga qaytish".
  if (!isContentView) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView(firstContentView(lesson))}
          className="inline-flex items-center gap-1.5 text-note font-semibold text-brand-deep hover:underline"
        >
          <Icon icon={ArrowLeft} size={15} />
          {t("backToContent")}
        </button>
        {view === "case" && lesson.tabs.case && <CaseTab topicId={topicId} data={lesson.tabs.case} />}
        {view === "quiz" && lesson.tabs.quiz && <QuizTab topicId={topicId} data={lesson.tabs.quiz} />}
        {view === "result" && <ResultPanel lesson={lesson} />}
      </div>
    );
  }

  // Kontent bo'lmasa — o'rta panel hech qachon bo'sh emas.
  if (contentTabs.length === 0) {
    return (
      <Card className="py-10">
        <EmptyState icon={<Icon icon={BookText} size={22} />} text={t("contentPreparing")} />
      </Card>
    );
  }

  const activeContent: ContentView = contentTabs.includes(view as ContentView)
    ? (view as ContentView)
    : contentTabs[0];

  return (
    <div className="space-y-4">
      {contentTabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {contentTabs.map((c) => {
            const on = c === activeContent;
            return (
              <button
                key={c}
                onClick={() => setView(c)}
                className={cls(
                  "inline-flex items-center gap-2 rounded-control border px-4 py-2 text-body font-bold transition-colors",
                  on ? `${SUBTAB_TONE[c]} border-transparent` : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
                )}
              >
                <Icon icon={SUBTAB_ICON[c]} size={16} className={on ? "" : "text-ink-faint"} />
                {t(`tab_${c}`)}
              </button>
            );
          })}
        </div>
      )}

      <div>
        {activeContent === "konspekt" && lesson.digest && (
          <Card>
            <DigestView digest={lesson.digest} />
          </Card>
        )}
        {activeContent === "video" && lesson.tabs.video && (
          <VideoTab topicId={topicId} data={lesson.tabs.video} threshold={lesson.thresholds.video} />
        )}
        {activeContent === "slides" && lesson.tabs.slides && <SlidesTab topicId={topicId} data={lesson.tabs.slides} />}
      </div>
    </div>
  );
}
