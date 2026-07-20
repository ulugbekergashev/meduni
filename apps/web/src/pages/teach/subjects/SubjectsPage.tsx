import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BookMarked, ChevronRight, FileWarning, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { Card, Icon, StackedBar, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useMySubjects, type SubjectRow } from "../topics/api";

/** "Diqqat kerak" chipi — nechta mavzu qaysi bosqichda turib qolgani. */
function AttentionChip({ icon, count, label, tone }: { icon: typeof Upload; count: number; label: string; tone: string }) {
  if (count === 0) return null;
  return (
    <span className={cls("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[13px] font-semibold", tone)}>
      <Icon icon={icon} size={13} />
      {count} {label}
    </span>
  );
}

function SubjectCard({ s }: { s: SubjectRow }) {
  const { t } = useTranslation(undefined, { keyPrefix: "subjects" });
  const navigate = useNavigate();
  const donePct = s.topicsTotal === 0 ? 0 : Math.round((s.published / s.topicsTotal) * 100);

  return (
    <Card interactive onClick={() => navigate(`/teach/subjects/${s.id}`)} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-section font-bold text-ink">{s.name}</h3>
          <p className="truncate text-note text-ink-faint">{s.departmentName}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={BookMarked} size={18} />
        </div>
      </div>

      {s.topicsTotal === 0 ? (
        <p className="rounded-control border border-dashed border-line px-3 py-2.5 text-note text-ink-faint">
          {t("noTopics")}
        </p>
      ) : (
        <>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[22px] font-bold tabular-nums text-ink">{donePct}%</span>
              <span className="text-note text-ink-soft">
                {s.published}/{s.topicsTotal} {t("publishedTopics")}
              </span>
            </div>
            <StackedBar
              total={s.topicsTotal}
              segments={[
                { value: s.published, tone: "emerald" },
                { value: s.inProgress, tone: "amber" },
              ]}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <AttentionChip icon={Upload} count={s.attention.materialMissing} label={t("needMaterial")} tone="bg-brand-soft text-brand-deep" />
            <AttentionChip icon={Sparkles} count={s.attention.digestPending} label={t("needDigest")} tone="bg-amber-soft text-amber" />
            <AttentionChip icon={FileWarning} count={s.attention.publishPending} label={t("needPublish")} tone="bg-blue-soft text-blue" />
            <AttentionChip icon={ShieldAlert} count={s.attention.factcheckFlagged} label={t("needFactcheck")} tone="bg-rose-soft text-rose" />
            {s.attention.materialMissing + s.attention.digestPending + s.attention.publishPending + s.attention.factcheckFlagged === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-soft px-2.5 py-1 text-[13px] font-semibold text-emerald">
                {t("allReady")}
              </span>
            )}
          </div>
        </>
      )}

      <div className="mt-auto flex items-center gap-1 pt-1 text-body font-semibold text-brand-deep">
        {t("open")} <Icon icon={ChevronRight} size={15} />
      </div>
    </Card>
  );
}

/** "Fanlarim" — kafedra-markazlashgan kontent yuzasi (Faza 3). */
export function SubjectsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "subjects" });
  const q = useMySubjects();
  const subjects = q.data ?? [];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>

      <div className="mt-6">
        <AsyncSection
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={subjects.length === 0}
          emptyIcon={<Icon icon={AlertTriangle} size={22} />}
          emptyText={t("empty")}
          emptyHint={t("emptyHint")}
          onRetry={() => q.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <SubjectCard key={s.id} s={s} />
            ))}
          </div>
        </AsyncSection>
      </div>
    </div>
  );
}
