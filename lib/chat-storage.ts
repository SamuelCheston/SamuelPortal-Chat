import type { ChatUIMessage, Source } from "@/lib/types";

export const CHAT_STORAGE_KEY = "samuel-portal-chat-v1";
const MAX_MESSAGES = 80;
const MAX_STORAGE_CHARS = 400_000;

export function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function messageSources(message: ChatUIMessage): Source[] {
  const part = message.parts.find((part) => part.type === "data-sources");
  if (!part || part.type !== "data-sources" || !Array.isArray(part.data)) return [];
  return part.data.filter(isSource);
}

function isSource(value: unknown): value is Source {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<Source>;
  return (
    typeof source.id === "string" &&
    typeof source.title === "string" &&
    typeof source.locator === "string" &&
    typeof source.excerpt === "string" &&
    (source.url === undefined || typeof source.url === "string") &&
    (source.publishedAt === undefined || typeof source.publishedAt === "string")
  );
}

function parseMessage(value: unknown): ChatUIMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChatUIMessage>;
  if (
    typeof candidate.id !== "string" ||
    !candidate.id ||
    (candidate.role !== "user" && candidate.role !== "assistant") ||
    !Array.isArray(candidate.parts)
  ) {
    return null;
  }

  const parts: ChatUIMessage["parts"] = [];
  for (const part of candidate.parts) {
    if (part.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text.slice(0, 50_000) });
    } else if (part.type === "data-sources" && Array.isArray(part.data)) {
      parts.push({ type: "data-sources", id: part.id, data: part.data.filter(isSource).slice(0, 10) });
    }
  }
  if (parts.length === 0) return null;
  return {
    id: candidate.id.slice(0, 128),
    role: candidate.role,
    parts,
    metadata:
      candidate.metadata?.interrupted === true
        ? { interrupted: true }
        : typeof candidate.metadata?.retryOf === "string"
          ? { retryOf: candidate.metadata.retryOf.slice(0, 128) }
          : undefined,
  };
}

export function loadBrowserChat(storage: Storage): ChatUIMessage[] {
  const raw = storage.getItem(CHAT_STORAGE_KEY);
  if (!raw || raw.length > MAX_STORAGE_CHARS) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; messages?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return [];
    return parsed.messages
      .slice(-MAX_MESSAGES)
      .map(parseMessage)
      .filter((message): message is ChatUIMessage => message !== null);
  } catch {
    return [];
  }
}

export function saveBrowserChat(storage: Storage, messages: ChatUIMessage[]): boolean {
  const payload = JSON.stringify({ version: 1, messages: messages.slice(-MAX_MESSAGES) });
  if (payload.length > MAX_STORAGE_CHARS) return false;
  try {
    storage.setItem(CHAT_STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function clearBrowserChat(storage: Storage): void {
  try {
    storage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy modes; in-memory state still clears.
  }
}
