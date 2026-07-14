import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { Button, Card, Icon, Toggle, useToast } from "@meduni/ui";
import { DEFAULT_RULE, UnlockRuleForm } from "../course/UnlockRuleForm";
import { useSetTopicUnlockRule, type TopicDetail, type UnlockRule } from "./api";

export function TopicUnlockRule({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "settings" });
  const { show } = useToast();
  const save = useSetTopicUnlockRule(topic.id);

  const [override, setOverride] = useState(topic.unlockRule !== null);
  const [rule, setRule] = useState<UnlockRule>(topic.unlockRule ?? DEFAULT_RULE);

  const toggle = (on: boolean) => {
    setOverride(on);
    if (!on) save.mutate(null, { onSuccess: () => show(t("saved")) }); // fall back to course default
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-soft">
            <Icon icon={SlidersHorizontal} size={16} />
          </div>
          <div>
            <p className="text-section font-bold text-ink">{t("editRule")}</p>
            <p className="text-note text-ink-faint">{override ? t("topicOverrideOn") : t("useDefault")}</p>
          </div>
        </div>
        <Toggle checked={override} onChange={toggle} aria-label="override" />
      </div>

      {override && (
        <>
          <UnlockRuleForm value={rule} onChange={setRule} />
          <Button onClick={() => save.mutate(rule, { onSuccess: () => show(t("saved")) })} disabled={save.isPending}>
            {t("save")}
          </Button>
        </>
      )}
    </Card>
  );
}
