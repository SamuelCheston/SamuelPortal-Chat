import { loadReferenceCorpus } from "@/lib/references";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const corpus = await loadReferenceCorpus();
    return Response.json(
      {
        ok: true,
        referenceCount: new Set(corpus.map((chunk) => chunk.documentId)).size,
        modelMode: process.env.MOCK_MODEL === "true" ? "mock" : process.env.OPENAI_API_KEY?.trim() ? "live" : "unconfigured",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, referenceCount: 0, modelMode: "unconfigured" }, { status: 500 });
  }
}
