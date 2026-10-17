import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  CalendarRange,
  GraduationCap,
  Hash,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Icon, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "../../components/bento";
import { PillTabs, SoftChip } from "./parts/bento";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useLogout } from "../../lib/auth";
import { useChangePassword, useMyProfile, useSetLocale } from "./api";
import { CheckinDevices } from "./CheckinDevices";

/** Ma'lumotnoma qatori: ikonka + yorliq + qiymat. */
function InfoRow({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-2 py-2.5 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink-2">
        <Icon icon={icon} size={15} />
      </span>
      <span className="w-28 shrink-0 text-note text-ink-soft sm:w-32">{label}</span>
      <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{value}</span>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-control border border-line bg-surface-raised px-3 text-body text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:bg-surface";

/** Talaba profili — ma'lumotnoma (kim, qayerda o'qiydi) + hisob sozlamalari.
 *  O'quv ko'rsatkichlari (davomat %, progress, reyting) ATAYIN bu yerda emas —
 *  ular o'z modullarida: bosh sahifa va Davomat. */
export function ProfilePage() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "profile" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
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
        onSuccess: () => {
          show(t("pwChanged"));
          setOld("");
          setNew("");
          setConfirm("");
        },
        onError: (e) =>
          setPwErr(e instanceof ApiError && e.code === "wrong_old_password" ? t("errOldWrong") : t("errShort")),
      }
    );
  };


  const initials =
    (p?.fullName ?? "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";

  const doLogout = () => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) });

  return (
    <div className="space-y-3">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("subtitle")}
        right={
          <Button variant="ghost" size="sm" className="h-9 rounded-pill" icon={<Icon icon={LogOut} size={14} />} onClick={doLogout}>
            {t("logout")}
          </Button>
        }
      />

      {q.isLoading || q.isError || !p ? (
        <BentoCard isLoading={q.isLoading} isError={!q.isLoading} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Identity — kim (sahifaning yagona pastel yuzasi) */}
          <section className="flex flex-wrap items-center gap-4 rounded-card bg-brand-soft p-5 lg:col-span-2">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink text-stat font-semibold text-surface">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-h1 font-semibold text-ink">{p.fullName}</h2>
              <p className="mt-0.5 truncate text-note text-ink-2">
                {[p.facultyName, p.groupName].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SoftChip text={p.isActive ? "text-emerald" : "text-ink-soft"}>
                  {p.isActive ? t("activeBadge") : t("inactiveBadge")}
                </SoftChip>
                <SoftChip>{t("studentBadge")}</SoftChip>
                <SoftChip className="tabular-nums">ID {p.id}</SoftChip>
              </div>
            </div>
          </section>

          {/* O'quv ma'lumotlari — qayerda o'qiydi */}
          <BentoCard title={t("academicInfo")} bodyClassName="px-2 pb-2">
            <InfoRow icon={Building2} label={t("faculty")} value={p.facultyName ?? "—"} />
            <InfoRow icon={Users} label={t("group")} value={p.groupName ?? "—"} />
            <InfoRow
              icon={GraduationCap}
              label={t("yearOfStudy")}
              value={p.yearOfStudy !== null ? t("yearN", { n: p.yearOfStudy }) : "—"}
            />
            <InfoRow
              icon={CalendarRange}
              label={t("currentPeriod")}
              value={p.academicYear ? `${p.academicYear} · ${tp("semester", { n: p.semester ?? 0 })}` : "—"}
            />
            <InfoRow icon={BookOpen} label={t("activeCourses")} value={String(p.coursesCount)} />
          </BentoCard>

          {/* Aloqa — o'zgartirish adminda */}
          <BentoCard title={t("contactInfo")} bodyClassName="px-2 pb-3">
            <InfoRow icon={Mail} label={t("email")} value={p.email} />
            <InfoRow icon={Phone} label={t("phone")} value={p.phone ?? "—"} />
            <InfoRow icon={Hash} label={t("idLabel")} value={`#${p.id}`} />
            <p className="mt-2 px-2 text-micro text-ink-soft">{t("adminNote")}</p>
          </BentoCard>

          {/* Sozlamalar — foydalanuvchi o'zi o'zgartiradi */}
          <BentoCard title={t("settings")} bodyClassName="space-y-4 px-4 pb-4">
            <div>
              <p className="mb-1.5 text-note font-semibold text-ink-soft">{t("language")}</p>
              <PillTabs<"uz" | "ru">
                label={t("language")}
                value={locale === "ru" ? "ru" : "uz"}
                onChange={pickLocale}
                items={[
                  { key: "uz", label: "O‘zbek (lotin)" },
                  { key: "ru", label: "Русский" },
                ]}
              />
            </div>

            {/* Tema tanlash yo'q — u shapkadagi tugmada. */}

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-note font-semibold text-ink-soft">
                <Icon icon={KeyRound} size={14} />
                {t("changePassword")}
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => {
                  setOld(e.target.value);
                  setPwErr(null);
                }}
                placeholder={t("oldPassword")}
                aria-label={t("oldPassword")}
                className={inputCls}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNew(e.target.value);
                    setPwErr(null);
                  }}
                  placeholder={t("newPassword")}
                  aria-label={t("newPassword")}
                  className={inputCls}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setPwErr(null);
                  }}
                  placeholder={t("confirmPassword")}
                  aria-label={t("confirmPassword")}
                  className={inputCls}
                />
              </div>
              {pwErr && <p className="text-note font-medium text-rose">{pwErr}</p>}
              <Button onClick={submitPw} disabled={changePw.isPending || !oldPassword || !newPassword || !confirm}>
                {t("save")}
              </Button>
            </div>
          </BentoCard>

          {/* FaceID davomat qurilmalari */}
          <CheckinDevices />
        </div>
      )}
    </div>
  );
}
