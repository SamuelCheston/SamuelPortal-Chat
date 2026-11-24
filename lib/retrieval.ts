import type { ReferenceChunk, Source } from "@/lib/types";
import { tokenize } from "@/lib/text";

const MIN_SCORE = 1.2;
const MAX_RESULTS = 5;

export type RetrievalResult = {
  sources: Source[];
  chunks: ReferenceChunk[];
};

export function retrieveReferences(query: string, corpus: ReferenceChunk[]): RetrievalResult {
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0 || corpus.length === 0) {
    return { sources: [], chunks: [] };
  }

  const averageLength = corpus.reduce((sum, chunk) => sum + chunk.tokens.length, 0) / corpus.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    const frequency = corpus.reduce((sum, chunk) => sum + (chunk.tokens.includes(token) ? 1 : 0), 0);
    documentFrequency.set(token, frequency);
  }

  const scored = corpus.map((chunk) => {
    const k1 = 1.5;
    const b = 0.75;
    const score = queryTokens.reduce((sum, token) => {
      const termFrequency = chunk.tokens.filter((candidate) => candidate === token).length;
      if (termFrequency === 0) return sum;
      const documentsWithTerm = documentFrequency.get(token) || 0;
      const inverseDocumentFrequency = Math.log(1 + (corpus.length - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5));
      const lengthNormalization = termFrequency + k1 * (1 - b + b * chunk.tokens.length / averageLength);
      return sum + inverseDocumentFrequency * ((termFrequency * (k1 + 1)) / lengthNormalization);
    }, 0);
    return { chunk, score };
  });

  const chunks = scored
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ chunk }) => chunk);

  const sources = chunks.map((chunk, index) => ({
    id: `S${index + 1}`,
    title: chunk.title,
    url: chunk.url,
    publishedAt: chunk.publishedAt,
    locator: chunk.locator,
    excerpt: chunk.content.replace(/^##\s+.+\n\n/, "").slice(0, 280),
  }));
  return { sources, chunks };
}
