import type { UIMessage } from "ai";

export type Source = {
  id: string;
  title: string;
  url?: string;
  publishedAt?: string;
  locator: string;
  excerpt: string;
};

export type ChatUIMessage = UIMessage<{ interrupted?: boolean; retryOf?: string }, { sources: Source[] }>;

export type ReferenceChunk = {
  id: string;
  documentId: string;
  title: string;
  url?: string;
  publishedAt?: string;
  locator: string;
  content: string;
  tokens: string[];
};
