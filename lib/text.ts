const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "are", "what", "how", "can", "does",
  "的", "了", "和", "是", "在", "我", "你", "他", "她", "它", "也", "都", "就", "不", "有", "与", "及", "什么", "怎么", "能否", "可以",
]);

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const part of segmenter.segment(text.toLowerCase())) {
    if (!part.isWordLike) continue;
    const token = part.segment.trim();
    if (!token || STOP_WORDS.has(token)) continue;
    tokens.push(token);
    if (/^[a-z0-9][a-z0-9_-]{2,}$/.test(token) && tokens.length < 2_000) {
      tokens.push(...token.split(/[-_]/).filter((part) => part.length > 2 && !STOP_WORDS.has(part)));
    }
  }
  return tokens;
}
