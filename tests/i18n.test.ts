import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";
import { negotiateBrowserLocale } from "@/i18n/negotiate";
import en from "@/messages/en.json";
import zh from "@/messages/zh-CN.json";

describe("browser language negotiation", () => {
  it("selects Simplified Chinese for supported Chinese browser locales", () => {
    expect(negotiateBrowserLocale("zh-CN,zh;q=0.9")).toBe("zh-CN");
  });

  it("selects English for English browser locales", () => {
    expect(negotiateBrowserLocale("en-US,en;q=0.9")).toBe("en");
  });

  it("uses the next supported language in the preference list", () => {
    expect(negotiateBrowserLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("en");
  });

  it("falls back to English for unsupported, missing, or malformed languages", () => {
    expect(negotiateBrowserLocale("fr-FR,fr;q=0.9")).toBe("en");
    expect(negotiateBrowserLocale("zh-TW")).toBe("en");
    expect(negotiateBrowserLocale()).toBe("en");
    expect(negotiateBrowserLocale("not a locale")).toBe("en");
  });
});

describe("i18n configuration", () => {
  it("supports Chinese and uses English as the default", () => {
    expect(routing.locales).toEqual(["zh-CN", "en"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localeDetection).toBe(true);
  });

  it("provides localized interface and API messages", () => {
    const english = createTranslator({ locale: "en", messages: en });
    const chinese = createTranslator({ locale: "zh-CN", messages: zh });

    expect(english("Welcome.title")).toBe("No page-hopping. Just ask.");
    expect(chinese("Welcome.title")).toBe("不必逐页浏览，直接问我");
    expect(english("Header.brand")).toBe("Samuel's Personal Portal");
    expect(chinese("Header.brand")).toBe("Samuel 的个人门户");
    expect(english("Nav.classicPortal")).toBe("Browse Classic Portal");
    expect(chinese("Nav.classicPortal")).toBe("浏览传统版门户");
    expect(english("Messages.sourceCount", { count: 1 })).toBe("1 source");
    expect(english("Messages.sourceCount", { count: 2 })).toBe("2 sources");
    expect(english("Server.busy")).toBe("The service is busy. Please try again later.");
    expect(chinese("Server.busy")).toBe("服务当前繁忙，请稍后再试。");
  });
});
