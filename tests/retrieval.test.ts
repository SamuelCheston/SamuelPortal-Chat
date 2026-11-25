import { describe, expect, it } from "vitest";
import { retrieveReferences } from "@/lib/retrieval";
import { tokenize } from "@/lib/text";
import type { ReferenceChunk } from "@/lib/types";

function chunk(id: string, title: string, content: string): ReferenceChunk {
  return {
    id,
    documentId: id,
    title,
    locator: title,
    content,
    tokens: [...tokenize(title), ...tokenize(title), ...tokenize(title), ...tokenize(content)],
  };
}

describe("reference retrieval", () => {
  const corpus = [
    chunk("portal", "关于 Samuel 的个人门户", "这是 Samuel 的个人门户，AI 对话是主要入口。访问者无需逐页浏览，可以直接询问主人公开分享的内容；助手会检索相关资料、组织回答，并尽量标注来源。"),
    chunk("privacy", "隐私与对话存储", "对话历史只保存在访问者浏览器，可以一键清空。提问会发送给模型服务。"),
    chunk("citations", "引用与资料核查", "回答应标注来源，访问者可以打开原始资料核对重要事实。"),
    chunk("unrelated", "咖啡冲煮", "水温、研磨粗细和萃取时间会影响咖啡风味。"),
  ];

  it("finds relevant Chinese references", () => {
    const result = retrieveReferences("对话历史保存在哪里？", corpus);
    expect(result.chunks[0]?.documentId).toBe("privacy");
    expect(result.sources[0]?.id).toBe("S1");
  });

  it("finds a useful source for the portal suggestion", () => {
    const result = retrieveReferences("请介绍一下这个个人门户", corpus);
    expect(result.chunks[0]?.documentId).toBe("portal");
  });

  it("returns no sources for an unsupported question", () => {
    expect(retrieveReferences("火星基地的供电功率是多少？", corpus)).toEqual({ sources: [], chunks: [] });
  });

  it("limits results and creates contiguous citation ids", () => {
    const result = retrieveReferences("资料 回答 来源 对话 历史 引用 核查", corpus);
    expect(result.sources.length).toBeLessThanOrEqual(5);
    expect(result.sources.map((source) => source.id)).toEqual(result.sources.map((_, index) => `S${index + 1}`));
  });
});
