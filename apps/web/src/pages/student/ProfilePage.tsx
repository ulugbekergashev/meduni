import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  LogOut,
  Mail,
  Medal,
  Phone,
  PlayCircle,
  Stethoscope,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Icon, ProgressBar, Spinner, cls, useToast } from "@meduni/ui";
import { ApiError } from "../../lib/api";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useLogout } from "../../lib/auth";
import { ThemeToggle } from "../../components/ThemeToggle";
import { AttendanceSection } from "./AttendanceSection";
import {
  useChangePassword,
  useMyActivity,
  useMyCourses,
  useMyProfile,
  useMyRank,
  useSetLocale,
  type ActivityType,
} from "./api";

type TabKey = "overview" | "courses" | "attendance";
const TABS: { key: TabKey; icon: LucideIcon }[] = [
  { key: "overview", icon: Activity },
  { key: "courses", icon: BookOpen },
  { key: "attendance", icon: CalendarCheck },
];

const ACTIVITY_META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  topic_completed: { icon: CheckCircle2, tone: "bg-emerald-soft text-emerald" },
  topic_activity: { icon: PlayCircle, tone: "bg-brand-soft text-brand-deep" },
  quiz_passed: { icon: ClipboardList, tone: "bg-blue-soft text-blue" },
  quiz_failed: { icon: ClipboardList, tone: "bg-rose-soft text-rose" },
  case_submitted: { icon: Stethoscope, tone: "bg-violet-soft text-violet" },
  case_graded: { icon: Medal, tone: "bg-emerald-soft text-emerald" },
};

function Row({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon icon={icon} size={16} className="shrink-0 text-ink-faint" />
      <span className="w-24 shrink-0 text-[13.5px] text-ink-faint">{label}</span>
      <span className="truncate text-[14.5px] font-medium text-ink">{value}</span>
    </div>
  );
}

/** Katta ko'rsatkich kartasi (skrinshotdagi kabi: ikonka-chip + raqam + izoh). */
function StatCard({ icon, value, label, hint, tone }: { icon: LucideIcon; value: string; label: string; hint?: string; tone: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
        <div className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", tone)}>
          <Icon icon={icon} size={16} />
        </div>
      </div>
      <p className="text-[30px] font-bold leading-none tabular-nums text-ink">{value}</p>
      {hint && <p className="text-[12.5px] text-ink-faint">{hint}</p>}
    </Card>
  );
}

function OverviewTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "profile" });
  const locale = useLocale();
  const navigate = useNavigate();
  const q = useMyActivity();
  const items = q.data ?? [];

  if (q.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-body text-ink-faint">{t("noActivity")}</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-line p-0">
      {items.map((a, i) => {
        const m = ACTIVITY_META[a.type];
        return (
          <button
            key={`${a.type}-${a.topicId}-${i}`}
            onClick={() => navigate(`/app/topics/${a.topicId}`)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
          >
            <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.tone)}>
              <Icon icon={m.icon} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-ink">{t(`activity.${a.type}`)}</p>
              <p className="truncate text-[13px] text-ink-faint">{a.topic}</p>
            </div>
            {a.score !== null && (
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink-soft">{a.score}%</span>
            )}
            <span className="shrink-0 text-[12.5px] text-ink-faint">
              {formatDate(locale === "ru" ? "ru" : "uz", a.at, "short")}
            </span>
          </button>
        );
      })}
    </Card>
  );
}

function CoursesTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "profile" });
  const navigate = useNavigate();
  const q = useMyCourses();
  const courses = q.data ?? [];

  if (q.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }
  if (courses.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-body text-ink-faint">{t("noCourses")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {courses.map((c) => (
        <Card key={c.id} interactive onClick={() => navigate(`/app/courses/${c.id}`)} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15.5px] font-bold text-ink">{c.subjectName}</p>
              <p className="truncate text-[13px] text-ink-faint">{c.teacherName}</p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-ink-soft">
              {c.topicsCompleted}/{c.topicsTotal}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ProgressBar value={c.progressPct} className="flex-1" />
            <span className="w-10 shrink-0 text-right text-[13.5px] font-bold tabular-nums text-ink-soft">{c.progressPct}%</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "profile" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const q = useMyProfile();
  const rankQ = useMyRank();
  const setLocale = useSetLocale();
  const changePw = useChangePassword();
  const logout = useLogout();
  const p = q.data;
  const rank = rankQ.data;

  const active = (params.get("tab") as TabKey | null) ?? "overview";
  const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

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
  const lowAtt = p?.attendancePct !== null && p?.attendancePct !== undefined && p.attendancePct < 75;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {q.isError || !p ? (
        <Card className="mt-4">
          <p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p>
        </Card>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* Chap ustun — kim ekanligi + sozlamalar */}
          <div className="space-y-4">
            <Card className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-card bg-brand-soft text-[34px] font-bold text-brand-deep">
                {initials}
              </div>
              <p className="mt-3 text-[18px] font-bold text-ink">{p.fullName}</p>
              {p.groupName && <p className="text-[13.5px] text-ink-soft">{p.groupName}</p>}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <Badge tone="emerald">{t("activeBadge")}</Badge>
                {rank?.rank && (
                  <span
                    className="inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2.5 py-0.5 text-[13px] font-semibold text-brand-deep"
                    title={t("rankHint")}
                  >
                    <Icon icon={Trophy} size={13} /> {t("rankValue", { rank: rank.rank, total: rank.total })}
                  </span>
                )}
              </div>

              <div className="mt-3 border-t border-line pt-2 text-left">
                <Row icon={Users} label={t("group")} value={p.groupName ?? "—"} />
                <Row icon={Mail} label={t("email")} value={p.email} />
                {p.phone && <Row icon={Phone} label={t("phone")} value={p.phone} />}
              </div>
              <p className="mt-2 text-left text-[12.5px] text-ink-faint">{t("adminNote")}</p>
            </Card>

            {/* Settings */}
            <Card className="space-y-5">
              <h2 className="text-section font-bold text-ink">{t("settings")}</h2>

              <div>
                <p className="mb-1.5 text-[13.5px] font-semibold text-ink-soft">{t("language")}</p>
                <div className="flex overflow-hidden rounded-control border border-line">
                  {(["uz", "ru"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => pickLocale(l)}
                      disabled={setLocale.isPending}
                      className={cls(
                        "flex-1 px-3 py-2 text-[14.5px] font-semibold transition-colors",
                        locale === l ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg"
                      )}
                    >
                      {l === "uz" ? "O‘zbek (lotin)" : "Русский"}
                    </button>
                  ))}
                </div>
              </div>

              <ThemeToggle />

              <div className="space-y-2">
                <p className="text-[13.5px] font-semibold text-ink-soft">{t("changePassword")}</p>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => {
                    setOld(e.target.value);
                    setPwErr(null);
                  }}
                  placeholder={t("oldPassword")}
                  className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNew(e.target.value);
                    setPwErr(null);
                  }}
                  placeholder={t("newPassword")}
                  className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand"
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setPwErr(null);
                  }}
                  placeholder={t("confirmPassword")}
                  className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand"
                />
                {pwErr && <p className="text-[13.5px] font-medium text-rose">{pwErr}</p>}
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

          {/* O'ng ustun — ko'rsatkichlar + tablar */}
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={CalendarCheck}
                value={p.attendancePct !== null ? `${p.attendancePct}%` : "—"}
                label={t("attendance")}
                hint={t("attendanceHint")}
                tone={lowAtt ? "bg-rose-soft text-rose" : "bg-blue-soft text-blue"}
              />
              <StatCard
                icon={GraduationCap}
                value={String(p.completedTopics)}
                label={t("completedTopics")}
                hint={t("completedHint")}
                tone="bg-emerald-soft text-emerald"
              />
              <StatCard
                icon={BookOpen}
                value={String(p.coursesCount)}
                label={t("courses")}
                hint={t("coursesHint")}
                tone="bg-brand-soft text-brand-deep"
              />
              <StatCard
                icon={Trophy}
                value={rank?.rank ? `${rank.rank}/${rank.total}` : "—"}
                label={t("rank")}
                hint={t("rankHint")}
                tone="bg-amber-soft text-amber"
              />
            </div>

            {/* Tab bar — segmented */}
            <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
              {TABS.map((tb) => {
                const on = tb.key === active;
                return (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={cls(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-3.5 py-2 text-[15px] font-semibold transition-all",
                      on ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
                    )}
                  >
                    <Icon icon={tb.icon} size={16} />
                    {t(`tabs.${tb.key}`)}
                  </button>
                );
              })}
            </div>

            <div>
              {active === "overview" && <OverviewTab />}
              {active === "courses" && <CoursesTab />}
              {active === "attendance" && <AttendanceSection />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
