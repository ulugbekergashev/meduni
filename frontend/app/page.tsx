"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconLogo } from "@/components/Icons";
import { getAccessToken } from "@/lib/api";
import { homeFor, useMe } from "@/lib/useAuth";

export default function Home() {
  const router = useRouter();
  const { data: me, isError } = useMe();

  useEffect(() => {
    if (!getAccessToken() || isError) {
      router.replace("/login");
    } else if (me) {
      router.replace(homeFor(me.role));
    }
  }, [me, isError, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <IconLogo className="animate-pulse text-5xl text-teal-600" />
    </div>
  );
}
