import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get("locale")?.value === "ru" ? "ru" : "uz";
  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  };
});
