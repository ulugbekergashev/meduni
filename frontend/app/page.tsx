"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/api";
import { homeFor, useMe } from "@/lib/useAuth";

export default function Home() {
  const router = useRouter();
  const { data: me, isError } = useMe();
  const t = useTranslations("common");

  useEffect(() => {
    if (!getAccessToken() || isError) {
      router.replace("/login");
    } else if (me) {
      router.replace(homeFor(me.role));
    }
  }, [me, isError, router]);

  return <p className="p-8 text-slate-500">{t("loading")}</p>;
}
