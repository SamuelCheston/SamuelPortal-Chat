import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { negotiateBrowserLocale } from "@/i18n/negotiate";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const locale = hasLocale(routing.locales, explicitLocale)
    ? explicitLocale
    : negotiateBrowserLocale((await headers()).get("accept-language") ?? undefined);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
