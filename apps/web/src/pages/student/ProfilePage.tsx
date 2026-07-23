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
  Languages,
  LogOut,
  Mail,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { ApiError } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useLogout } from "../../lib/auth";
import { useChangePassword, useMyProfile, useSetLocale } from "./api";

/** Ma'lumotnoma qatori: ikonka + yorliq + qiymat. */
function InfoRow({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink-soft">
        <Icon icon={icon} size={15} />
      </div>
      <span className="w-32 shrink-0 text-note text-ink-faint">{label}</span>
      <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-1 text-section font-bold text-ink">{title}</h2>
      <div>{children}</div>
    </Card>
  );
}

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

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={26} />
      </div>
    );
  }

  const initials =
    (p?.fullName ?? "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>

      {q.isError || !p ? (
        <Card className="mt-4">
          <p className="py-6 text-center text-body text-rose">{t("loadError")}</p>
        </Card>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Identity — kim */}
          <Card className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-brand-soft text-[28px] font-bold text-brand-tint">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[22px] font-bold text-ink">{p.fullName}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-soft">
                {p.facultyName && <span>{p.facultyName}</span>}
                {p.groupName && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span>{p.groupName}</span>
                  </>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={p.isActive ? "emerald" : "slate"}>{p.isActive ? t("activeBadge") : t("inactiveBadge")}</Badge>
                <Badge tone="brand">{t("studentBadge")}</Badge>
                <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-note font-semibold text-ink-soft">ID: {p.id}</span>
              </div>
            </div>
          </Card>

          {/* O'quv ma'lumotlari — qayerda o'qiydi */}
          <Section title={t("academicInfo")}>
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
              value={
                p.academicYear
                  ? `${p.academicYear} · ${tp("semester", { n: p.semester ?? 0 })}`
                  : "—"
              }
            />
            <InfoRow icon={BookOpen} label={t("activeCourses")} value={String(p.coursesCount)} />
          </Section>

          {/* Aloqa — o'zgartirish adminda */}
          <Section title={t("contactInfo")}>
            <InfoRow icon={Mail} label={t("email")} value={p.email} />
            <InfoRow icon={Phone} label={t("phone")} value={p.phone ?? "—"} />
            <InfoRow icon={Hash} label={t("idLabel")} value={`#${p.id}`} />
            <InfoRow icon={Languages} label={t("language")} value={locale === "ru" ? "Русский" : "O‘zbek (lotin)"} />
          </Section>
          <p className="-mt-2 px-1 text-note text-ink-faint">{t("adminNote")}</p>

          {/* Sozlamalar — foydalanuvchi o'zi o'zgartiradi */}
          <Card className="space-y-5">
            <h2 className="text-section font-bold text-ink">{t("settings")}</h2>

            <div>
              <p className="mb-1.5 text-note font-semibold text-ink-soft">{t("language")}</p>
              <div className="flex overflow-hidden rounded-control border border-line">
                {(["uz", "ru"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => pickLocale(l)}
                    disabled={setLocale.isPending}
                    className={cls(
                      "flex-1 px-3 py-2 text-body font-semibold transition-colors",
                      locale === l ? "bg-brand-soft text-brand-tint" : "text-ink-soft hover:bg-surface-raised"
                    )}
                  >
                    {l === "uz" ? "O‘zbek (lotin)" : "Русский"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tema tanlash yo'q — talaba tomoni faqat qorong'i (dizayn qarori). */}

            <div className="space-y-2">
              <p className="text-note font-semibold text-ink-soft">{t("changePassword")}</p>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => {
                  setOld(e.target.value);
                  setPwErr(null);
                }}
                placeholder={t("oldPassword")}
                className="w-full rounded-control border border-line px-3 py-2 text-body outline-none focus:border-brand"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNew(e.target.value);
                  setPwErr(null);
                }}
                placeholder={t("newPassword")}
                className="w-full rounded-control border border-line px-3 py-2 text-body outline-none focus:border-brand"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setPwErr(null);
                }}
                placeholder={t("confirmPassword")}
                className="w-full rounded-control border border-line px-3 py-2 text-body outline-none focus:border-brand"
              />
              {pwErr && <p className="text-note font-medium text-rose">{pwErr}</p>}
              <Button onClick={submitPw} disabled={changePw.isPending || !oldPassword || !newPassword || !confirm}>
                {t("save")}
              </Button>
            </div>
          </Card>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
          >
            <Icon icon={LogOut} size={16} /> {t("logout")}
          </Button>
        </div>
      )}
    </div>
  );
}
