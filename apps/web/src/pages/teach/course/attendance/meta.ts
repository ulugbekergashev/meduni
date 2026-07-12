import type { AttStatus } from "../../api";

export const STATUS_META: Record<AttStatus, { tone: string; solid: string; ring: string; short: string }> = {
  PRESENT: { tone: "text-emerald", solid: "bg-emerald text-white border-emerald", ring: "border-emerald text-emerald", short: "K" },
  ABSENT: { tone: "text-rose", solid: "bg-rose text-white border-rose", ring: "border-rose text-rose", short: "KM" },
  LATE: { tone: "text-amber", solid: "bg-amber text-white border-amber", ring: "border-amber text-amber", short: "KCH" },
  EXCUSED: { tone: "text-blue", solid: "bg-blue text-white border-blue", ring: "border-blue text-blue", short: "S" },
};

export const STATUSES: AttStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}
