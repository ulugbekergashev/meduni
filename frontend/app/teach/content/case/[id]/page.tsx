"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconHome } from "@/components/Icons";
import ReadinessPanel from "@/components/ReadinessPanel";
import Shell from "@/components/Shell";
import { Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Bilingual = { uz: string; ru: string };
type CaseJson = {
  complaints: Bilingual;
  anamnesis: Bilingual;
  objective: Bilingual;
  labs: Bilingual;
  questions: Bilingual[];
  reference_analysis: Bilingual;
};
type Flag = { location: string; note: string; resolved: boolean };
type CaseDetail = {
  content: { id: number; status: string; topic_id: number };
  case_json: CaseJson;
  fmt: string;
  factcheck_json: Flag[];
};

const blocks: (keyof CaseJson)[] = ["complaints", "anamnesis", "objective", "labs", "reference_analysis"];

function TA({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
      className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
  );
}

export default function CaseEditorPage() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("content");
  const tn = useTranslations("nav");
  const params = useParams();
  const contentId = Number(params.id);
  const queryClient = useQueryClient();
  const [caseJson, setCaseJson] = useState<CaseJson | null>(null);
  const [fmt, setFmt] = useState("short");
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["case", contentId],
    queryFn: () => api<CaseDetail>(`/cases/${contentId}`),
    enabled: !!me,
  });

  useEffect(() => {
    if (data) { setCaseJson(data.case_json); setFmt(data.fmt); }
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["case", contentId] });

  const save = useMutation({
    mutationFn: () => api(`/cases/${contentId}`, { method: "PUT", body: { case_json: caseJson, fmt } }),
    onSuccess: () => { setSaved(true); invalidate(); },
  });

  if (!me || !data || !caseJson) return null;
  const published = data.content.status === "published";
  const flagFor = (loc: string) => data.factcheck_json.find((f) => f.location === loc && !f.resolved);

  const patchBlock = (key: keyof CaseJson, lang: "uz" | "ru", value: string) => {
    setCaseJson({ ...caseJson, [key]: { ...(caseJson[key] as Bilingual), [lang]: value } });
    setSaved(false);
  };

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <Link href={`/teach/topics/${data.content.topic_id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700">
        <IconArrowLeft className="text-base" /> {t("backToTopic")}
      </Link>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{t("case")}</h1>

      {published && (
        <p className="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{t("publishedLocked")}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {blocks.map((key) => {
            const flag = flagFor(key);
            return (
              <Card key={key} className={cls("p-4", flag && "ring-2 ring-rose-400/40")}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t(key)}</h3>
                {flag && (
                  <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <strong>{t("factcheckFlag")}.</strong> {flag.note}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <TA value={(caseJson[key] as Bilingual).uz} placeholder="uz"
                      onChange={(v) => patchBlock(key, "uz", v)} />
                  <TA value={(caseJson[key] as Bilingual).ru} placeholder="ru"
                      onChange={(v) => patchBlock(key, "ru", v)} />
                </div>
              </Card>
            );
          })}

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("caseQuestions")}</h3>
              {!published && (
                <button onClick={() => {
                  setCaseJson({ ...caseJson, questions: [...caseJson.questions, { uz: "", ru: "" }] });
                  setSaved(false);
                }} className="text-xl leading-none text-teal-600 hover:text-teal-700">+</button>
              )}
            </div>
            <div className="space-y-2">
              {caseJson.questions.map((q, i) => (
                <div key={i} className="group relative grid gap-2 rounded-lg bg-slate-50/60 p-2 pr-8 sm:grid-cols-2">
                  <TA value={q.uz} placeholder="uz" onChange={(v) => {
                    const arr = [...caseJson.questions]; arr[i] = { ...arr[i], uz: v };
                    setCaseJson({ ...caseJson, questions: arr }); setSaved(false);
                  }} />
                  <TA value={q.ru} placeholder="ru" onChange={(v) => {
                    const arr = [...caseJson.questions]; arr[i] = { ...arr[i], ru: v };
                    setCaseJson({ ...caseJson, questions: arr }); setSaved(false);
                  }} />
                  {!published && (
                    <button onClick={() => {
                      setCaseJson({ ...caseJson, questions: caseJson.questions.filter((_, j) => j !== i) });
                      setSaved(false);
                    }} className="absolute right-1.5 top-1.5 text-slate-300 hover:text-rose-500">×</button>
                  )}
                </div>
              ))}
            </div>
          </Card>
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
