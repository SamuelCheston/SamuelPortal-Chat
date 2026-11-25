"use client";

import { Box, Button, Link } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
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
  onOpenSource: (source: Source) => void;
}) {
  const t = useTranslations("Markdown");
  const components: Components = {
    img: ({ alt }) => alt ? (
      <Box component="span" sx={{ display: "block", px: 1.5, py: 1.5, border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, color: "text.secondary" }}>
        {t("image", { alt })}
      </Box>
    ) : null,
    a: ({ href, children, title }) => {
      const citationId = href?.match(/^#source-(S\d+)$/)?.[1];
      if (citationId) {
        const source = sources.find((candidate) => candidate.id === citationId);
        if (!source) return <Box component="span" className="citation citation-missing" sx={{ opacity: 0.65 }}>{children}</Box>;
        return (
          <Button
            type="button"
            className="citation"
            variant="contained"
            color="secondary"
            size="small"
            disableElevation
            onClick={() => onOpenSource(source)}
            sx={{ minWidth: 0, minHeight: 28, mx: 0.25, px: 1, py: 0.125, borderRadius: 2, fontSize: "0.76em", fontWeight: 600, lineHeight: 1.6, verticalAlign: "baseline" }}
          >
            {children}
          </Button>
        );
      }
      const safe = safeHref(href);
      if (!safe) return <span>{children}</span>;
      const external = safe.startsWith("http");
      return (
        <Link href={safe} title={title} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {children}
        </Link>
      );
    },
  };

  const prepared = text.replace(/\[(S\d+)\]/g, "[$1](#source-$1)");
  return (
    <Box
      className="markdown"
      sx={{
        color: "text.primary",
        fontSize: { xs: 14, sm: 15 },
        lineHeight: 1.8,
        overflowWrap: "anywhere",
        "& > :first-of-type": { mt: 0 },
        "& > :last-of-type": { mb: 0 },
        "& p": { m: 0, mb: "0.9em" },
        "& h1, & h2, & h3, & h4": { mt: "1.4em", mb: "0.55em", lineHeight: 1.4 },
        "& h1": { fontSize: "1.4em" },
        "& h2": { fontSize: "1.22em" },
        "& h3, & h4": { fontSize: "1.08em" },
        "& ul, & ol": { m: 0, mb: "1em", pl: "1.5em" },
        "& li": { my: "0.28em" },
        "& strong": { fontWeight: 700 },
        "& blockquote": { m: "1em 0", px: 2, py: 0.75, borderInlineStart: 4, borderColor: "primary.main", borderRadius: "0 12px 12px 0", bgcolor: "action.hover", color: "text.secondary" },
        "& code": { px: 0.5, py: 0.15, borderRadius: 1.25, bgcolor: "action.hover", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.88em" },
        "& pre": { maxWidth: "100%", m: "1em 0", p: 2, overflowX: "auto", borderRadius: 4, bgcolor: "action.hover" },
        "& pre code": { p: 0, bgcolor: "transparent", fontSize: 13 },
        "& table": { display: "block", maxWidth: "100%", m: "1em 0", overflowX: "auto", borderCollapse: "collapse" },
        "& th, & td": { minWidth: 120, px: 1.5, py: 1, border: 1, borderColor: "divider", textAlign: "start" },
        "& th": { bgcolor: "action.hover" },
        "& a": { textDecorationThickness: "1px" },
        "& hr": { my: "1.5em", border: 0, borderTop: 1, borderColor: "divider" },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {prepared}
      </ReactMarkdown>
    </Box>
  );
}
