import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream, convertToModelMessages } from "ai";
import { getModel, isMockModelEnabled } from "@/lib/model";
import { buildReferenceContext, SYSTEM_PROMPT } from "@/lib/prompt";
import type { ChatUIMessage, ReferenceChunk, Source } from "@/lib/types";

function mockAnswer(question: string, sources: Source[]): string {
  if (sources.length === 0) {
    return "现有资料中没有支持该结论的内容。可以换一种问法，或先补充相关公开资料。";
  }
  const first = sources[0];
  return `这是本地 Mock 回答，不会调用外部模型。\n\n检索到与“${question.slice(0, 80)}”相关的资料《${first.title}》，片段位于“${first.locator}”。 [${first.id}]\n\n配置 \`OPENAI_API_KEY\` 后将改为基于 reference 的真实回答。`;
}

function waitForMockChunk(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, 180);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function createChatResponse({
  messages,
  question,
  chunks,
  sources,
  signal,
}: {
  messages: ChatUIMessage[];
  question: string;
  chunks: ReferenceChunk[];
  sources: Source[];
  signal: AbortSignal;
}): Promise<Response> {
  const mock = isMockModelEnabled();
  const model = mock || sources.length === 0 ? undefined : getModel();
  const history = messages.slice(0, -1);
  const modelMessages = mock || sources.length === 0
    ? []
    : await convertToModelMessages(history);
  const result = model
    ? streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: [
          ...modelMessages,
          { role: "user", content: buildReferenceContext(chunks, question) },
        ],
        temperature: 0.2,
        maxOutputTokens: 1_200,
        abortSignal: signal,
      })
    : undefined;

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: messages,
    onError: () => "生成失败，请稍后重试。",
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-sources", id: "sources", data: sources });
      if (!result) {
        const text = mockAnswer(question, sources);
        const id = "answer";
        writer.write({ type: "text-start", id });
        if (mock && sources.length > 0) {
          for (let offset = 0; offset < text.length; offset += 18) {
            if (!await waitForMockChunk(signal)) {
              writer.write({ type: "text-end", id });
              return;
            }
            writer.write({ type: "text-delta", id, delta: text.slice(offset, offset + 18) });
          }
        } else {
          writer.write({ type: "text-delta", id, delta: text });
        }
        writer.write({ type: "text-end", id });
        writer.write({ type: "finish", finishReason: "stop" });
        return;
      }
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          sendFinish: true,
          onError: () => "生成失败，请稍后重试。",
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
