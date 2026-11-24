import { createChatResponse } from "@/lib/chat-response";
import { getModel } from "@/lib/model";
import { checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { loadReferenceCorpus } from "@/lib/references";
import { retrieveReferences } from "@/lib/retrieval";
import type { ChatUIMessage } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 5;

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

async function readJsonLimited(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("EMPTY_BODY");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

function sanitizeMessages(value: unknown): ChatUIMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) throw new Error("INVALID_MESSAGES");
  const messages: ChatUIMessage[] = [];
  for (const item of value.slice(-20)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { id?: unknown; role?: unknown; parts?: unknown };
    if (
      typeof candidate.id !== "string" ||
      !candidate.id ||
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      !Array.isArray(candidate.parts)
    ) {
      continue;
    }
    const text = candidate.parts
      .filter((part): part is { type: "text"; text: string } =>
        Boolean(part) && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string",
      )
      .map((part) => part.text)
      .join("\n")
      .slice(0, 8_000);
    if (text) messages.push({ id: candidate.id.slice(0, 128), role: candidate.role, parts: [{ type: "text", text }] });
  }
  const last = messages.at(-1);
  if (!last || last.role !== "user") throw new Error("INVALID_MESSAGES");
  return messages;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

function trackCompletion(response: Response, onComplete: () => void): Response {
  if (!response.body) {
    onComplete();
    return response;
  }
  const reader = response.body.getReader();
  let completed = false;
  const finish = () => {
    if (!completed) {
      completed = true;
      onComplete();
    }
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        finish();
        controller.error(error);
      }
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason);
    },
  });
  return new Response(body, { status: response.status, headers: response.headers });
}

export async function POST(request: Request): Promise<Response> {
  pruneRateLimits(rateLimits);
  const limit = checkRateLimit(rateLimits, clientKey(request));
  if (!limit.allowed) {
    return jsonError("请求过于频繁，请稍后再试。", 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return jsonError("服务当前繁忙，请稍后再试。", 503);
  }

  let payload: unknown;
  try {
    payload = await readJsonLimited(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "BODY_TOO_LARGE") return jsonError("输入过长，请缩短后重试。", 413);
    if (message === "EMPTY_BODY") return jsonError("请求内容为空。", 400);
    return jsonError("请求格式无效。", 400);
  }

  let messages: ChatUIMessage[];
  try {
    messages = sanitizeMessages((payload as { messages?: unknown }).messages);
  } catch {
    return jsonError("消息格式无效。", 400);
  }

  const question = messages.at(-1)?.parts.find((part) => part.type === "text")?.text.trim() || "";
  if (!question || question.length > 4_000) {
    return jsonError("请输入 1–4000 个字符的问题。", 400);
  }

  let corpus;
  try {
    corpus = await loadReferenceCorpus();
  } catch {
    return jsonError("资料暂时无法读取，请稍后再试。", 500);
  }
  const { chunks, sources } = retrieveReferences(question, corpus);

  if (process.env.MOCK_MODEL !== "true" && sources.length > 0) {
    try {
      getModel();
    } catch {
      return jsonError("模型服务尚未配置，请联系门户主人。", 503);
    }
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 45_000);
  const signal = AbortSignal.any([request.signal, timeoutController.signal]);
  activeRequests += 1;
  try {
    const response = await createChatResponse({ messages, question, chunks, sources, signal });
    return trackCompletion(response, () => {
      activeRequests = Math.max(0, activeRequests - 1);
      clearTimeout(timeout);
    });
  } catch {
    activeRequests = Math.max(0, activeRequests - 1);
    clearTimeout(timeout);
    if (signal.aborted) return jsonError("生成超时，请稍后重试。", 504);
    return jsonError("生成失败，请稍后重试。", 500);
  }
}
