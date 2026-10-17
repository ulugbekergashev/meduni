import { useTranslation } from "react-i18next";
import { cls } from "@meduni/ui";
import { BentoCard } from "../../components/bento";
import { useMyProfile, useMyRank, type LeaderboardRow } from "./api";

function Row({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation(undefined, { keyPrefix: "leaderboard" });
  return (
    <li
      className={cls(
        "flex items-center gap-3 rounded-control px-2 py-2 transition-colors",
        row.isMe ? "bg-brand-soft" : "hover:bg-surface-raised"
      )}
    >
      <span
        className={cls(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-micro font-semibold tabular-nums",
          // Medal ranglari o'rniga tinch chip: ekranda 10 ta yaltiroq doira shovqin
          // (§4 "tugadi holati yorqin rang emas"). Birinchi uchtasi qora chipda.
          row.rank <= 3 ? "bg-ink text-surface" : "bg-surface-raised text-ink-soft"
        )}
      >
        {row.rank}
      </span>
      <p className="min-w-0 flex-1 truncate text-note font-semibold text-ink">
        {row.fullName}
        {row.isMe && (
          <span className="ml-2 rounded-pill bg-brand px-2 py-0.5 text-micro font-semibold text-surface">{t("you")}</span>
        )}
      </p>
      <span className="shrink-0 text-micro tabular-nums text-ink-soft">{t("completedN", { count: row.completed })}</span>
    </li>
  );
}

/** Guruh reytingi — top-10 (ismlar bilan, buyurtmachi qarori). Guruhsiz talaba
 *  yoki bo'sh reyting bo'lsa hech narsa ko'rsatmaydi. */
export function LeaderboardCard() {
  const { t } = useTranslation(undefined, { keyPrefix: "leaderboard" });
  const q = useMyRank();
  const profile = useMyProfile();
  const data = q.data;

  if (q.isError) return <BentoCard title={t("title")} isError onRetry={() => q.refetch()} />;
  if (!data || data.rank === null || data.top.length === 0) return null;

  const meInTop = data.top.some((r) => r.isMe);

  return (
    <BentoCard title={t("title")} meta={`${data.rank}/${data.total}`} bodyClassName="px-2 pb-2">
      <ul className="space-y-0.5">
        {data.top.map((r) => (
          <Row key={r.rank} row={r} />
        ))}
        {!meInTop && (
          <>
            <li className="px-4 py-1 text-center text-ink-faint" aria-hidden>
              ···
            </li>
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
      </ul>
    </BentoCard>
  );
}
