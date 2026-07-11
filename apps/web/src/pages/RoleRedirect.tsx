import { Navigate } from "react-router-dom";
import { Spinner } from "@meduni/ui";
import { roleHome, useMe } from "../lib/auth";

export function RoleRedirect() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!me || isError) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome[me.role] ?? "/login"} replace />;
}
