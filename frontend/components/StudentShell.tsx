"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { IconCalendar, IconHome, IconTrophy, IconUser } from "./Icons";
import Shell, { StudentTopNav } from "./Shell";
import type { Me } from "@/lib/useAuth";

/** Обёртка студенческих страниц с нижней (моб.) и верхней (десктоп) навигацией. */
export default function StudentShell({ me, children }: { me: Me; children: ReactNode }) {
  const t = useTranslations("attend");
  const tg = useTranslations("gamify");
  const td = useTranslations("nav");

  const nav = [
    { href: "/app", label: td("dashboard"), icon: <IconHome /> },
    { href: "/app/rating", label: tg("rating"), icon: <IconTrophy /> },
    { href: "/app/attendance", label: t("checkIn"), icon: <IconCalendar /> },
    { href: "/app/profile", label: tg("profile"), icon: <IconUser /> },
  ];

  return (
    <Shell me={me} variant="top" bottomNav={nav}>
      <StudentTopNav nav={nav} />
      {children}
    </Shell>
  );
}
