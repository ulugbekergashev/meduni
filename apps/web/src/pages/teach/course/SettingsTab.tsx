import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, Check, ListChecks, type LucideIcon } from "lucide-react";
import { Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { useTeachCourseMeta, useUpdateCourseSettings } from "../api";
import { DEFAULT_RULE, UnlockRuleForm } from "./UnlockRuleForm";
import type { UnlockRule } from "../topics/api";

/** Mustaqil shart-toggle (bosilsa yoqiladi/o'chadi; ikkalasi birga bo'lishi mumkin). */
function ConditionToggle({ on, onToggle, icon, title, hint }: { on: boolean; onToggle: () => void; icon: LucideIcon; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cls("flex w-full items-start gap-3 rounded-control border p-3.5 text-left transition-colors", on ? "border-brand bg-brand-soft/50" : "border-line hover:bg-bg")}
    >
      <span className={cls("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control", on ? "bg-brand text-white" : "bg-bg text-ink-faint")}>
        <Icon icon={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-note font-bold text-ink">{title}</span>
        <span className="block text-micro text-ink-soft">{hint}</span>
      </span>
      {/* Checkbox holati — ikkalasini ham belgilash mumkinligini ko'rsatadi */}
      <span className={cls("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors", on ? "border-brand bg-brand text-white" : "border-line")}>
        {on && <Icon icon={Check} size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}

export function SettingsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "settings" });
  const { show } = useToast();

  const meta = useTeachCourseMeta(courseId);
  const save = useUpdateCourseSettings(courseId);
  const [rule, setRule] = useState<UnlockRule>(DEFAULT_RULE);
  const [sequentialUnlock, setSequentialUnlock] = useState(true);
  const [scheduleUnlock, setScheduleUnlock] = useState(false);

  useEffect(() => {
    if (meta.data) {
      setRule(meta.data.defaultUnlockRuleJson ?? DEFAULT_RULE);
      setSequentialUnlock(meta.data.sequentialUnlock ?? true);
      setScheduleUnlock(!!meta.data.scheduleUnlock);
    }
  }, [meta.data]);

  if (meta.isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  const onSave = () =>
    save.mutate({ defaultUnlockRuleJson: rule, sequentialUnlock, scheduleUnlock }, { onSuccess: () => show(t("saved")) });

  return (
    <div className="space-y-4">
      <p className="text-note text-ink-soft">{t("subtitle")}</p>

      {/* Ochilish shartlari — MUSTAQIL, ikkalasini ham tanlash mumkin */}
      <Card className="space-y-3">
        <div>
          <h2 className="text-section font-bold text-ink">{t("unlockConditions")}</h2>
          <p className="mt-0.5 text-micro text-ink-soft">{t("unlockConditionsHint")}</p>
        </div>
        <ConditionToggle on={sequentialUnlock} onToggle={() => setSequentialUnlock((v) => !v)} icon={ListChecks} title={t("modeSequential")} hint={t("modeSequentialHint")} />
        <ConditionToggle on={scheduleUnlock} onToggle={() => setScheduleUnlock((v) => !v)} icon={CalendarClock} title={t("modeSchedule")} hint={t("modeScheduleHint")} />
        {sequentialUnlock && scheduleUnlock && <p className="rounded-control bg-brand-soft/50 px-3 py-2 text-micro font-medium text-brand-deep">{t("bothOn")}</p>}
        {!sequentialUnlock && !scheduleUnlock && <p className="rounded-control bg-amber-soft px-3 py-2 text-micro font-medium text-amber">{t("noneOn")}</p>}
      </Card>

      {/* Tugash mezoni — mavzu qachon "bajarildi" hisoblanadi (progress/baho uchun). */}
      <Card className="space-y-5">
        <div>
          <h2 className="text-section font-bold text-ink">{t("completionRule")}</h2>
          <p className="mt-1 text-micro text-ink-soft">{scheduleUnlock ? t("completionHintSchedule") : t("defaultRuleHint")}</p>
        </div>
        <UnlockRuleForm value={rule} onChange={setRule} hideDate={scheduleUnlock} />
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={save.isPending}>{t("save")}</Button>
        <span className="text-micro text-ink-faint">{t("note")}</span>
      </div>
    </div>
  );
}
