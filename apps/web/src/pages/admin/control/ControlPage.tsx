import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Icon, Input, Modal, Select, Toggle, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { DataTable } from "../../../components/DataTable";
import { Disclosure } from "../../../components/Disclosure";
import { ExcuseInbox } from "./ExcuseInbox";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { useControlReport, usePolicies, useSavePolicy, type PolicyRow } from "../api";

/**
 * ЖЁСТКИЙ КОНТРОЛЬ (2026-08-11) — экран руководства.
 * Показывает ОТКЛОНЕНИЯ, а не средние баллы: где требования ниже коридора,
 * где студентов пропустили решением преподавателя, где тема опубликована
 * вообще без оценивания. И здесь же правится сам коридор.
 */
export function ControlPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "control" });
  const locale = useLocale();
  const { show } = useToast();
  const report = useControlReport();
  const policies = usePolicies();
  const save = useSavePolicy();
  const [edit, setEdit] = useState<PolicyRow | null>(null);
  const [draft, setDraft] = useState<Record<string, number | boolean>>({});
  const [newLevel, setNewLevel] = useState<"FACULTY" | "DEPARTMENT">("DEPARTMENT");
  const [newScope, setNewScope] = useState<string>("");

  const d = report.data;
  const totals = d?.totals;

  const openEdit = (row: PolicyRow) => {
    setEdit(row);
    setDraft({
      minQuizPassedPct: row.minQuizPassedPct,
      minVideoWatchedPct: row.minVideoWatchedPct,
      minQuizAttempts: row.minQuizAttempts,
      maxQuizAttempts: row.maxQuizAttempts,
      minAttemptGapHours: row.minAttemptGapHours,
      minMinutesPerQuestion: row.minMinutesPerQuestion,
      requireAssessment: row.requireAssessment,
      requireSequential: row.requireSequential,
      requireCase: row.requireCase,
      requireCaseReviewed: row.requireCaseReviewed,
      requireRemediation: row.requireRemediation,
      allowManualUnlock: row.allowManualUnlock,
      requirePresence: row.requirePresence,
    });
  };

  const submit = () => {
    if (!edit) return;
    save.mutate(
      { level: edit.level, scopeId: edit.scopeId, ...draft },
      {
        onSuccess: () => {
          show(t("saved"), "ok");
          setEdit(null);
        },
      }
    );
  };

  const scopeOptions = useMemo(() => {
    const p = policies.data;
    if (!p) return [] as { value: number; label: string }[];
    return newLevel === "FACULTY"
      ? p.faculties.map((f) => ({ value: f.id, label: f.name }))
      : p.departments.map((x) => ({ value: x.id, label: x.name }));
  }, [policies.data, newLevel]);

  const NUM: { key: string; label: string; hint: string; max: number }[] = [
    { key: "minQuizPassedPct", label: t("f.pass"), hint: t("h.pass"), max: 100 },
    { key: "minVideoWatchedPct", label: t("f.video"), hint: t("h.video"), max: 100 },
    { key: "minQuizAttempts", label: t("f.minAttempts"), hint: t("h.minAttempts"), max: 20 },
    { key: "maxQuizAttempts", label: t("f.maxAttempts"), hint: t("h.maxAttempts"), max: 20 },
    { key: "minAttemptGapHours", label: t("f.gap"), hint: t("h.gap"), max: 720 },
    { key: "minMinutesPerQuestion", label: t("f.minutes"), hint: t("h.minutes"), max: 30 },
  ];
  const BOOL: { key: string; label: string; hint: string }[] = [
    { key: "requireAssessment", label: t("f.assessment"), hint: t("h.assessment") },
    { key: "requireSequential", label: t("f.sequential"), hint: t("h.sequential") },
    { key: "requireCase", label: t("f.case"), hint: t("h.case") },
    { key: "requireCaseReviewed", label: t("f.caseReviewed"), hint: t("h.caseReviewed") },
    { key: "requireRemediation", label: t("f.remediation"), hint: t("h.remediation") },
    { key: "allowManualUnlock", label: t("f.manual"), hint: t("h.manual") },
    { key: "requirePresence", label: t("f.presence"), hint: t("h.presence") },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-h1 font-extrabold text-ink">{t("title")}</h1>
        <p className="mt-1 max-w-[70ch] text-note text-ink-dim">{t("subtitle")}</p>
      </div>

      {/* SPRAVKA ARIZALARI — dekanat ishi: "Sababli"ni o'qituvchi emas, dekanat
          qo'yadi, aks holda 25 % koridori ma'nosini yo'qotadi (F3). */}
      <ExcuseInbox />

      <AsyncSection
        isLoading={report.isLoading}
        isError={report.isError}
        isEmpty={false}
        emptyText={t("noPolicies")}
        onRetry={() => report.refetch()}
      >
        {totals && (
          <div className="space-y-3">
            {/* ⛔ STAT DIETASI: to'rt karta o'rniga BITTA qator. Rahbariyatga
                kerak bo'lgan narsa — "chetlashish bormi va qanaqasi", raqamlar
                galereyasi emas. Nol bo'lsa — tinch yashil qator. */}
            {(() => {
              const items = [
                { n: totals.manualUnlocksLast30d, label: t("s.manual"), tone: "text-rose" },
                { n: totals.topicsWithoutAssessment, label: t("s.bare"), tone: "text-amber" },
                { n: totals.coursesBelowPolicy, label: t("s.below"), tone: "text-amber" },
                { n: totals.coursesSequentialOff, label: t("s.seqOff"), tone: "text-rose" },
              ].filter((x) => x.n > 0);
              const clean = items.length === 0;
              return (
                <div
                  className={cls(
                    "flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-card border px-4 py-3",
                    clean ? "border-emerald/30 bg-emerald-soft" : "border-line bg-surface"
                  )}
                >
                  <span className={cls("text-section font-extrabold", clean ? "text-emerald" : "text-ink")}>
                    {clean ? t("noDeviations") : t("deviations", { n: items.reduce((a, x) => a + x.n, 0) })}
                  </span>
                  {items.map((x) => (
                    <span key={x.label} className="text-note text-ink-soft">
                      <b className={cls("font-data tabular-nums", x.tone)}>{x.n}</b> {x.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              );
            })()}

            {d.byTeacher.length > 0 && (
              <Card className="p-0">
                <p className="border-b border-line px-4 py-3 text-section font-extrabold text-ink">{t("byTeacher")}</p>
                <DataTable
                  hideOnMobile={[2]}
                  headers={[t("th.teacher"), t("th.dept"), t("th.manual"), t("th.bare"), t("th.below")]}
                >
                  {d.byTeacher.map((r) => (
                    <tr key={r.teacherId} className="border-b border-line last:border-0 hover:bg-bg/60">
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${r.teacherId}`} className="font-bold text-brand-tint hover:underline">
                          {r.teacherName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{r.departmentName}</td>
                      <td className={cls("px-4 py-3 font-bold font-data tabular-nums", r.manualUnlocks > 0 ? "text-rose" : "text-ink-dim")}>
                        {r.manualUnlocks}
                      </td>
                      <td className={cls("px-4 py-3 font-bold font-data tabular-nums", r.topicsWithoutAssessment > 0 ? "text-amber" : "text-ink-dim")}>
                        {r.topicsWithoutAssessment}
                      </td>
                      <td className={cls("px-4 py-3 font-bold font-data tabular-nums", r.coursesBelowPolicy > 0 ? "text-amber" : "text-ink-dim")}>
                        {r.coursesBelowPolicy}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            )}

            {d.topicsWithoutAssessment.length > 0 && (
              <Disclosure label={t("bareTitle")} count={d.topicsWithoutAssessment.length} storageKey="meduni.control.bare">
                <div className="divide-y divide-line">
                  {d.topicsWithoutAssessment.map((x) => (
                    <div key={x.topicId} className="flex flex-wrap items-baseline gap-x-2 py-2 text-note">
                      <Link to={`/admin/courses/${x.courseId}`} className="font-bold text-ink hover:underline">
                        {x.title}
                      </Link>
                      <span className="text-ink-dim">{x.courseName}</span>
                      <span className="ml-auto text-micro text-ink-faint">{x.teacherName}</span>
                    </div>
                  ))}
                </div>
              </Disclosure>
            )}

            {d.integrityAlerts.length > 0 && (
              <Disclosure label={t("integrityTitle")} count={d.integrityAlerts.length} storageKey="meduni.control.integrity">
                <p className="pb-2 text-micro leading-relaxed text-ink-dim">{t("integrityHint")}</p>
                <div className="divide-y divide-line">
                  {d.integrityAlerts.map((a) => (
                    <div key={a.attemptId} className="flex flex-wrap items-baseline gap-x-2 py-2 text-note">
                      <span className="font-bold text-ink">{a.studentName}</span>
                      <span className="text-ink-dim">{a.topicTitle}</span>
                      <span className="font-data tabular-nums text-ink-soft">{a.scorePct}%</span>
                      <span className="ml-auto flex flex-wrap gap-1">
                        {a.flags.map((f) => (
                          <Chip key={f} label={t(`flag.${f}`)} tone="rose" />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </Disclosure>
            )}

            <Disclosure label={t("recentTitle")} count={d.recentUnlocks.length} storageKey="meduni.control.recent">
              {d.recentUnlocks.length === 0 ? (
                <p className="py-2 text-note text-ink-dim">{t("noUnlocks")}</p>
              ) : (
                <div className="divide-y divide-line">
                  {d.recentUnlocks.map((u, i) => (
                    <div key={i} className="py-2 text-note">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold text-ink">{u.studentName}</span>
                        <span className="text-ink-dim">{u.topicTitle}</span>
                        <span className="ml-auto text-micro text-ink-faint">
                          {formatDate(locale, u.at, "short")} · {u.teacherName}
                        </span>
                      </div>
                      <p className="text-micro text-ink-soft">
                        <span className={cls("font-bold", u.reason ? "text-amber" : "text-rose")}>
                          {u.reason ? t(`reason.${u.reason}`) : t("reason.none")}
                        </span>
                        {u.note && <span className="text-ink-dim"> — {u.note}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Disclosure>
          </div>
        )}
      </AsyncSection>

      {/* Коридор политики */}
      <AsyncSection
        isLoading={policies.isLoading}
        isError={policies.isError}
        isEmpty={(policies.data?.policies.length ?? 0) === 0}
        emptyIcon={<Icon icon={ShieldCheck} size={22} />}
        emptyText={t("noPolicies")}
        onRetry={() => policies.refetch()}
      >
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Icon icon={ShieldCheck} size={16} className="text-brand-tint" />
            <p className="text-section font-extrabold text-ink">{t("policyTitle")}</p>
            <p className="w-full text-micro text-ink-dim sm:w-auto sm:flex-1">{t("policyHint")}</p>
          </div>
          <DataTable
            hideOnMobile={[4]}
            headers={[t("th.level"), t("th.pass"), t("th.attempts"), t("th.strict"), t("th.updated"), ""]}
          >
            {(policies.data?.policies ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3 font-bold text-ink">
                  {t(`level.${p.level}`)}
                  {p.scopeName && <span className="font-medium text-ink-dim"> · {p.scopeName}</span>}
                </td>
                <td className="px-4 py-3 font-data tabular-nums text-ink-soft">{p.minQuizPassedPct}%</td>
                <td className="px-4 py-3 font-data tabular-nums text-ink-soft">
                  {p.minQuizAttempts}–{p.maxQuizAttempts} · {p.minAttemptGapHours}
                  {t("hoursShort")}
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {p.requireAssessment && <Chip label={t("c.assessment")} />}
                    {p.requireSequential && <Chip label={t("c.sequential")} />}
                    {p.requireRemediation && <Chip label={t("c.remediation")} />}
                    {!p.allowManualUnlock && <Chip label={t("c.noManual")} tone="rose" />}
                  </span>
                </td>
                <td className="px-4 py-3 text-micro text-ink-faint">
                  {p.updatedBy ?? "—"} · {formatDate(locale, p.updatedAt, "short")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    {t("editBtn")}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <div className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
            <label className="min-w-[160px] flex-1">
              <span className="mb-1 block text-micro font-bold text-ink-soft">{t("addLevel")}</span>
              <Select
                value={newLevel}
                onChange={(e) => {
                  setNewLevel(e.target.value as "FACULTY" | "DEPARTMENT");
                  setNewScope("");
                }}
              >
                <option value="DEPARTMENT">{t("level.DEPARTMENT")}</option>
                <option value="FACULTY">{t("level.FACULTY")}</option>
              </Select>
            </label>
            <label className="min-w-[200px] flex-1">
              <span className="mb-1 block text-micro font-bold text-ink-soft">{t("addScope")}</span>
              <Select value={newScope} onChange={(e) => setNewScope(e.target.value)}>
                <option value="">—</option>
                {scopeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              size="md"
              disabled={!newScope}
              onClick={() => {
                const base = policies.data?.policies.find((p) => p.level === "UNIVERSITY");
                if (!base) return;
                openEdit({
                  ...base,
                  id: 0,
                  level: newLevel,
                  scopeId: Number(newScope),
                  scopeName: scopeOptions.find((o) => String(o.value) === newScope)?.label ?? null,
                });
              }}
            >
              {t("addBtn")}
            </Button>
          </div>
        </Card>
      </AsyncSection>

      <Modal open={!!edit} onClose={() => !save.isPending && setEdit(null)} title={t("editTitle")}>
        <p className="text-note font-bold text-ink">
          {edit && t(`level.${edit.level}`)}
          {edit?.scopeName && ` · ${edit.scopeName}`}
        </p>
        <p className="mt-1 text-micro text-ink-dim">{t("editHint")}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {NUM.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-micro font-bold text-ink-soft">{f.label}</span>
              <Input
                type="number"
                min={0}
                max={f.max}
                value={String(draft[f.key] ?? 0)}
                onChange={(e) => setDraft((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
              />
              <span className="mt-0.5 block text-micro leading-snug text-ink-faint">{f.hint}</span>
            </label>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {BOOL.map((f) => (
            <div key={f.key} className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2">
              <Toggle checked={!!draft[f.key]} onChange={(v) => setDraft((s) => ({ ...s, [f.key]: v }))} />
              <div className="min-w-0 flex-1">
                <p className="text-note font-bold text-ink">{f.label}</p>
                <p className="text-micro leading-relaxed text-ink-dim">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => setEdit(null)} disabled={save.isPending}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={save.isPending}>
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Chip({ label, tone = "brand" }: { label: string; tone?: "brand" | "rose" }) {
  return (
    <span
      className={cls(
        "rounded-pill px-2 py-0.5 text-micro font-bold",
        tone === "rose" ? "bg-rose-soft text-rose" : "bg-brand-soft text-brand-tint"
      )}
    >
      {label}
    </span>
  );
}
