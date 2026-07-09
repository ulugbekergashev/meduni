"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { IconCalendar, IconCamera, IconCheck } from "@/components/Icons";
import StudentShell from "@/components/StudentShell";
import { Badge, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type AttendanceRow = {
  session_id: number; course_id: number; starts_at: string; status: string; room: string | null;
};

const statusTone = { present: "green", late: "amber", absent: "red", excused: "slate" } as const;

// Тип для экспериментального BarcodeDetector (есть в Chromium)
declare global {
  interface Window { BarcodeDetector?: new (o?: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }
}

export default function AttendancePage() {
  const { me } = useRequireRole("student");
  const t = useTranslations("attend");
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const { data: history } = useQuery({
    queryKey: ["my-attendance"], queryFn: () => api<AttendanceRow[]>("/me/attendance"), enabled: !!me,
  });

  const checkin = useMutation({
    mutationFn: (payload: { session_id: number; token: string }) =>
      api<{ status: string; already: boolean }>("/attendance/checkin", { method: "POST", body: payload }),
    onSuccess: (res) => {
      stopScan();
      setMessage({ ok: true, text: res.already ? t("alreadyChecked") : t("checkedIn") });
      queryClient.invalidateQueries({ queryKey: ["my-attendance"] });
    },
    onError: (err: Error) => setMessage({ ok: false, text: err.message }),
  });

  const parseAndCheckin = (raw: string) => {
    const [sid, token] = raw.split(":");
    if (sid && token) checkin.mutate({ session_id: Number(sid), token });
    else setMessage({ ok: false, text: t("cameraError") });
  };

  const stopScan = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startScan = async () => {
    setMessage(null);
    if (!window.BarcodeDetector) { setManual(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) { parseAndCheckin(codes[0].rawValue); return; }
        } catch { /* кадр не распознан */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMessage({ ok: false, text: t("cameraError") });
      setManual(true);
    }
  };

  useEffect(() => () => stopScan(), []);

  if (!me) return null;

  return (
    <StudentShell me={me}>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconCalendar className="text-teal-600" /> {t("checkIn")}
      </h1>

      <Card className="mb-6 p-5">
        {scanning ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full rounded-lg bg-black" style={{ maxHeight: 320 }} />
            <p className="text-center text-sm text-slate-500">{t("scanning")}</p>
            <Button variant="outline" className="w-full justify-center" onClick={stopScan}>✕</Button>
          </div>
        ) : manual ? (
          <div className="space-y-3">
            <input value={code} onChange={(e) => setCode(e.target.value)}
                   placeholder="session:token"
                   className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <Button className="w-full justify-center" onClick={() => parseAndCheckin(code)}>
              {t("checkIn")}
            </Button>
            <button onClick={() => setManual(false)} className="w-full text-xs text-slate-400">
              {t("openCamera")}
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-500">{t("scanToCheck")}</p>
            <Button className="mx-auto" onClick={startScan}>
              <IconCamera /> {t("scanQr")}
            </Button>
            <button onClick={() => setManual(true)} className="block w-full text-xs text-slate-400">
              {t("enterCode")}
            </button>
          </div>
        )}
        {message && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-center text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message.ok && <IconCheck className="mr-1 inline text-xs" />}{message.text}
          </p>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("myAttendance")}</h2>
      {history?.length === 0 ? (
        <Card className="px-6 py-8 text-center text-sm text-slate-400">{t("noAttendance")}</Card>
      ) : (
        <div className="space-y-2">
          {history?.map((row) => (
            <Card key={row.session_id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {new Date(row.starts_at).toLocaleDateString()}
                </p>
                {row.room && <p className="text-xs text-slate-400">{row.room}</p>}
              </div>
              <Badge tone={statusTone[row.status as keyof typeof statusTone] ?? "slate"}>
                {t(row.status as never)}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
