import { NavLink } from "react-router-dom";
import { cls } from "@meduni/ui";

export interface TabItem {
  to: string;
  label: string;
}

export function TabNav({ items }: { items: TabItem[] }) {
  return (
    <div className="flex gap-1 border-b border-line">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cls(
              "-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
              isActive
                ? "border-brand text-brand-deep"
                : "border-transparent text-ink-soft hover:text-ink"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
