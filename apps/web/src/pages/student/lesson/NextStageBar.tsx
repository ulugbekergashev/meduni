import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();
  const next = nextOpenStage(stages, currentKey);
  if (!next) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.15 }}
      className="mt-3 flex justify-end border-t border-line pt-3"
    >
      <button
        onClick={() => onSelect(next.key)}
        className="group inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-note font-bold text-white transition-[background-color,transform] hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.98]"
      >
        {t("nextStage")}: {t(`stage_${next.key}`)}
        <Icon icon={ArrowRight} size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </motion.div>
  );
}
