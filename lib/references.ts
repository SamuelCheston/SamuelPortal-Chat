import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ReferenceChunk } from "@/lib/types";
import { tokenize } from "@/lib/text";

const REFERENCE_DIR = path.join(process.cwd(), "content", "references");
const MAX_FILES = 50;
const MAX_FILE_BYTES = 512_000;
const MAX_CHUNK_CHARS = 1_200;

type Frontmatter = {
  title?: string;
  url?: string;
  publishedAt?: string;
  summary?: string;
  tags?: string;
};

function parseFrontmatter(raw: string): { metadata: Frontmatter; body: string } {
  if (!raw.startsWith("---\n")) {
    return { metadata: {}, body: raw };
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { metadata: {}, body: raw };
  }

  const metadata: Frontmatter = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key === "title" || key === "url" || key === "publishedAt" || key === "summary" || key === "tags") {
      metadata[key] = value;
    }
  }

  return { metadata, body: raw.slice(end + 4).replace(/^\n/, "") };
}

function firstHeading(body: string): string | undefined {
  return body.split("\n").find((line) => /^#\s+\S/.test(line))?.replace(/^#\s+/, "").trim();
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function flushChunk(
  chunks: string[],
  buffer: string[],
  heading: string,
): void {
  const content = buffer.join("\n").trim();
  if (!content) return;
  const prefix = heading ? `## ${heading}\n\n` : "";
  const combined = `${prefix}${content}`;
  if (combined.length <= MAX_CHUNK_CHARS) {
    chunks.push(combined);
    return;
  }

  let remaining = combined;
  while (remaining.length > MAX_CHUNK_CHARS) {
    let splitAt = remaining.lastIndexOf("\n", MAX_CHUNK_CHARS);
    if (splitAt < MAX_CHUNK_CHARS * 0.5) splitAt = MAX_CHUNK_CHARS;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
}

function chunkMarkdown(body: string): string[] {
  const chunks: string[] = [];
  let buffer: string[] = [];
  let heading = "";

  for (const line of body.split("\n")) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushChunk(chunks, buffer, heading);
      buffer = [];
      heading = headingMatch[1].trim();
      continue;
    }
    if (!line.trim()) {
      flushChunk(chunks, buffer, heading);
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  flushChunk(chunks, buffer, heading);
  return chunks;
}

function documentTokens(chunk: Omit<ReferenceChunk, "tokens">): string[] {
  return [
    ...tokenize(chunk.title),
    ...tokenize(chunk.title),
    ...tokenize(chunk.locator),
    ...tokenize(chunk.content),
  ];
}

export async function loadReferenceCorpus(): Promise<ReferenceChunk[]> {
  let files: string[];
  try {
    files = (await readdir(REFERENCE_DIR)).filter((file) => file.endsWith(".md")).sort().slice(0, MAX_FILES);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const corpus: ReferenceChunk[] = [];
  for (const file of files) {
    const filePath = path.join(REFERENCE_DIR, file);
    const raw = await readFile(filePath, "utf8");
    if (Buffer.byteLength(raw) > MAX_FILE_BYTES) continue;
    const { metadata, body } = parseFrontmatter(raw);
    const title = metadata.title || firstHeading(body) || file.replace(/\.md$/, "");
    const documentId = file.replace(/\.md$/, "");
    const chunks = chunkMarkdown(body);
    chunks.forEach((content, index) => {
      const chunk = {
        id: `${documentId}-${index + 1}`,
        documentId,
        title,
        url: safeHttpUrl(metadata.url),
        publishedAt: metadata.publishedAt,
        locator: content.match(/^##\s+(.+)$/m)?.[1] || title,
        content,
      };
      corpus.push({ ...chunk, tokens: documentTokens(chunk) });
    });
  }
  return corpus;
}
