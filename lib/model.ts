import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getModel() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const provider = createOpenAICompatible({
    name: "openai-compatible",
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    includeUsage: true,
  });
  return provider(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
}

export function isMockModelEnabled(): boolean {
  return process.env.MOCK_MODEL === "true";
}
