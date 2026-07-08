"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { cls } from "./ui";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const switchTo = (next: "uz" | "ru") => {
    document.cookie = `locale=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={cls(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === l ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
          )}
        >
          {l === "uz" ? "Oʻz" : "Ру"}
        </button>
      ))}
    </div>
  );
}
