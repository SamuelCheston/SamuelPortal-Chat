"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Source } from "@/lib/types";

function safeHref(href?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function MarkdownMessage({
  text,
  sources,
  onOpenSource,
}: {
  text: string;
  sources: Source[];
  onOpenSource: (source: Source, trigger: HTMLButtonElement) => void;
}) {
  const components: Components = {
    img: ({ alt }) => alt ? <span className="image-placeholder">图片：{alt}</span> : null,
    a: ({ href, children, ...props }) => {
      const citationId = href?.match(/^#source-(S\d+)$/)?.[1];
      if (citationId) {
        const source = sources.find((candidate) => candidate.id === citationId);
        if (!source) return <span className="citation citation-missing">{children}</span>;
        return (
          <button type="button" className="citation" onClick={(event) => onOpenSource(source, event.currentTarget)}>
            {children}
          </button>
        );
      }
      const safe = safeHref(href);
      if (!safe) return <span>{children}</span>;
      const external = safe.startsWith("http");
      return (
        <a href={safe} {...props} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {children}
        </a>
      );
    },
  };

  const prepared = text.replace(/\[(S\d+)\]/g, "[$1](#source-$1)");
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
