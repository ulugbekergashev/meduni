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
        "group flex items-center gap-3 border-t border-line-soft px-4 py-2.5 transition-colors first:border-t-0 hover:bg-surface-raised",
        row.isMe && "bg-brand-soft"
      )}
    >
      <div
        className={cls(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-micro font-bold tabular-nums",
          // Medal ranglari o'rniga tinch chip: ekranda 10 ta yaltiroq doira shovqin
          // (§4 "tugadi holati yorqin rang emas"). Birinchi uchtasi brend chipida.
          row.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-surface-raised text-ink-faint"
        )}
      >
        {row.rank}
      </div>
      <p className="min-w-0 flex-1 truncate text-note text-ink">
        {row.fullName}
        {row.isMe && (
          <span className="ml-2 rounded-pill bg-brand px-2 py-0.5 text-micro font-bold text-white">
            {t("you")}
          </span>
        )}
      </p>
      <span className="shrink-0 font-data text-micro tabular-nums text-ink-faint">
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
