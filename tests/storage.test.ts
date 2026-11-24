import { describe, expect, it } from "vitest";
import { CHAT_STORAGE_KEY, clearBrowserChat, loadBrowserChat, saveBrowserChat } from "@/lib/chat-storage";
import type { ChatUIMessage } from "@/lib/types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const messages: ChatUIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "对话保存在哪里？" }] },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "只保存在浏览器。[S1]" },
      { type: "data-sources", id: "sources", data: [{ id: "S1", title: "隐私", locator: "存储", excerpt: "浏览器" }] },
    ],
    metadata: { interrupted: true },
  },
];

describe("browser chat storage", () => {
  it("round-trips messages and sources", () => {
    const storage = new MemoryStorage();
    expect(saveBrowserChat(storage, messages)).toBe(true);
    expect(loadBrowserChat(storage)).toEqual(messages);
  });

  it("ignores malformed or unsupported data", () => {
    const storage = new MemoryStorage();
    storage.setItem(CHAT_STORAGE_KEY, "not-json");
    expect(loadBrowserChat(storage)).toEqual([]);
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 2, messages }));
    expect(loadBrowserChat(storage)).toEqual([]);
  });

  it("clears only this portal's history", () => {
    const storage = new MemoryStorage();
    saveBrowserChat(storage, messages);
    storage.setItem("other", "keep");
    clearBrowserChat(storage);
    expect(loadBrowserChat(storage)).toEqual([]);
    expect(storage.getItem("other")).toBe("keep");
  });
});
