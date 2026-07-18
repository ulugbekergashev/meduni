import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  FileStack,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, Donut, Icon, LegendRow, MiniBars, Spinner, StatCard, cls } from "@meduni/ui";
import { useMe } from "../../lib/auth";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useAdminStats } from "./api";
import { useUserStats } from "./users/api";

function AttentionCard({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: "amber" | "blue" | "rose";
  onClick?: () => void;
}) {
  const toneCls = {
    amber: "bg-amber-soft text-amber",
    blue: "bg-blue-soft text-blue",
    rose: "bg-rose-soft text-rose",
  }[tone];
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls("flex items-center gap-3 !p-4", value === 0 && "opacity-60")}
    >
      <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneCls)}>
        <Icon icon={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[22px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 truncate text-[13.5px] text-ink-soft">{label}</p>
      </div>
      {onClick && <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />}
    </Card>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "adminHome" });
  const { data: me } = useMe();
  const navigate = useNavigate();
  const locale = useLocale();
  const q = useAdminStats();
  const roles = useUserStats();
  const s = q.data;
  const r = roles.data;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");

  if (q.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;

  const admins = r ? r.deptAdmins + r.facultyAdmins + r.superAdmins : 0;
  const allClear =
    s && s.attention.casesToReview === 0 && s.attention.contentToApprove === 0 && s.attention.departmentsOverQuota === 0;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
      <p className="mt-0.5 text-[14px] text-ink-faint">{today}</p>

      {s && (
        <>
          {/* Core stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Users} value={s.counts.students} label={t("students")} hint={t("studentsHint")} tone="bg-blue-soft text-blue" onClick={() => navigate("/admin/users")} />
            <StatCard icon={GraduationCap} value={s.counts.teachers} label={t("teachers")} hint={t("teachersHint")} tone="bg-violet-soft text-violet" onClick={() => navigate("/admin/users")} />
            <StatCard icon={BookOpen} value={s.counts.courses} label={t("courses")} hint={t("coursesHint")} tone="bg-brand-soft text-brand-deep" onClick={() => navigate("/admin/courses")} />
            <StatCard icon={FileStack} value={s.counts.publishedContent} label={t("publishedContent")} hint={t("publishedIn", { count: s.counts.publishedTopics })} tone="bg-emerald-soft text-emerald" onClick={() => navigate("/admin/courses")} />
          </div>

          {/* Composition + activity timeline */}
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <h2 className="text-section font-bold text-ink">{t("composition")}</h2>
              <div className="mt-4 flex items-center gap-6">
                <Donut
                  size={150}
                  stroke={17}
                  centerValue={r ? r.total : "—"}
                  centerLabel={t("compositionTotal")}
                  segments={[
                    { value: r?.students ?? 0, tone: "blue" },
                    { value: r?.teachers ?? 0, tone: "violet" },
                    { value: admins, tone: "amber" },
                  ]}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <LegendRow tone="blue" label={t("students")} value={r?.students ?? "—"} />
                  <LegendRow tone="violet" label={t("teachers")} value={r?.teachers ?? "—"} />
                  <LegendRow tone="amber" label={t("admins")} value={r ? admins : "—"} />
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-section font-bold text-ink">{t("timeline14")}</h2>
                <span className="text-note text-ink-faint">{t("timeline14Hint")}</span>
              </div>
              <div className="mt-4">
                {s.activitySeries.some((d) => d.activeStudents > 0) ? (
                  <MiniBars
                    height={110}
                    tone="blue"
                    data={s.activitySeries.map((d) => ({
                      label: d.day,
                      value: d.activeStudents,
                      tip: `${formatDate(locale === "ru" ? "ru" : "uz", d.day, "short")} · ${d.activeStudents} ${t("activeShort")} · ${d.contentPublished} ${t("publishedShort")}`,
                    }))}
                  />
                ) : (
                  <p className="py-10 text-center text-body text-ink-faint">{t("timelineEmpty")}</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[13.5px] text-ink-soft">
                <span><b className="tabular-nums text-ink">{s.activity.activeStudentsLast7Days}</b> {t("activeStudents")}</span>
                <span><b className="tabular-nums text-ink">{s.activity.contentLast7Days}</b> {t("contentCreated")}</span>
              </div>
            </Card>
          </div>

          {/* Attention */}
          <section className="mt-6">
            <h2 className="mb-3 text-section font-bold text-ink">{t("attention")}</h2>
            {allClear ? (
              <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
                <Icon icon={CheckCircle2} size={22} className="text-emerald" />
                <p className="text-[15px] font-semibold text-emerald">{t("allClear")}</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <AttentionCard icon={ClipboardCheck} value={s.attention.casesToReview} label={t("casesToReview")} tone="amber" />
                <AttentionCard icon={FileClock} value={s.attention.contentToApprove} label={t("contentToApprove")} tone="blue" />
                <AttentionCard icon={AlertTriangle} value={s.attention.departmentsOverQuota} label={t("overQuota")} tone="rose" onClick={() => navigate("/admin/ai")} />
              </div>
            )}
          </section>

          {/* AI spend */}
          <section className="mt-6">
            <button onClick={() => navigate("/admin/ai")} className="block w-full text-left">
              <div className="rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon icon={Sparkles} size={18} className="text-white/90" />
                    <p className="text-[13.5px] font-medium uppercase tracking-wide text-white/80">{t("aiThisMonth")}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[13.5px] font-semibold text-white/80">
                    {t("aiDetails")} <Icon icon={ChevronRight} size={14} />
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">{s.aiThisMonth.tokens.toLocaleString()}</p><p className="mt-1 text-[13px] text-white/75">{t("tokens")}</p></div>
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">{s.aiThisMonth.images}</p><p className="mt-1 text-[13px] text-white/75">{t("images")}</p></div>
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">${s.aiThisMonth.cost.toFixed(2)}</p><p className="mt-1 text-[13px] text-white/75">{t("cost")}</p></div>
                </div>
              </div>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
