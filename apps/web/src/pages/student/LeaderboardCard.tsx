import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { cls } from "@meduni/ui";
import { RailCard } from "../../components/HeroStats";
import { useMyProfile, useMyRank, type LeaderboardRow } from "./api";

function Row({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation(undefined, { keyPrefix: "leaderboard" });
  return (
    <div
      className={cls(
        "group flex items-center gap-4 px-5 py-3.5 transition-all duration-300 hover:bg-surface-raised",
        row.isMe && "bg-brand-soft/50 ring-1 ring-brand-tint/20"
      )}
    >
      <div
        className={cls(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-black tabular-nums transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6",
          row.rank === 1 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-white shadow-lg ring-4 ring-yellow-500/20" :
          row.rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-md ring-4 ring-slate-400/20" :
          row.rank === 3 ? "bg-gradient-to-br from-orange-400 to-amber-700 text-white shadow-md ring-4 ring-orange-500/20" :
          "bg-surface-raised text-ink-soft shadow-inner border border-line"
        )}
      >
        {row.rank}
      </div>
      <p className="min-w-0 flex-1 truncate text-body font-semibold text-ink transition-colors group-hover:text-brand-tint">
        {row.fullName}
        {row.isMe && (
          <span className="ml-2 rounded-pill bg-brand-tint px-2 py-0.5 text-[11px] font-bold tracking-wide text-white drop-shadow-sm">
            {t("you")}
          </span>
        )}
      </p>
      <span className="shrink-0 text-note font-semibold tabular-nums text-ink-soft transition-colors group-hover:text-ink">
        {t("completedN", { count: row.completed })}
      </span>
    </div>
  );
}

/** Guruh reytingi — top-10 (ismlar bilan, buyurtmachi qarori). Guruhsiz talaba
 *  yoki bo'sh reyting bo'lsa hech narsa ko'rsatmaydi. */
export function LeaderboardCard() {
  const { t } = useTranslation(undefined, { keyPrefix: "leaderboard" });
  const q = useMyRank();
  const profile = useMyProfile();
  const data = q.data;

  if (!data || data.rank === null || data.top.length === 0) return null;

  const meInTop = data.top.some((r) => r.isMe);

  return (
    <RailCard title={t("title")} icon={Trophy}>
      <div className="divide-y divide-line">
        {data.top.map((r) => (
          <Row key={r.rank} row={r} />
        ))}
        {!meInTop && (
          <>
            <div className="px-4 py-1 text-center text-ink-faint">···</div>
            <Row
              row={{
                rank: data.rank,
                fullName: profile.data?.fullName ?? "",
                completed: data.completed,
                isMe: true,
              }}
            />
          </>
        )}
      </div>
    </RailCard>
  );
}
