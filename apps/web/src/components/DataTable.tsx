import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, Icon, cls } from "@meduni/ui";

/**
 * Mobilda ikkilamchi ustunni yashirish uchun tayyor class'lar.
 *
 * Nega shunday: `<td>` larni chaqiruvchi sahifa yasaydi, DataTable ularga
 * class qo'sha olmaydi. `nth-child` variant esa Tailwind JIT uchun STATIK
 * bo'lishi shart (dinamik yasalgan class nomlari bundle'ga tushmaydi) —
 * shuning uchun 2..8-ustunlar oldindan yozib qo'yilgan.
 */
const HIDE_COL: Record<number, string> = {
  2: "[&_tr>*:nth-child(2)]:hidden sm:[&_tr>*:nth-child(2)]:table-cell",
  3: "[&_tr>*:nth-child(3)]:hidden sm:[&_tr>*:nth-child(3)]:table-cell",
  4: "[&_tr>*:nth-child(4)]:hidden sm:[&_tr>*:nth-child(4)]:table-cell",
  5: "[&_tr>*:nth-child(5)]:hidden sm:[&_tr>*:nth-child(5)]:table-cell",
  6: "[&_tr>*:nth-child(6)]:hidden sm:[&_tr>*:nth-child(6)]:table-cell",
  7: "[&_tr>*:nth-child(7)]:hidden sm:[&_tr>*:nth-child(7)]:table-cell",
  8: "[&_tr>*:nth-child(8)]:hidden sm:[&_tr>*:nth-child(8)]:table-cell",
};

export function DataTable({
  headers,
  children,
  /** Telefonda yashiriladigan ustunlar (1-dan boshlab sanaladi). Birinchi
   *  ustun (odatda nom) va amallar ustuni qoldirilishi tavsiya etiladi. */
  hideOnMobile,
}: {
  headers: string[];
  children: ReactNode;
  hideOnMobile?: number[];
}) {
  const hidden = (hideOnMobile ?? []).map((i) => HIDE_COL[i]).filter(Boolean).join(" ");
  return (
    <Card className="overflow-x-auto p-0">
      <table
        className={cls(
          "w-full text-left text-note",
          // Ustunlar yashirilsa mobilda min-width ham kerak emas.
          hidden ? "min-w-0 sm:min-w-[520px]" : "min-w-[520px]",
          hidden
        )}
      >
        <thead>
          <tr className="border-b border-line bg-bg/60 text-micro uppercase tracking-[0.06em] text-ink-faint">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Card>
  );
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onEdit}
        className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep"
        aria-label="edit"
      >
        <Icon icon={Pencil} size={16} />
      </button>
      <button
        onClick={onDelete}
        className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
        aria-label="delete"
      >
        <Icon icon={Trash2} size={16} />
      </button>
    </div>
  );
}
