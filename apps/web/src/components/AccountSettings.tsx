import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, Mail, Phone, Users } from "lucide-react";
import { Button, Icon, Segmented, Spinner, cls, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "./bento";
import { ApiError, api } from "../lib/api";

const inputCls =
  "h-10 w-full rounded-control border border-line-raised bg-surface-raised px-3 text-note text-ink outline-none transition-colors focus:border-brand focus:bg-surface";
import { useLocale } from "../lib/useLocale";
import { useLogout } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";

interface Account {
  fullName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "SUPERADMIN" | "FACULTY_ADMIN" | "DEPT_ADMIN" | "TEACHER" | "STUDENT";
  locale: "uz" | "ru";
  contextType: "group" | "department" | null;
  context: string | null;
}

function Row({ icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon icon={icon} size={16} className="shrink-0 text-ink-faint" />
      <span className="w-28 shrink-0 text-note text-ink-faint">{label}</span>
      <span className="truncate text-note font-medium text-ink">{value}</span>
    </div>
  );
}

const roleTone: Record<Account["role"], string> = {
  ADMIN: "bg-rose-soft text-rose",
  SUPERADMIN: "bg-rose-soft text-rose",
  FACULTY_ADMIN: "bg-amber-soft text-amber",
  DEPT_ADMIN: "bg-emerald-soft text-emerald",
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
    if (l === locale || setLocaleM.isPending) return;
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
  const context = a?.contextType ? a.context : null;

  return (
    <div className="space-y-3 pb-8">
      <PageHeader className="mb-0" title={t("title")} subtitle={a ? a.email : undefined} />

      {q.isError || !a ? (
        <BentoCard isError onRetry={() => q.refetch()} />
      ) : (
        // Dizayn v3: markazdagi tor ustun o'rniga ikki ustunli bento (§4 ZICHLIK).
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Shaxsiy ma'lumot (faqat o'qish) — sahifadagi yagona pastel urg'u */}
          <BentoCard tone="brand" className="lg:row-span-2 lg:self-start" bodyClassName="flex flex-col px-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-section font-semibold text-brand-deep">{initials}</div>
              <div className="min-w-0">
                <p className="truncate text-section font-semibold text-ink">{a.fullName}</p>
                <span className={cls("mt-0.5 inline-block rounded-pill px-2 py-0.5 text-micro font-semibold", roleTone[a.role])}>{t(`role.${a.role}`)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-control bg-surface/70 px-3 py-1">
              {context && <Row icon={a.contextType === "department" ? Building2 : Users} label={t(a.contextType === "department" ? "department" : "group")} value={context} />}
              <Row icon={Mail} label={t("email")} value={a.email} />
              {a.phone && <Row icon={Phone} label={t("phone")} value={a.phone} />}
            </div>
            <p className="mt-2 text-micro text-ink-2">{t("adminNote")}</p>
            <div className="pt-4">
              <Button variant="ghost" className="rounded-pill bg-surface" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}>
                <Icon icon={LogOut} size={16} /> {t("logout")}
              </Button>
            </div>
          </BentoCard>

          {/* Interfeys */}
          <BentoCard title={t("interface")}>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-note font-semibold text-ink-soft">{t("language")}</p>
                <Segmented
                  value={locale === "ru" ? "ru" : "uz"}
                  onChange={pickLocale}
                  aria-label={t("language")}
                  options={[
                    { key: "uz", label: "O‘zbek (lotin)" },
                    { key: "ru", label: "Русский" },
                  ]}
                />
                <p className="mt-1 text-micro text-ink-soft">{t("languageHint")}</p>
              </div>
              <ThemeToggle />
            </div>
          </BentoCard>

          {/* Parol */}
          <BentoCard title={t("changePassword")}>
            <div className="space-y-2">
              <input type="password" autoComplete="current-password" aria-label={t("oldPassword")} value={oldPassword} onChange={(e) => { setOld(e.target.value); setPwErr(null); }} placeholder={t("oldPassword")} className={inputCls} />
              <input type="password" autoComplete="new-password" aria-label={t("newPassword")} value={newPassword} onChange={(e) => { setNew(e.target.value); setPwErr(null); }} placeholder={t("newPassword")} className={inputCls} />
              <input type="password" autoComplete="new-password" aria-label={t("confirmPassword")} value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwErr(null); }} placeholder={t("confirmPassword")} className={inputCls} />
              {pwErr && <p className="text-note font-medium text-rose">{pwErr}</p>}
              <Button onClick={submitPw} disabled={changePw.isPending || !oldPassword || !newPassword || !confirm}>{t("save")}</Button>
            </div>
          </BentoCard>
        </div>
      )}
    </div>
  );
}
