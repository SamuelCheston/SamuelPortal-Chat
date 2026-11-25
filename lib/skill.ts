export type FixedSkill = {
  name: string;
  description: string;
  instructions: string;
};

const MAX_SKILL_CHARS = 64_000;
const MAX_DESCRIPTION_CHARS = 1_024;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseFixedSkill(raw: string): FixedSkill {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (normalized.length > MAX_SKILL_CHARS) throw new Error("SKILL_TOO_LARGE");
  if (!normalized.startsWith("---\n")) throw new Error("INVALID_SKILL_FRONTMATTER");

  const frontmatterEnd = normalized.indexOf("\n---\n", 4);
  if (frontmatterEnd === -1) throw new Error("INVALID_SKILL_FRONTMATTER");

  const metadata = new Map<string, string>();
  for (const line of normalized.slice(4, frontmatterEnd).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error("INVALID_SKILL_FRONTMATTER");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!key || !value || metadata.has(key)) throw new Error("INVALID_SKILL_FRONTMATTER");
    metadata.set(key, value);
  }

  const name = metadata.get("name");
  const description = metadata.get("description");
  const instructions = normalized.slice(frontmatterEnd + 5).trim();
  if (!name || !SKILL_NAME.test(name)) throw new Error("INVALID_SKILL_NAME");
  if (!description || description.length > MAX_DESCRIPTION_CHARS) throw new Error("INVALID_SKILL_DESCRIPTION");
  if (!instructions) throw new Error("EMPTY_SKILL_INSTRUCTIONS");

  return { name, description, instructions };
}
