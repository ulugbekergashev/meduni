import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { cls } from "@meduni/ui";
import { RailCard } from "../../components/HeroStats";
import { useMyProfile, useMyRank, type LeaderboardRow } from "./api";

function Row({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation(undefined, { keyPrefix: "leaderboard" });
  const top3 = row.rank <= 3;
  return (
    <div
      className={cls(
        "flex items-center gap-3 px-4 py-2.5",
        row.isMe && "bg-brand-soft"
      )}
    >
      <div
        className={cls(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-note font-bold tabular-nums",
          top3 ? "bg-amber-soft text-amber" : "bg-surface-raised text-ink-soft"
        )}
      >
        {row.rank}
      </div>
      <p className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
        {row.fullName}
        {row.isMe && (
          <span className="ml-1.5 rounded-pill bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
            {t("you")}
          </span>
        )}
      </p>
      <span className="shrink-0 text-note font-semibold tabular-nums text-ink-soft">
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
