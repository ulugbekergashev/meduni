"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const switchTo = (next: "uz" | "ru") => {
    document.cookie = `locale=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <div className="flex gap-1 text-sm">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`rounded px-2 py-1 ${
            locale === l ? "bg-sky-600 text-white" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {l === "uz" ? "Oʻz" : "Ру"}
        </button>
      ))}
    </div>
  );
}
