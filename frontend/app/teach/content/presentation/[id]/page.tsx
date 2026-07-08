"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconFile, IconHome, IconPlus, IconSparkles, IconSpinner, IconTrash } from "@/components/Icons";
import ReadinessPanel from "@/components/ReadinessPanel";
import Shell from "@/components/Shell";
import { Badge, Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Slide = {
  title_uz: string;
  title_ru: string;
  bullets_uz: string[];
  bullets_ru: string[];
  notes_uz: string;
  notes_ru: string;
  image_prompt: string;
  image_url: string | null;
  image_status: string;
};
type PresDetail = {
  content: { id: number; status: string; topic_id: number };
  slides_json: Slide[];
  pptx_stale: boolean;
};

const imgTone = { done: "green", error: "red", running: "amber", idle: "slate" } as const;

function BulletList({ items, disabled, onChange, addLabel }: {
  items: string[]; disabled: boolean; onChange: (v: string[]) => void; addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-teal-500">•</span>
          <input value={b} disabled={disabled}
                 onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                 className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          {!disabled && (
            <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-rose-500">×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={() => onChange([...items, ""])}
                className="text-xs font-medium text-teal-600 hover:text-teal-700">+ {addLabel}</button>
      )}
    </div>
  );
}

export default function PresentationEditorPage() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("content");
  const tn = useTranslations("nav");
  const params = useParams();
  const contentId = Number(params.id);
  const queryClient = useQueryClient();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [saved, setSaved] = useState(false);

  const anyImageRunning = (data?: PresDetail) => data?.slides_json.some((s) => s.image_status === "running") ?? false;

  const { data } = useQuery({
    queryKey: ["presentation", contentId],
    queryFn: () => api<PresDetail>(`/presentations/${contentId}`),
    enabled: !!me,
    refetchInterval: (q) => (anyImageRunning(q.state.data as PresDetail | undefined) ? 2000 : false),
  });

  useEffect(() => {
    if (data) setSlides(data.slides_json);
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["presentation", contentId] });

  const save = useMutation({
    mutationFn: () => api(`/presentations/${contentId}`, { method: "PUT", body: { slides_json: slides } }),
    onSuccess: () => { setSaved(true); invalidate(); },
  });

  const genImage = useMutation({
    mutationFn: (index: number) =>
      api(`/presentations/${contentId}/slides/${index}/image`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const patch = (i: number, p: Partial<Slide>) => {
    setSlides((s) => s.map((sl, j) => (j === i ? { ...sl, ...p } : sl)));
    setSaved(false);
  };

  if (!me || !data) return null;
  const published = data.content.status === "published";
  const download = () => window.open(`/api/v1/presentations/${contentId}/download?lang=ru`, "_blank");

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href={`/teach/topics/${data.content.topic_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("backToTopic")}
      </Link>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconFile className="text-teal-600" /> {t("presentation")}
      </h1>

      {published && (
        <p className="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{t("publishedLocked")}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {slides.map((slide, i) => (
            <Card key={i} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">{t("slide")} {i + 1}</span>
                {!published && slides.length > 1 && (
                  <button onClick={() => { setSlides((s) => s.filter((_, j) => j !== i)); setSaved(false); }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <IconTrash className="text-base" />
                  </button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input value={slide.title_uz} disabled={published} placeholder={`${t("slideTitle")} (uz)`}
                       onChange={(e) => patch(i, { title_uz: e.target.value })}
                       className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" />
                <input value={slide.title_ru} disabled={published} placeholder={`${t("slideTitle")} (ru)`}
                       onChange={(e) => patch(i, { title_ru: e.target.value })}
                       className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" />
              </div>

              <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">{t("bullets")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <BulletList items={slide.bullets_uz} disabled={published} addLabel={t("addBullet")}
                            onChange={(v) => patch(i, { bullets_uz: v })} />
                <BulletList items={slide.bullets_ru} disabled={published} addLabel={t("addBullet")}
                            onChange={(v) => patch(i, { bullets_ru: v })} />
              </div>

              {/* Иллюстрация */}
              <div className="mt-4 flex flex-wrap items-start gap-4 border-t border-slate-100 pt-3">
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{t("imagePrompt")}</p>
                  <input value={slide.image_prompt} disabled={published} placeholder="e.g. human heart anatomy"
                         onChange={(e) => patch(i, { image_prompt: e.target.value })}
                         className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={imgTone[slide.image_status as keyof typeof imgTone] ?? "slate"}>
                      {t(`image${slide.image_status.charAt(0).toUpperCase() + slide.image_status.slice(1)}` as never)}
                    </Badge>
                    {!published && slide.image_prompt.trim() && (
                      <button onClick={() => genImage.mutate(i)} disabled={slide.image_status === "running"}
                              className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50">
                        {slide.image_status === "running" ? <IconSpinner className="text-sm" /> : <IconSparkles className="text-sm" />}
                        {slide.image_url ? t("regenerateImage") : t("generateImage")}
                      </button>
                    )}
                  </div>
                </div>
                {slide.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/v1/media/${slide.image_url}`} alt=""
                       className="h-24 w-32 rounded-lg border border-slate-200 object-cover" />
                )}
              </div>
            </Card>
          ))}

          {!published && (
            <Button variant="outline" onClick={() => {
              setSlides((s) => [...s, {
                title_uz: "", title_ru: "", bullets_uz: [""], bullets_ru: [""],
                notes_uz: "", notes_ru: "", image_prompt: "", image_url: null, image_status: "idle",
              }]);
              setSaved(false);
            }}>
              <IconPlus /> {t("addSlide")}
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {!published && (
            <div className="flex items-center gap-3">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
              {saved && <span className="text-sm text-emerald-600">{t("saved")}</span>}
            </div>
          )}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">PPTX</h3>
            {data.pptx_stale && <p className="mb-2 text-xs text-amber-600">{t("pptxStale")}</p>}
            <Button variant="outline" onClick={download} className="w-full justify-center">
              <IconFile /> {t("downloadPptx")}
            </Button>
          </Card>
          <ReadinessPanel contentId={contentId} status={data.content.status} onChanged={invalidate} />
        </div>
      </div>
    </Shell>
  );
}
