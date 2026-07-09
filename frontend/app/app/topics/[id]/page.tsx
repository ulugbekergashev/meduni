"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import LessonCase from "@/components/lesson/LessonCase";
import LessonQuiz from "@/components/lesson/LessonQuiz";
import { IconArrowLeft, IconCheck, IconFile } from "@/components/Icons";
import Shell from "@/components/Shell";
import { Badge, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Bilingual = { uz: string; ru: string };
type Slide = { title_uz: string; title_ru: string; bullets_uz: string[]; bullets_ru: string[]; image_url: string | null };
type Lesson = {
  topic_id: number;
  course_id: number;
  title_uz: string;
  title_ru: string;
  state: string;
  video: { content_id: number; mp4_url: string; srt_url: string | null; duration_sec: number; language: string } | null;
  presentation: { content_id: number; slides_json: Slide[] } | null;
  quiz: Parameters<typeof LessonQuiz>[0]["quiz"] | null;
  case: Parameters<typeof LessonCase>[0]["caseView"] | null;
};

export default function LessonPage() {
  const { me } = useRequireRole("student");
  const t = useTranslations("learn");
  const locale = useLocale();
  const params = useParams();
  const topicId = Number(params.id);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"video" | "presentation" | "quiz" | "case">("video");
  const lastSent = useRef(0);

  const { data } = useQuery({
    queryKey: ["lesson", topicId],
    queryFn: () => api<Lesson>(`/me/learn/topics/${topicId}`),
    enabled: !!me,
  });

  const sendProgress = useMutation({
    mutationFn: (pct: number) =>
      api(`/me/learn/topics/${topicId}/video-progress`, { method: "POST", body: { pct } }),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["lesson", topicId] });

  if (!me || !data) return null;

  const tabs = [
    data.video && { id: "video", label: t("video") },
    data.presentation && { id: "presentation", label: t("presentation") },
    data.quiz && { id: "quiz", label: t("quiz") },
    data.case && { id: "case", label: t("case") },
  ].filter(Boolean) as { id: typeof tab; label: string }[];

  const activeTab = tabs.find((x) => x.id === tab) ? tab : tabs[0]?.id ?? "video";

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.duration) return;
    const pct = Math.round((v.currentTime / v.duration) * 100);
    if (pct >= lastSent.current + 5) {  // шлём не чаще, чем каждые 5%
      lastSent.current = pct;
      sendProgress.mutate(pct);
    }
  };

  return (
    <Shell me={me} variant="top">
      <Link href={`/app/courses/${data.course_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("backToCourse")}
      </Link>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">{locale === "ru" ? data.title_ru : data.title_uz}</h1>
        {data.state === "completed" && <Badge tone="green"><IconCheck className="mr-1 text-xs" />{t("completed")}</Badge>}
      </div>

      {/* Вкладки */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            className={cls("shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === x.id ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
            {x.label}
          </button>
        ))}
      </div>

      {activeTab === "video" && data.video && (
        <Card className="overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls className="w-full bg-black" style={{ maxHeight: 460 }}
                 src={`/api/v1/media/${data.video.mp4_url}`} onTimeUpdate={onTimeUpdate}>
            {data.video.srt_url && (
              <track kind="subtitles" srcLang={data.video.language} default
                     src={`/api/v1/media/${data.video.srt_url}`} />
            )}
          </video>
        </Card>
      )}

      {activeTab === "presentation" && data.presentation && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <a href={`/api/v1/presentations/${data.presentation.content_id}/download?lang=${locale}`}
               className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700">
              <IconFile /> {t("downloadPptx")}
            </a>
          </div>
          {data.presentation.slides_json.map((slide, i) => (
            <Card key={i} className="p-5">
              <p className="mb-1 text-xs font-medium text-slate-400">{t("slide")} {i + 1}</p>
              <h3 className="mb-3 text-lg font-bold text-teal-700">
                {locale === "ru" ? slide.title_ru : slide.title_uz}
              </h3>
              <div className="flex flex-wrap gap-4">
                <ul className="flex-1 space-y-1.5 text-sm text-slate-700">
                  {(locale === "ru" ? slide.bullets_ru : slide.bullets_uz).map((b, j) => (
                    <li key={j} className="flex gap-2"><span className="text-teal-500">•</span>{b}</li>
                  ))}
                </ul>
                {slide.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/v1/media/${slide.image_url}`} alt=""
                       className="h-40 w-52 rounded-lg border border-slate-200 object-cover" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "quiz" && data.quiz && <LessonQuiz quiz={data.quiz} onDone={refetch} />}
      {activeTab === "case" && data.case && <LessonCase caseView={data.case} onDone={refetch} />}
    </Shell>
  );
}
