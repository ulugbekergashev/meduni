import { cls } from "../cls";

export type Status = "draft" | "review" | "published";

const statusClass: Record<Status, string> = {
  draft: "bg-slate-100 text-ink-soft",
  review: "bg-amber-soft text-amber",
  published: "bg-emerald-soft text-emerald",
};

const statusLabel: Record<Status, { uz: string; ru: string }> = {
  draft: { uz: "Qoralama", ru: "Черновик" },
  review: { uz: "Tekshiruvda", ru: "На проверке" },
  published: { uz: "Chop etilgan", ru: "Опубликовано" },
};

export function StatusPill({ status, locale = "uz" }: { status: Status; locale?: "uz" | "ru" }) {
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-note font-semibold",
        statusClass[status]
      )}
    >
      {statusLabel[status][locale]}
    </span>
  );
}
