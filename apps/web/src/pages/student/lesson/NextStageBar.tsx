import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Icon } from "@meduni/ui";
import { nextOpenStage, type StageInfo, type StageKey } from "./stages";

/** Pastki "Keyingi bosqich: ..." tugmasi (layout v2) — joriy yuza yakunlangach
 *  ko'rinadi va talabani oqim bo'ylab keyingi bosqichga olib o'tadi. */
export function NextStageBar({
  stages,
  currentKey,
  onSelect,
}: {
  stages: StageInfo[];
  currentKey: StageKey;
  onSelect: (key: StageKey) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const next = nextOpenStage(stages, currentKey);
  if (!next) return null;

  return (
    <div className="mt-3 flex justify-end border-t border-line pt-3">
      <button
        onClick={() => onSelect(next.key)}
        className="inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-note font-extrabold text-white transition-colors hover:bg-brand-deep"
      >
        {t("nextStage")}: {t(`stage_${next.key}`)}
        <Icon icon={ArrowRight} size={14} />
      </button>
    </div>
  );
}
