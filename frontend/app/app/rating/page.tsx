"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconTrophy } from "@/components/Icons";
import StudentShell from "@/components/StudentShell";
import { Avatar, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Row = { rank: number; student_id: number; name: string; xp: number };
type Leaderboard = { top: Row[]; me: Row | null; total: number };

const medal = ["🥇", "🥈", "🥉"];

export default function RatingPage() {
  const { me } = useRequireRole("student");
  const t = useTranslations("gamify");
  const [scope, setScope] = useState<"group" | "course" | "faculty">("group");
  const [period, setPeriod] = useState<"week" | "semester">("week");

  const { data } = useQuery({
    queryKey: ["leaderboard", scope, period],
    queryFn: () => api<Leaderboard>(`/leaderboards?scope=${scope}&period=${period}`),
    enabled: !!me,
  });

  if (!me) return null;
  const inTop = data?.top.some((r) => r.student_id === me.id);

  return (
    <StudentShell me={me}>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <IconTrophy className="text-amber-500" /> {t("leaderboard")}
      </h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["group", "course", "faculty"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={cls("rounded-md px-3 py-1 font-medium",
                scope === s ? "bg-white text-teal-700 shadow-sm" : "text-slate-500")}>
              {t(s)}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["week", "semester"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cls("rounded-md px-3 py-1 font-medium",
                period === p ? "bg-white text-teal-700 shadow-sm" : "text-slate-500")}>
              {t(p)}
            </button>
          ))}
        </div>
      </div>

      {data && data.top.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-slate-400">{t("noData")}</Card>
      ) : (
        <div className="space-y-2">
          {data?.top.map((row) => (
            <Card key={row.student_id}
              className={cls("flex items-center gap-3 p-3",
                row.student_id === me.id && "ring-2 ring-teal-400")}>
              <span className="w-8 text-center text-lg font-bold text-slate-400">
                {row.rank <= 3 ? medal[row.rank - 1] : row.rank}
              </span>
              <Avatar name={row.name} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-slate-800">
                {row.student_id === me.id ? t("you") : row.name}
              </span>
              <span className="font-semibold text-teal-600">{row.xp} XP</span>
            </Card>
          ))}

          {/* позиция самого студента, если он вне топ-10 */}
          {data?.me && !inTop && (
            <>
              <p className="py-1 text-center text-slate-300">···</p>
              <Card className="flex items-center gap-3 p-3 ring-2 ring-teal-400">
                <span className="w-8 text-center text-lg font-bold text-slate-400">{data.me.rank}</span>
                <Avatar name={data.me.name} size="sm" />
                <span className="flex-1 text-sm font-medium text-slate-800">{t("you")}</span>
                <span className="font-semibold text-teal-600">{data.me.xp} XP</span>
              </Card>
            </>
          )}
          {data?.me && (
            <p className="mt-2 text-center text-sm text-slate-500">
              {t("youAre", { rank: data.me.rank, total: data.total })}
            </p>
          )}
        </div>
      )}
    </StudentShell>
  );
}
