import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Card, Input } from "@meduni/ui";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { roleHome, useLogin } from "../lib/auth";

export function Login() {
  const { t } = useTranslation(undefined, { keyPrefix: "login" });
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: (me) => navigate(roleHome[me.role] ?? "/", { replace: true }) }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
            <p className="text-[14.5px] text-ink-soft">{t("subtitle")}</p>
          </div>
          <LocaleSwitcher />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {login.isError && <p className="text-[14px] text-rose">{t("error")}</p>}
          <Button type="submit" size="lg" disabled={login.isPending} className="mt-2 w-full">
            {t("submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
