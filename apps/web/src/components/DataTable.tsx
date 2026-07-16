import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, Icon } from "@meduni/ui";

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[520px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-bg/60 text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
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
