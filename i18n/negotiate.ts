import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { hasLocale, type Locale } from "next-intl";
import { routing } from "@/i18n/routing";

export function negotiateBrowserLocale(acceptLanguage?: string): Locale {
  try {
    const requestedLocales = new Negotiator({
      headers: { "accept-language": acceptLanguage ?? "" },
    }).languages();
    const matchedLocale = match(requestedLocales, routing.locales, routing.defaultLocale, { algorithm: "lookup" });
    return hasLocale(routing.locales, matchedLocale) ? matchedLocale : routing.defaultLocale;
  } catch {
    return routing.defaultLocale;
  }
}
