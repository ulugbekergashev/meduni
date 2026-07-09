"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

const KEYS = ["lesson_completed", "quiz_passed", "quiz_perfect", "case_submitted", "attendance", "streak_bonus"];

export default function XpConfigPage() {
  const t = useTranslations("xpcfg");
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["/admin/xp-config"],
    queryFn: () => api<Record<string, number>>("/admin/xp-config"),
  });

  useEffect(() => { if (data) setValues(data); }, [data]);

  const save = useMutation({
    mutationFn: () => api("/admin/xp-config", { method: "PUT", body: { values_json: values } }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/admin/xp-config"] });
    },
  });

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Card className="max-w-md p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {KEYS.map((key) => (
            <Field key={key} label={t(key as never)}>
              <Input type="number" value={values[key] ?? 0}
                     onChange={(e) => { setValues({ ...values, [key]: Number(e.target.value) }); setSaved(false); }} />
            </Field>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
          {saved && <span className="text-sm text-emerald-600">{t("saved")}</span>}
        </div>
      </Card>
    </div>
  );
}
