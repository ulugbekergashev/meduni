import { useTranslation } from "react-i18next";
import { Input, Select } from "@meduni/ui";
import { Field } from "../../../components/Field";
import type { UnlockRule } from "../topics/api";

export const DEFAULT_RULE: UnlockRule = {
  videoWatchedPct: 80,
  quizPassedPct: 70,
  quizMaxAttempts: 1,
  caseRequired: true,
  caseReviewedRequired: false,
  notBeforeDate: null,
  logic: "AND",
};

export function UnlockRuleForm({ value, onChange, hideDate = false }: { value: UnlockRule; onChange: (r: UnlockRule) => void; hideDate?: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "settings" });
  const set = (p: Partial<UnlockRule>) => onChange({ ...value, ...p });
  const num = (v: string, fallback: number) => (v === "" ? fallback : Math.max(0, Number(v)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("videoPct")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={value.videoWatchedPct}
            onChange={(e) => set({ videoWatchedPct: num(e.target.value, 0) })}
          />
        </Field>
        <Field label={t("quizPct")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={value.quizPassedPct}
            onChange={(e) => set({ quizPassedPct: num(e.target.value, 0) })}
          />
        </Field>
        <Field label={t("maxAttempts")}>
          <Input
            type="number"
            min={1}
            value={value.quizMaxAttempts}
            onChange={(e) => set({ quizMaxAttempts: num(e.target.value, 1) })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-[14.5px] text-ink">
        <input type="checkbox" checked={value.caseRequired} onChange={(e) => set({ caseRequired: e.target.checked })} />
        {t("caseRequired")}
      </label>
      <label className="flex items-center gap-2 text-[14.5px] text-ink">
        <input
          type="checkbox"
          checked={value.caseReviewedRequired}
          onChange={(e) => set({ caseReviewedRequired: e.target.checked })}
        />
        {t("caseReviewed")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {!hideDate && (
          <Field label={t("notBeforeDate")}>
            <Input
              type="date"
              value={value.notBeforeDate ?? ""}
              onChange={(e) => set({ notBeforeDate: e.target.value || null })}
            />
          </Field>
        )}
        <Field label={t("logic")}>
          <Select value={value.logic} onChange={(e) => set({ logic: e.target.value as "AND" | "OR" })}>
            <option value="AND">{t("logicAnd")}</option>
            <option value="OR">{t("logicOr")}</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}
