import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, Mail, Phone, Users } from "lucide-react";
import { Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { ApiError, api } from "../lib/api";
import { useLocale } from "../lib/useLocale";
import { useLogout } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";

interface Account {
  fullName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  locale: "uz" | "ru";
  contextType: "group" | "department" | null;
  contextUz: string | null;
  contextRu: string | null;
}

function Row({ icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon icon={icon} size={16} className="shrink-0 text-ink-faint" />
      <span className="w-28 shrink-0 text-[12.5px] text-ink-faint">{label}</span>
      <span className="truncate text-[13.5px] font-medium text-ink">{value}</span>
    </div>
  );
}

const roleTone: Record<Account["role"], string> = {
  ADMIN: "bg-rose-soft text-rose",
  TEACHER: "bg-violet-soft text-violet",
  STUDENT: "bg-blue-soft text-blue",
};

export function AccountSettings() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "settingsAcc" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["account"], queryFn: () => api<Account>("/api/v1/account/me") });
  const setLocaleM = useMutation({ mutationFn: (l: "uz" | "ru") => api("/api/v1/account/locale", { method: "PUT", body: JSON.stringify({ locale: l }) }) });
  const changePw = useMutation({ mutationFn: (b: { oldPassword: string; newPassword: string }) => api("/api/v1/account/change-password", { method: "POST", body: JSON.stringify(b) }) });
  const logout = useLogout();
  const a = q.data;

  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);

  const pickLocale = (l: "uz" | "ru") => {
    if (l === locale) return;
    setLocaleM.mutate(l, {
      onSuccess: () => {
        i18n.changeLanguage(l);
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["account"] });
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

  const initials = (a?.fullName ?? "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  const context = a?.contextType ? (locale === "ru" ? a.contextRu : a.contextUz) : null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {q.isError || !a ? (
        <Card><p className="py-6 text-center text-[13.5px] text-rose">{t("loadError")}</p></Card>
      ) : (
        <>
          {/* Personal info (read-only) */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[18px] font-bold text-brand-deep">{initials}</div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-ink">{a.fullName}</p>
                <span className={cls("mt-0.5 inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold", roleTone[a.role])}>{t(`role.${a.role}`)}</span>
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-2">
              {context && <Row icon={a.contextType === "department" ? Building2 : Users} label={t(a.contextType === "department" ? "department" : "group")} value={context} />}
              <Row icon={Mail} label={t("email")} value={a.email} />
              {a.phone && <Row icon={Phone} label={t("phone")} value={a.phone} />}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-faint">{t("adminNote")}</p>
          </Card>

          {/* Settings */}
          <Card className="space-y-5">
            <h2 className="text-section font-bold text-ink">{t("interface")}</h2>

            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{t("language")}</p>
              <div className="flex overflow-hidden rounded-control border border-line">
                {(["uz", "ru"] as const).map((l) => (
                  <button key={l} onClick={() => pickLocale(l)} disabled={setLocaleM.isPending} className={cls("flex-1 px-3 py-2 text-[13.5px] font-semibold transition-colors", locale === l ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg")}>
                    {l === "uz" ? "O‘zbek (lotin)" : "Русский"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11.5px] text-ink-faint">{t("languageHint")}</p>
            </div>

            <ThemeToggle />

            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-[12.5px] font-semibold text-ink-soft">{t("changePassword")}</p>
              <input type="password" value={oldPassword} onChange={(e) => { setOld(e.target.value); setPwErr(null); }} placeholder={t("oldPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
              <input type="password" value={newPassword} onChange={(e) => { setNew(e.target.value); setPwErr(null); }} placeholder={t("newPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
              <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwErr(null); }} placeholder={t("confirmPassword")} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
              {pwErr && <p className="text-[12.5px] font-medium text-rose">{pwErr}</p>}
              <Button onClick={submitPw} disabled={changePw.isPending || !oldPassword || !newPassword || !confirm}>{t("save")}</Button>
            </div>
          </Card>

          <Button variant="ghost" className="w-full" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}>
            <Icon icon={LogOut} size={16} /> {t("logout")}
          </Button>
        </>
      )}
    </div>
  );
}
