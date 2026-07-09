"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import DigestEditor, { type Digest } from "@/components/DigestEditor";
import {
  IconArrowLeft, IconCheck, IconFile, IconHome, IconLock, IconSparkles, IconSpinner, IconTrash, IconUpload,
} from "@/components/Icons";
import Shell from "@/components/Shell";
import TopicContentSection from "@/components/TopicContentSection";
import { Badge, Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Material = { id: number; file_name: string; file_type: string; parse_status: string; parse_error: string | null };
type DigestData = { id: number; digest_json: Digest; version: number; approved_by_teacher: boolean };
type Job = { id: number; kind: string; status: string; steps_json: { step: string; status: string }[]; error: string | null; tokens_used: number };
type TopicDetail = {
  topic: { id: number; course_id: number; title_uz: string; title_ru: string };
  materials: Material[];
  digest: DigestData | null;
  active_job: Job | null;
};

const parseTone = { done: "green", error: "red", running: "amber", pending: "slate" } as const;

export default function TopicConstructor() {
  const { me } = useRequireRole(["teacher", "admin"]);
  const t = useTranslations("topics");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const params = useParams();
  const topicId = Number(params.id);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);

  const jobRunning = (job: Job | null | undefined) => job != null && (job.status === "queued" || job.status === "running");
  const parsePending = (materials?: Material[]) =>
    materials?.some((m) => m.parse_status === "pending" || m.parse_status === "running") ?? false;

  const { data } = useQuery({
    queryKey: ["topic", topicId],
    queryFn: () => api<TopicDetail>(`/topics/${topicId}`),
    enabled: !!me,
    refetchInterval: (query) => {
      const d = query.state.data as TopicDetail | undefined;
      return jobRunning(d?.active_job) || parsePending(d?.materials) ? 1500 : false;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["topic", topicId] });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api(`/topics/${topicId}/materials`, { method: "POST", formData: fd });
    },
    onSuccess: () => {
      setUploadError(null);
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const removeMaterial = useMutation({
    mutationFn: (id: number) => api(`/materials/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const generate = useMutation({
    mutationFn: () => api(`/topics/${topicId}/digest/generate`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (err: Error) => setUploadError(err.message),
  });

  const saveDigest = useMutation({
    mutationFn: (digest: Digest) =>
      api(`/topics/${topicId}/digest`, { method: "PUT", body: { digest_json: digest } }),
    onSuccess: () => {
      setSavedFlag(true);
      invalidate();
    },
  });

  const approve = useMutation({
    mutationFn: () => api(`/topics/${topicId}/digest/approve`, { method: "POST" }),
    onSuccess: invalidate,
  });

  if (!me || !data) return null;
  const { topic, materials, digest, active_job } = data;
  const hasParsed = materials.some((m) => m.parse_status === "done");
  const generating = jobRunning(active_job);

  const stepLabel: Record<string, string> = {
    collect: t("jobCollect"), llm: t("jobLlm"), save: t("jobSave"),
  };

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href={`/teach/courses/${topic.course_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" />
        {t("backToCourse")}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {locale === "ru" ? topic.title_ru : topic.title_uz}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{locale === "ru" ? topic.title_uz : topic.title_ru}</p>
      </div>

      {/* Шаг 1: материалы */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <IconFile className="text-teal-600" /> {t("step1")}
          </h2>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700">
            <IconUpload />
            {t("upload")}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
            />
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-400">{t("uploadHint")}</p>
        {uploadError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{uploadError}</p>}
        {materials.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-slate-400">{t("noMaterials")}</Card>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3">
                <IconFile className="shrink-0 text-lg text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{m.file_name}</p>
                  {m.parse_error && <p className="truncate text-xs text-rose-500">{m.parse_error}</p>}
                </div>
                <Badge tone={parseTone[m.parse_status as keyof typeof parseTone] ?? "slate"}>
                  {t(`parse${m.parse_status.charAt(0).toUpperCase() + m.parse_status.slice(1)}` as never)}
                </Badge>
                <button
                  onClick={() => removeMaterial.mutate(m.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <IconTrash className="text-base" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Шаг 2: генерация конспекта */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <IconSparkles className="text-teal-600" /> {t("step2")}
          </h2>
          <Button
            onClick={() => generate.mutate()}
            disabled={!hasParsed || generating}
            variant={digest ? "outline" : "primary"}
          >
            {generating ? <IconSpinner /> : <IconSparkles />}
            {generating ? t("generating") : digest ? t("regenerate") : t("generateDigest")}
          </Button>
        </div>

        {/* Прогресс job */}
        {active_job && (generating || active_job.status === "error") && (
          <Card className="mb-4 p-4">
            {active_job.status === "error" ? (
              <p className="text-sm text-rose-600">{t("jobError")}: {active_job.error}</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {["collect", "llm", "save"].map((step) => {
                  const s = active_job.steps_json.find((x) => x.step === step);
                  const status = s?.status ?? "pending";
                  return (
                    <div key={step} className="flex items-center gap-2 text-sm">
                      {status === "done" ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <IconCheck className="text-xs" />
                        </span>
                      ) : status === "running" ? (
                        <IconSpinner className="text-teal-600" />
                      ) : (
                        <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
                      )}
                      <span className={cls(status === "done" ? "text-slate-700" : "text-slate-400")}>
                        {stepLabel[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {!digest ? (
          <Card className="px-4 py-8 text-center text-sm text-slate-400">{t("digestEmpty")}</Card>
        ) : (
          <>
            {/* Статус утверждения — контрольная точка */}
            <Card className={cls("mb-4 flex flex-wrap items-center justify-between gap-3 p-4",
              digest.approved_by_teacher ? "ring-1 ring-emerald-500/30" : "ring-1 ring-amber-500/30")}>
              <div className="flex items-center gap-2.5">
                {digest.approved_by_teacher
                  ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><IconCheck /></span>
                  : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IconLock /></span>}
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {digest.approved_by_teacher ? t("approved") : t("notApproved")}
                    <span className="ml-2 text-xs font-normal text-slate-400">{t("version")} {digest.version}</span>
                  </p>
                  <p className="text-xs text-slate-500">{t("generationGate")}</p>
                </div>
              </div>
              {!digest.approved_by_teacher && (
                <Button onClick={() => approve.mutate()}>
                  <IconCheck /> {t("approve")}
                </Button>
              )}
            </Card>

            <DigestEditor
              initial={digest.digest_json}
              onSave={(d) => saveDigest.mutate(d)}
              saving={saveDigest.isPending}
              saved={savedFlag}
            />
          </>
        )}
      </section>

      {/* Шаг 3: генерация теста и кейса (доступно после утверждения конспекта) */}
      <section>
        <h2 className={cls("mb-1 flex items-center gap-2 text-lg font-semibold",
          digest?.approved_by_teacher ? "text-slate-800" : "text-slate-400")}>
          {digest?.approved_by_teacher ? <IconSparkles className="text-teal-600" /> : <IconLock className="text-slate-300" />}
          {t("step3")}
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          {digest?.approved_by_teacher ? t("nextStepLocked") : t("approvedHint")}
        </p>
        <TopicContentSection topicId={topicId} enabled={!!digest?.approved_by_teacher} />
      </section>
    </Shell>
  );
}
