"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconCheck, IconFile, IconHome, IconSparkles, IconSpinner } from "@/components/Icons";
import ReadinessPanel from "@/components/ReadinessPanel";
import Shell from "@/components/Shell";
import { Badge, Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type ScriptItem = { slide_index: number; text: string };
type VideoDetail = {
  content: { id: number; status: string; topic_id: number };
  language: string;
  script_json: ScriptItem[];
  voice_id: string | null;
  mp4_url: string | null;
  srt_url: string | null;
  duration_sec: number;
  video_stale: boolean;
};
type Job = { id: number; status: string; steps_json: { step: string; status: string }[]; error: string | null };

export default function VideoEditorPage() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("content");
  const tn = useTranslations("nav");
  const params = useParams();
  const contentId = Number(params.id);
  const queryClient = useQueryClient();
  const [script, setScript] = useState<ScriptItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [buildJobId, setBuildJobId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["video", contentId],
    queryFn: () => api<VideoDetail>(`/videos/${contentId}`),
    enabled: !!me,
  });

  useEffect(() => {
    if (data) setScript(data.script_json);
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["video", contentId] });

  // поллинг сборки видео
  const { data: buildJob } = useQuery({
    queryKey: ["video-build", buildJobId],
    queryFn: () => api<Job>(`/jobs/${buildJobId}`),
    enabled: buildJobId !== null,
    refetchInterval: (q) => {
      const s = (q.state.data as Job | undefined)?.status;
      if (s === "done" || s === "error") {
        setBuildJobId(null);
        invalidate();
        return false;
      }
      return 2000;
    },
  });

  const save = useMutation({
    mutationFn: () => api(`/videos/${contentId}`, { method: "PUT", body: { script_json: script } }),
    onSuccess: () => { setSaved(true); invalidate(); },
  });

  const build = useMutation({
    mutationFn: () => api<{ job_id: number }>(`/videos/${contentId}/build`, { method: "POST" }),
    onSuccess: (res) => setBuildJobId(res.job_id),
  });

  if (!me || !data) return null;
  const published = data.content.status === "published";
  const building = buildJobId !== null || build.isPending;
  const stepLabel: Record<string, string> = {
    tts: t("jobTts"), ffmpeg: t("jobFfmpeg"),
  };

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href={`/teach/topics/${data.content.topic_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("backToTopic")}
      </Link>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconSparkles className="text-teal-600" /> {t("video")}
      </h1>
      <p className="mb-4 text-sm text-slate-400">{t("voice")}: {data.voice_id} · {data.language.toUpperCase()}</p>

      {published && <p className="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{t("publishedLocked")}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Плеер / статус */}
          <Card className="overflow-hidden">
            {data.mp4_url && !data.video_stale ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video controls className="w-full bg-black" src={`/api/v1/media/${data.mp4_url}`}
                     poster="" style={{ maxHeight: 420 }}>
                {data.srt_url && <track kind="subtitles" srcLang={data.language}
                                       src={`/api/v1/media/${data.srt_url}`} default />}
              </video>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 bg-slate-900 py-16 text-slate-400">
                <IconFile className="text-3xl" />
                <p className="text-sm">{t("noVideoYet")}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {data.duration_sec > 0 && <span>{t("duration")}: {data.duration_sec}s</span>}
                {data.video_stale && data.mp4_url && (
                  <Badge tone="amber">{t("videoStale")}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {data.srt_url && (
                  <a href={`/api/v1/media/${data.srt_url}`} target="_blank" rel="noreferrer"
                     className="text-sm text-teal-600 hover:underline">{t("downloadSrt")}</a>
                )}
                {!published && (
                  <Button onClick={() => build.mutate()} disabled={building}>
                    {building ? <IconSpinner /> : <IconSparkles />}
                    {building ? t("building") : data.mp4_url ? t("rebuildVideo") : t("buildVideo")}
                  </Button>
                )}
              </div>
            </div>
            {/* прогресс сборки */}
            {building && buildJob && (
              <div className="flex gap-4 border-t border-slate-100 px-4 py-3">
                {["tts", "ffmpeg"].map((step) => {
                  const s = buildJob.steps_json.find((x) => x.step === step);
                  const status = s?.status ?? "pending";
                  return (
                    <div key={step} className="flex items-center gap-2 text-sm">
                      {status === "done" ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <IconCheck className="text-xs" />
                        </span>
                      ) : status === "running" ? <IconSpinner className="text-teal-600" />
                        : <span className="h-5 w-5 rounded-full border-2 border-slate-200" />}
                      <span className={cls(status === "done" ? "text-slate-700" : "text-slate-400")}>
                        {stepLabel[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {buildJob?.status === "error" && (
              <p className="border-t border-slate-100 px-4 py-3 text-sm text-rose-600">{buildJob.error}</p>
            )}
          </Card>

          {/* Сценарий */}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("script")}</h2>
            <div className="space-y-3">
              {script.map((item, i) => (
                <Card key={i} className="p-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-400">{t("scriptSlide")} {item.slide_index + 1}</p>
                  <textarea value={item.text} disabled={published} rows={2}
                            onChange={(e) => {
                              setScript((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)));
                              setSaved(false);
                            }}
                            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {!published && (
            <div className="flex items-center gap-3">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
              {saved && <span className="text-sm text-emerald-600">{t("saved")}</span>}
            </div>
          )}
          <ReadinessPanel contentId={contentId} status={data.content.status} onChanged={invalidate} />
        </div>
      </div>
    </Shell>
  );
}
