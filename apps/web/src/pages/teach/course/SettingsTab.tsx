import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, ListChecks } from "lucide-react";
import { Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { useTeachCourseMeta, useUpdateCourseSettings } from "../api";
import { DEFAULT_RULE, UnlockRuleForm } from "./UnlockRuleForm";
import type { UnlockRule } from "../topics/api";

export function SettingsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "settings" });
  const { show } = useToast();

  const meta = useTeachCourseMeta(courseId);
  const save = useUpdateCourseSettings(courseId);
  const [rule, setRule] = useState<UnlockRule>(DEFAULT_RULE);
  const [scheduleUnlock, setScheduleUnlock] = useState(false);

  useEffect(() => {
    if (meta.data) {
      setRule(meta.data.defaultUnlockRuleJson ?? DEFAULT_RULE);
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
    save.mutate(
      { defaultUnlockRuleJson: rule, scheduleUnlock },
      { onSuccess: () => show(t("saved")) }
    );

  return (
    <div className="space-y-4">
      <p className="text-[14.5px] text-ink-soft">{t("subtitle")}</p>

      {/* Ochilish rejimi — ketma-ketlik yoki dars jadvali */}
      <Card className="space-y-3">
        <h2 className="text-section font-bold text-ink">{t("unlockMode")}</h2>
        <button
          type="button"
          onClick={() => setScheduleUnlock(false)}
          className={cls(
            "flex w-full items-start gap-3 rounded-control border p-3.5 text-left transition-colors",
            !scheduleUnlock ? "border-brand bg-brand-soft/50" : "border-line hover:bg-bg"
          )}
        >
          <span className={cls("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control", !scheduleUnlock ? "bg-brand text-white" : "bg-bg text-ink-faint")}>
            <Icon icon={ListChecks} size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ink">{t("modeSequential")}</span>
            <span className="block text-[13px] text-ink-soft">{t("modeSequentialHint")}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setScheduleUnlock(true)}
          className={cls(
            "flex w-full items-start gap-3 rounded-control border p-3.5 text-left transition-colors",
            scheduleUnlock ? "border-brand bg-brand-soft/50" : "border-line hover:bg-bg"
          )}
        >
          <span className={cls("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control", scheduleUnlock ? "bg-brand text-white" : "bg-bg text-ink-faint")}>
            <Icon icon={CalendarClock} size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ink">{t("modeSchedule")}</span>
            <span className="block text-[13px] text-ink-soft">{t("modeScheduleHint")}</span>
          </span>
        </button>
      </Card>

      {/* Tugash mezoni — mavzu qachon "bajarildi" hisoblanadi (progress/baho uchun).
          Sana-rejimida ham kerak: ochilish sanadan, lekin tugash shu mezondan. */}
      <Card className="space-y-5">
        <div>
          <h2 className="text-section font-bold text-ink">{t("completionRule")}</h2>
          <p className="mt-1 text-[13px] text-ink-soft">{scheduleUnlock ? t("completionHintSchedule") : t("defaultRuleHint")}</p>
        </div>
        <UnlockRuleForm value={rule} onChange={setRule} hideDate={scheduleUnlock} />
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={save.isPending}>{t("save")}</Button>
        <span className="text-[13px] text-ink-faint">{t("note")}</span>
      </div>
    </div>
  );
}
