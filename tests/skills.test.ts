import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, SYSTEM_PROMPT } from "@/lib/prompt";
import { parseFixedSkill } from "@/lib/skill";

const validSkill = `---
name: portal-fixed
description: 固定技能测试
---

# 固定规则

先给结论，再给依据。`;

describe("fixed skill", () => {
  it("parses frontmatter and instructions", () => {
    expect(parseFixedSkill(validSkill)).toEqual({
      name: "portal-fixed",
      description: "固定技能测试",
      instructions: "# 固定规则\n\n先给结论，再给依据。",
    });
  });

  it("rejects missing frontmatter and empty instructions", () => {
    expect(() => parseFixedSkill("直接写规则")).toThrow("INVALID_SKILL_FRONTMATTER");
    expect(() => parseFixedSkill("---\nname: portal-fixed\ndescription: test\n---\n")).toThrow("EMPTY_SKILL_INSTRUCTIONS");
  });

  it("rejects invalid names and oversized descriptions", () => {
    expect(() => parseFixedSkill(validSkill.replace("name: portal-fixed", "name: ../escape"))).toThrow("INVALID_SKILL_NAME");
    expect(() => parseFixedSkill(validSkill.replace("description: 固定技能测试", `description: ${"x".repeat(1_025)}`))).toThrow("INVALID_SKILL_DESCRIPTION");
  });

  it("loads the project skill file through the same parser", async () => {
    const raw = await readFile(path.join(process.cwd(), "content", "skills", "portal-fixed", "SKILL.md"), "utf8");
    expect(parseFixedSkill(raw).name).toBe("portal-fixed");
  });

  it("injects the fixed skill into the trusted system prompt", () => {
    const skill = parseFixedSkill(validSkill);
    const prompt = buildSystemPrompt(skill);
    expect(prompt).toContain(SYSTEM_PROMPT);
    expect(prompt).toContain("<fixed_skill>");
    expect(prompt).toContain(skill.instructions);
    expect(prompt).toContain("每次回答都必须遵循它");
  });
});
