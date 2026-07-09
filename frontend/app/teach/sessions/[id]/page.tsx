"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCheck, IconHome, IconQr } from "@/components/Icons";
import Shell from "@/components/Shell";
import { Avatar, Badge, Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Row = { student_id: number; student_name: string; status: string | null; method: string | null };
type Session = { id: number; course_id: number; room: string | null; attendance_open: boolean };
type Live = { session: Session; rows: Row[]; present_count: number; total: number };

const statusTone = { present: "green", late: "amber", absent: "red", excused: "slate" } as const;
const cycle = ["present", "late", "absent", "excused"];

export default function SessionScreen() {
  const { me } = useRequireRole("teacher");
  const t = useTranslations("attend");
  const tn = useTranslations("nav");
  const params = useParams();
  const sessionId = Number(params.id);
  const queryClient = useQueryClient();
  const [qrTick, setQrTick] = useState(0);

  const { data } = useQuery({
    queryKey: ["session-live", sessionId],
    queryFn: () => api<Live>(`/sessions/${sessionId}/live`),
    enabled: !!me,
    refetchInterval: 3000,  // живой список
  });

  // обновляем QR каждые 10 сек (токен ротируется на бэкенде каждые 15)
  useEffect(() => {
    const timer = setInterval(() => setQrTick((x) => x + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["session-live", sessionId] });

  const toggleOpen = useMutation({
    mutationFn: (open: boolean) =>
      api(`/sessions/${sessionId}/${open ? "open" : "close"}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const mark = useMutation({
    mutationFn: (payload: { student_id: number; status: string }) =>
      api(`/sessions/${sessionId}/attendance`, { method: "PATCH", body: payload }),
    onSuccess: invalidate,
  });

  if (!me || !data) return null;
  const open = data.session.attendance_open;

  return (
    <Shell me={me} variant="sidebar" nav={[{ href: "/teach", label: tn("dashboard"), icon: <IconHome /> }]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <IconQr className="text-teal-600" /> {t("liveList")}
          <Badge tone={open ? "green" : "slate"}>{open ? t("openBadge") : t("closedBadge")}</Badge>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{t("presentOf", { present: data.present_count, total: data.total })}</span>
          <a href={`/api/v1/courses/${data.session.course_id}/attendance.xlsx`}
             className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500">
            {t("exportJournal")}
          </a>
          <Button variant={open ? "outline" : "primary"} onClick={() => toggleOpen.mutate(!open)}>
            {open ? t("close") : t("open")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Большой QR для проектора */}
        <Card className="flex flex-col items-center justify-center p-6">
          {open ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={qrTick} src={`/api/v1/sessions/${sessionId}/qr.png?t=${qrTick}`}
                   alt="QR" className="h-72 w-72" />
              <p className="mt-3 text-center text-sm text-slate-500">{t("scanToCheck")}</p>
            </>
          ) : (
            <div className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 text-slate-400">
              <IconQr className="text-5xl" />
              <p className="text-sm">{t("open")}</p>
            </div>
          )}
        </Card>

        {/* Живой список */}
        <div className="space-y-2">
          {data.rows.map((row) => (
            <Card key={row.student_id} className="flex items-center gap-3 p-3">
              <Avatar name={row.student_name} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-slate-800">{row.student_name}</span>
              {row.status ? (
                <Badge tone={statusTone[row.status as keyof typeof statusTone] ?? "slate"}
                       onClick={() => {
                         const next = cycle[(cycle.indexOf(row.status!) + 1) % cycle.length];
                         mark.mutate({ student_id: row.student_id, status: next });
                       }}>
                  {t(row.status as never)}
                </Badge>
              ) : (
                <button onClick={() => mark.mutate({ student_id: row.student_id, status: "present" })}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                  {t("notMarked")}
                </button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}
