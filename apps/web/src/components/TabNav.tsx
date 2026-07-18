import { NavLink } from "react-router-dom";
import { cls } from "@meduni/ui";

export interface TabItem {
  to: string;
  label: string;
}

/** Segmented tab bar: bordered track, the active tab sits on a brand chip. */
export function TabNav({ items }: { items: TabItem[] }) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cls(
              "shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2 text-[15px] font-semibold transition-all",
              isActive
                ? "bg-brand-soft text-brand-deep"
                : "text-ink-soft hover:bg-bg hover:text-ink"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
