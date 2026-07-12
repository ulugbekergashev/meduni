import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardCheck, FileClock, FileStack, GraduationCap, Layers, Sparkles, TrendingUp, Users } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { useMe } from "../../lib/auth";
import { useAdminStats } from "./api";

function StatCard({ icon, value, label, hint, tone, onClick }: { icon: typeof Users; value: number; label: string; hint: string; tone: string; onClick: () => void }) {
  return (
    <Card interactive onClick={onClick} className="flex flex-col gap-2">
      <div className={cls("flex h-10 w-10 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={19} />
      </div>
      <span className="text-[30px] font-bold leading-none tabular-nums text-ink">{value}</span>
      <div>
        <p className="text-[13.5px] font-semibold text-ink">{label}</p>
        <p className="text-[12px] text-ink-faint">{hint}</p>
      </div>
    </Card>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "adminHome" });
  const { data: me } = useMe();
  const navigate = useNavigate();
  const q = useAdminStats();
  const s = q.data;
  const today = new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });

  if (q.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
      <p className="mt-0.5 text-[13px] text-ink-faint">{today}</p>

      {s && (
        <>
          {/* Core stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={Users} value={s.counts.students} label={t("students")} hint={t("studentsHint")} tone="bg-blue-soft text-blue" onClick={() => navigate("/admin/users")} />
            <StatCard icon={GraduationCap} value={s.counts.teachers} label={t("teachers")} hint={t("teachersHint")} tone="bg-violet-soft text-violet" onClick={() => navigate("/admin/users")} />
            <StatCard icon={BookOpen} value={s.counts.courses} label={t("courses")} hint={t("coursesHint")} tone="bg-brand-soft text-brand-deep" onClick={() => navigate("/admin/courses")} />
            <StatCard icon={Layers} value={s.counts.publishedTopics} label={t("publishedTopics")} hint={t("publishedTopicsHint")} tone="bg-emerald-soft text-emerald" onClick={() => navigate("/admin/courses")} />
            <StatCard icon={FileStack} value={s.counts.publishedContent} label={t("publishedContent")} hint={t("publishedContentHint")} tone="bg-blue-soft text-blue" onClick={() => navigate("/admin/courses")} />
          </div>

          {/* Attention */}
          <section className="mt-8">
            <h2 className="mb-3 text-section font-bold text-ink">{t("attention")}</h2>
            {s.attention.casesToReview === 0 && s.attention.contentToApprove === 0 && s.attention.departmentsOverQuota === 0 ? (
              <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
                <Icon icon={CheckCircle2} size={22} className="text-emerald" />
                <p className="text-[14px] font-semibold text-emerald">{t("allClear")}</p>
              </Card>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-control border border-amber/30 bg-amber-soft p-3 text-amber">
                  <Icon icon={ClipboardCheck} size={18} /><span className="text-[24px] font-bold">{s.attention.casesToReview}</span><span className="text-[12.5px] font-medium">{t("casesToReview")}</span>
                </div>
                <div className="flex items-center gap-3 rounded-control border border-blue/30 bg-blue-soft p-3 text-blue">
                  <Icon icon={FileClock} size={18} /><span className="text-[24px] font-bold">{s.attention.contentToApprove}</span><span className="text-[12.5px] font-medium">{t("contentToApprove")}</span>
                </div>
                <button onClick={() => navigate("/admin/ai")} className={cls("flex items-center gap-3 rounded-control border p-3 text-left", s.attention.departmentsOverQuota > 0 ? "border-rose/30 bg-rose-soft text-rose" : "border-line bg-surface text-ink-soft")}>
                  <Icon icon={AlertTriangle} size={18} /><span className="text-[24px] font-bold">{s.attention.departmentsOverQuota}</span><span className="text-[12.5px] font-medium">{t("overQuota")}</span>
                </button>
              </div>
            )}
          </section>

          {/* AI spend */}
          <section className="mt-8">
            <button onClick={() => navigate("/admin/ai")} className="block w-full text-left">
              <div className="rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-md transition-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <Icon icon={Sparkles} size={18} className="text-white/90" />
                  <p className="text-[12.5px] font-medium uppercase tracking-wide text-white/80">{t("aiThisMonth")}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">{s.aiThisMonth.tokens.toLocaleString()}</p><p className="mt-1 text-[12px] text-white/75">{t("tokens")}</p></div>
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">{s.aiThisMonth.images}</p><p className="mt-1 text-[12px] text-white/75">{t("images")}</p></div>
                  <div><p className="text-[26px] font-bold leading-none tabular-nums">${s.aiThisMonth.cost.toFixed(2)}</p><p className="mt-1 text-[12px] text-white/75">{t("cost")}</p></div>
                </div>
              </div>
            </button>
          </section>

          {/* Activity */}
          <section className="mt-8">
            <h2 className="mb-3 text-section font-bold text-ink">{t("activity7d")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-soft text-emerald"><Icon icon={FileStack} size={17} /></div>
                <div><p className="text-[20px] font-bold tabular-nums text-ink">{s.activity.contentLast7Days}</p><p className="text-[12px] text-ink-soft">{t("contentCreated")}</p></div>
              </Card>
              <Card className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue"><Icon icon={TrendingUp} size={17} /></div>
                <div><p className="text-[20px] font-bold tabular-nums text-ink">{s.activity.activeStudentsLast7Days}</p><p className="text-[12px] text-ink-soft">{t("activeStudents")}</p></div>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
