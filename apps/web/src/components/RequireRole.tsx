import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Spinner } from "@meduni/ui";
import { roleHome, useMe, type Role } from "../lib/auth";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!me || isError) return <Navigate to="/login" replace />;
  if (!roles.includes(me.role)) return <Navigate to={roleHome[me.role]} replace />;

  return <>{children}</>;
}
