import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-CN", "en"],
  defaultLocale: "en",
  localePrefix: "never",
  localeDetection: true,
  localeCookie: false,
});
