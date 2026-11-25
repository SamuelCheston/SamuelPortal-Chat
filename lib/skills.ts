import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseFixedSkill, type FixedSkill } from "@/lib/skill";

const FIXED_SKILL_PATH = path.join(process.cwd(), "content", "skills", "portal-fixed", "SKILL.md");
const MAX_SKILL_BYTES = 128_000;

export async function loadFixedSkill(): Promise<FixedSkill> {
  const raw = await readFile(FIXED_SKILL_PATH, "utf8");
  if (Buffer.byteLength(raw) > MAX_SKILL_BYTES) throw new Error("SKILL_TOO_LARGE");
  return parseFixedSkill(raw);
}
