import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { CheckCircle2, Clock, DoorOpen, Loader2, ScanFace } from "lucide-react";
import { Icon, cls, useToast } from "@meduni/ui";
import { api, apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useCheckinState } from "./api";

type Phase = "idle" | "gps" | "faceid" | "done" | "error";

/** Qurilma nomini brauzer userAgent'idan taxminan aniqlaymiz (ro'yxatga yozish uchun). */
function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Qurilma";
}

/** GPS koordinatasini oladi (ruxsat/timeout xatosida null). */
function getPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Talaba dars boshlanishida FaceID (WebAuthn) + GPS bilan o'zi davomat belgilaydi.
 *  Vaqt oynasi ochiq dars bo'lmasa — hech narsa ko'rsatmaydi. */
export function CheckInCard() {
  const { t } = useTranslation(undefined, { keyPrefix: "checkin" });
  const locale = useLocale();
  const { show } = useToast();
  const qc = useQueryClient();
  const stateQ = useCheckinState();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ status: "PRESENT" | "LATE"; already: boolean } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const st = stateQ.data;
  const open = st?.open ?? null;

  // Ko'rsatiladigan hollar: vaqt oynasi ochiq dars bo'lishi shart.
  if (!open) return null;

  const alreadyMarked = open.myStatus != null;

  // `open` yuqorida null bo'lsa qaytib ketamiz — closure'дан o'qiladi.
  async function run() {
    if (!browserSupportsWebAuthn()) {
      setPhase("error");
      setErrMsg(t("noWebauthn"));
      return;
    }
    setResult(null);
    setErrMsg(null);
    try {
      // 1) Joylashuv (geofence yoqilgan bo'lsa kerak).
      let coords: { lat: number; lng: number; accuracy: number } | null = null;
      if (st?.geofenceRequired) {
        setPhase("gps");
        coords = await getPosition();
      }

      // 2) Qurilma ulanmagan bo'lsa — avval passkey ro'yxatga olinadi.
      setPhase("faceid");
      if (!st?.hasCredential) {
        const regOpts = await api<Record<string, unknown>>("/api/v1/me/webauthn/register-options", { method: "POST", body: "{}" });
        const regResp = await startRegistration({ optionsJSON: regOpts as never });
        await api("/api/v1/me/webauthn/register", { method: "POST", body: JSON.stringify({ response: regResp, deviceName: guessDeviceName() }) });
      }

      // 3) FaceID/barmoq bilan check-in.
      const authOpts = await api<Record<string, unknown>>("/api/v1/me/checkin/options", { method: "POST", body: "{}" });
      const authResp = await startAuthentication({ optionsJSON: authOpts as never });
      const res = await api<{ ok: boolean; status: "PRESENT" | "LATE"; already: boolean }>("/api/v1/me/checkin", {
        method: "POST",
        body: JSON.stringify({ response: authResp, lat: coords?.lat, lng: coords?.lng, accuracy: coords?.accuracy }),
      });

      setResult({ status: res.status, already: res.already });
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["me-checkin"] });
      qc.invalidateQueries({ queryKey: ["me-schedule"] });
      qc.invalidateQueries({ queryKey: ["me-attendance"] });
      qc.invalidateQueries({ queryKey: ["me-dashboard"] });
      qc.invalidateQueries({ queryKey: ["webauthn-devices"] });
    } catch (err) {
      setPhase("error");
      // WebAuthn bekor qilindi (foydalanuvchi rad etdi yoki oyna yopildi).
      if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError")) {
        setErrMsg(t("cancelled"));
        return;
      }
      // Backend xatolari allaqachon tilga tarjima qilingan (kampus tashqarisi, oyna yopiq, ...).
      const msg = apiErrorMessage(err, locale === "ru" ? "ru" : "uz");
      setErrMsg(msg ?? t("failed"));
      if (msg) show(msg);
    }
  }

  const busy = phase === "gps" || phase === "faceid";

  // Muvaffaqiyatli natija (yoki allaqachon belgilangan).
  const doneStatus = result?.status ?? (alreadyMarked ? (open.myStatus as "PRESENT" | "LATE") : null);
  const showDone = phase === "done" || alreadyMarked;

  return (
    <div
      className={cls(
        "relative overflow-hidden rounded-card p-5 text-white shadow-card transition-all",
        showDone
          ? doneStatus === "LATE"
            ? "bg-gradient-to-br from-amber to-amber/80"
            : "bg-gradient-to-br from-emerald to-emerald/80"
          : "bg-gradient-to-br from-brand-deep via-brand to-violet"
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Icon icon={showDone ? CheckCircle2 : ScanFace} size={30} />
        </div>

        <div className="min-w-0 flex-1">
          {showDone ? (
            <>
              <p className="text-note font-extrabold uppercase tracking-widest text-white/80">
                {doneStatus === "LATE" ? t("markedLate") : t("markedPresent")}
              </p>
              <h3 className="mt-0.5 truncate text-[19px] font-bold leading-tight">{open.courseName}</h3>
              <p className="mt-0.5 truncate text-note text-white/85">
                {hhmm(open.date)}
                {result?.already ? ` · ${t("alreadyNote")}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-note font-extrabold uppercase tracking-widest text-white/70">{t("eyebrow")}</p>
              <h3 className="mt-0.5 truncate text-[19px] font-bold leading-tight">{open.courseName}</h3>
              <p className="mt-0.5 flex items-center gap-2 truncate text-note text-white/85">
                <span className="inline-flex items-center gap-1">
                  <Icon icon={Clock} size={12} /> {hhmm(open.date)}
                </span>
                {open.room && (
                  <span className="inline-flex items-center gap-1">
                    <Icon icon={DoorOpen} size={12} /> {open.room}
                  </span>
                )}
                {open.wouldBe === "LATE" && <span className="rounded-pill bg-white/20 px-2 py-0.5 font-bold">{t("lateWindow")}</span>}
              </p>
            </>
          )}
        </div>

        {!showDone && (
          <button
            onClick={() => run()}
            disabled={busy}
            className="flex shrink-0 items-center gap-2 rounded-control bg-white/95 px-5 py-3 text-body font-bold text-brand-tint shadow-sm transition-all hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:opacity-80"
          >
            {busy ? <Icon icon={Loader2} size={18} className="animate-spin" /> : <Icon icon={ScanFace} size={18} />}
            {phase === "gps" ? t("checkingGps") : phase === "faceid" ? t("scanning") : t("checkIn")}
          </button>
        )}
      </div>

      {phase === "error" && errMsg && (
        <p className="relative mt-3 rounded-control bg-white/15 px-3 py-2 text-note font-semibold text-white">{errMsg}</p>
      )}
    </div>
  );
}
