import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, GraduationCap, LogOut, Mail, Phone, Users } from "lucide-react";
import { Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useLogout } from "../../lib/auth";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useChangePassword, useMyProfile, useSetLocale } from "./api";

function Row({ icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon icon={icon} size={16} className="shrink-0 text-ink-faint" />
      <span className="w-24 shrink-0 text-[13.5px] text-ink-faint">{label}</span>
      <span className="truncate text-[14.5px] font-medium text-ink">{value}</span>
    </div>
  );
}

function SummaryTile({ icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: string | number; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-control border border-line p-3 text-center">
      <div className={cls("flex h-8 w-8 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={16} />
      </div>
      <span className="text-[19px] font-bold tabular-nums text-ink">{value}</span>
      <span className="text-[12.5px] text-ink-soft">{label}</span>
    </div>
  );
}

export function ProfilePage() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "profile" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useMyProfile();
  const setLocale = useSetLocale();
  const changePw = useChangePassword();
  const logout = useLogout();
  const p = q.data;

  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);

  const pickLocale = (l: "uz" | "ru") => {
    if (l === locale) return;
    setLocale.mutate(l, {
      onSuccess: () => {
        i18n.changeLanguage(l); // whole UI switches immediately
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["me-profile"] });
      },
    });
  };

  const submitPw = () => {
    setPwErr(null);
    if (newPassword.length < 6) return setPwErr(t("errShort"));
    if (newPassword !== confirm) return setPwErr(t("errMismatch"));
    changePw.mutate(
      { oldPassword, newPassword },
      {
        onSuccess: () => { show(t("pwChanged")); setOld(""); setNew(""); setConfirm(""); },
        onError: (e) => setPwErr(e instanceof ApiError && e.code === "wrong_old_password" ? t("errOldWrong") : t("errShort")),
      }
    );
  };

  if (q.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;

  const initials = (p?.fullName ?? "")
    .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {q.isError || !p ? (
        <Card><p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p></Card>
      ) : (
        <>
          {/* Personal info (read-only) */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[18px] font-bold text-brand-deep">{initials}</div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-ink">{p.fullName}</p>
                {p.groupName && <p className="text-[13.5px] text-ink-soft">{p.groupName}</p>}
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-2">
              <Row icon={Users} label={t("group")} value={p.groupName ?? "—"} />
              <Row icon={Mail} label={t("email")} value={p.email} />
              {p.phone && <Row icon={Phone} label={t("phone")} value={p.phone} />}
            </div>
            <p className="mt-2 text-[12.5px] text-ink-faint">{t("adminNote")}</p>
          </Card>

          {/* Study summary */}
          <Card>
            <h2 className="mb-3 text-section font-bold text-ink">{t("studyStatus")}</h2>
            <div className="grid grid-cols-3 gap-2.5">
              <SummaryTile icon={BookOpen} label={t("courses")} value={p.coursesCount} tone="bg-brand-soft text-brand-deep" />
              <SummaryTile icon={GraduationCap} label={t("completedTopics")} value={p.completedTopics} tone="bg-emerald-soft text-emerald" />
              <SummaryTile icon={CalendarCheck} label={t("attendance")} value={p.attendancePct !== null ? `${p.attendancePct}%` : "—"} tone="bg-blue-soft text-blue" />
            </div>
          </Card>

          {/* Settings */}
          <Card className="space-y-5">
            <h2 className="text-section font-bold text-ink">{t("settings")}</h2>

            {/* Language */}
            <div>
              <p className="mb-1.5 text-[13.5px] font-semibold text-ink-soft">{t("language")}</p>
              <div className="flex overflow-hidden rounded-control border border-line">
                {(["uz", "ru"] as const).map((l) => (
                  <button key={l} onClick={() => pickLocale(l)} disabled={setLocale.isPending} className={cls("flex-1 px-3 py-2 text-[14.5px] font-semibold transition-colors", locale === l ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}>
                    {l === "uz" ? "O‘zbek (lotin)" : "Русский"}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <ThemeToggle />

            {/* Password */}
            <div className="space-y-2">
              <p className="text-[13.5px] font-semibold text-ink-soft">{t("changePassword")}</p>
              <input type="password" value={oldPassword} onChange={(e) => { setOld(e.target.value); setPwErr(null); }} placeholder={t("oldPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
              <input type="password" value={newPassword} onChange={(e) => { setNew(e.target.value); setPwErr(null); }} placeholder={t("newPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
              <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwErr(null); }} placeholder={t("confirmPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
              {pwErr && <p className="text-[13.5px] font-medium text-rose">{pwErr}</p>}
              <Button onClick={submitPw} disabled={changePw.isPending || !oldPassword || !newPassword || !confirm}>{t("save")}</Button>
            </div>
          </Card>

          {/* Logout */}
          <Button variant="ghost" className="w-full" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}>
            <Icon icon={LogOut} size={16} /> {t("logout")}
          </Button>
        </>
      )}
    </div>
  );
}
