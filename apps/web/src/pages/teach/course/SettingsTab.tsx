import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Card, Spinner, useToast } from "@meduni/ui";
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

  useEffect(() => {
    if (meta.data) setRule(meta.data.defaultUnlockRuleJson ?? DEFAULT_RULE);
  }, [meta.data]);

  if (meta.isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-[14.5px] text-ink-soft">{t("subtitle")}</p>
      <Card className="space-y-5">
        <h2 className="text-section font-bold text-ink">{t("defaultRule")}</h2>
        <UnlockRuleForm value={rule} onChange={setRule} />
        <div className="flex items-center gap-3">
          <Button onClick={() => save.mutate(rule, { onSuccess: () => show(t("saved")) })} disabled={save.isPending}>
            {t("save")}
          </Button>
          <span className="text-[13px] text-ink-faint">{t("note")}</span>
        </div>
      </Card>
    </div>
  );
}
