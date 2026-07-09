"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, cls } from "./ui";
import { api } from "@/lib/api";

export type UnlockRule = {
  logic: "and" | "or";
  video_min_pct: number;
  quiz_min_score: number;
  quiz_max_attempts: number;
  case_required: boolean;
  case_require_reviewed: boolean;
  available_from: string | null;
};

const DEFAULT: UnlockRule = {
  logic: "and", video_min_pct: 80, quiz_min_score: 70, quiz_max_attempts: 3,
  case_required: false, case_require_reviewed: false, available_from: null,
};

/** Конструктор правил открытия (план §6.2). endpoint — куда PUT {unlock_rule_json}. */
export default function UnlockRuleEditor({
  endpoint, initial, title,
}: {
  endpoint: string;
  initial?: Partial<UnlockRule> | null;
  title: string;
}) {
  const t = useTranslations("unlock");
  const [rule, setRule] = useState<UnlockRule>({ ...DEFAULT, ...(initial || {}) });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api(endpoint, { method: "PUT", body: { unlock_rule_json: rule } }),
    onSuccess: () => setSaved(true),
  });

  const set = <K extends keyof UnlockRule>(k: K, v: UnlockRule[K]) => {
    setRule({ ...rule, [k]: v });
    setSaved(false);
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("videoMinPct")}</span>
          <input type="number" min={0} max={100} value={rule.video_min_pct}
                 onChange={(e) => set("video_min_pct", Number(e.target.value))}
                 className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("quizMinScore")}</span>
          <input type="number" min={0} max={100} value={rule.quiz_min_score}
                 onChange={(e) => set("quiz_min_score", Number(e.target.value))}
                 className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("quizMaxAttempts")}</span>
          <input type="number" min={1} max={10} value={rule.quiz_max_attempts}
                 onChange={(e) => set("quiz_max_attempts", Number(e.target.value))}
                 className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">{t("availableFrom")}</span>
          <input type="date" value={rule.available_from ?? ""}
                 onChange={(e) => set("available_from", e.target.value || null)}
                 className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rule.case_required}
                 onChange={(e) => set("case_required", e.target.checked)} />
          {t("caseRequired")}
        </label>
        <label className={cls("flex items-center gap-2 text-sm", !rule.case_required && "opacity-40")}>
          <input type="checkbox" checked={rule.case_require_reviewed} disabled={!rule.case_required}
                 onChange={(e) => set("case_require_reviewed", e.target.checked)} />
          {t("caseReviewed")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">{t("logic")}:</span>
          <select value={rule.logic} onChange={(e) => set("logic", e.target.value as "and" | "or")}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
            <option value="and">{t("logicAnd")}</option>
            <option value="or">{t("logicOr")}</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
        {saved && <span className="text-sm text-emerald-600">{t("saved")}</span>}
      </div>
    </Card>
  );
}
