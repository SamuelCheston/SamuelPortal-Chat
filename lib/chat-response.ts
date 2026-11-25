import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream, convertToModelMessages } from "ai";
import { createTranslator, type Locale } from "next-intl";
import { getModel, isMockModelEnabled } from "@/lib/model";
import { buildReferenceContext, SYSTEM_PROMPT } from "@/lib/prompt";
import type { ChatUIMessage, ReferenceChunk, Source } from "@/lib/types";

function mockAnswer(question: string, sources: Source[], t: ReturnType<typeof createTranslator>): string {
  if (sources.length === 0) {
    return t("noEvidence");
  }
  const first = sources[0];
  return t("answer", {
    question: question.slice(0, 80),
    title: first.title,
    locator: first.locator,
    source: first.id,
  });
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
  locale,
  signal,
}: {
  messages: ChatUIMessage[];
  question: string;
  chunks: ReferenceChunk[];
  sources: Source[];
  locale: Locale;
  signal: AbortSignal;
}): Promise<Response> {
  const catalog = (await import(`@/messages/${locale}.json`)).default;
  const tMock = createTranslator({ locale, messages: catalog, namespace: "Mock" });
  const tServer = createTranslator({ locale, messages: catalog, namespace: "Server" });
  const generationFailed = tServer("generationFailed");
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
    onError: () => generationFailed,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-sources", id: "sources", data: sources });
      if (!result) {
        const text = mockAnswer(question, sources, tMock);
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
          onError: () => generationFailed,
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
