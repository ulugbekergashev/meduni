"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { IconFlame } from "@/components/Icons";
import StudentShell from "@/components/StudentShell";
import { Card, cls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/useAuth";

type Stats = { total_xp: number; current_streak_days: number; best_streak: number };
type Badge = { code: string; title_uz: string; title_ru: string; icon: string; earned: boolean };

export default function ProfilePage() {
  const { me } = useRequireRole("student");
  const t = useTranslations("gamify");
  const locale = useLocale();

  const { data: stats } = useQuery({
    queryKey: ["my-stats"], queryFn: () => api<Stats>("/me/stats"), enabled: !!me,
  });
  const { data: badges } = useQuery({
    queryKey: ["my-badges"], queryFn: () => api<Badge[]>("/me/badges"), enabled: !!me,
  });

  if (!me) return null;

  return (
    <StudentShell me={me}>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{me.full_name}</h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-teal-600">{stats?.total_xp ?? 0}</p>
          <p className="text-xs text-slate-500">{t("xp")}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-500">
            <IconFlame /> {stats?.current_streak_days ?? 0}
          </p>
          <p className="text-xs text-slate-500">{t("streak")}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{stats?.best_streak ?? 0}</p>
          <p className="text-xs text-slate-500">{t("bestStreak")}</p>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">{t("badges")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {badges?.map((badge) => (
          <Card key={badge.code}
                className={cls("flex flex-col items-center gap-1.5 p-4 text-center",
                  !badge.earned && "opacity-40 grayscale")}>
            <span className="text-3xl">{badge.icon}</span>
            <span className="text-xs font-medium text-slate-700">
              {locale === "ru" ? badge.title_ru : badge.title_uz}
            </span>
          </Card>
        ))}
      </div>
    </StudentShell>
  );
}
