import { NextResponse } from "next/server";
import { callLLM, type LlmMessage } from "@/lib/llm";

// Route serveur de la fondation LLM (S-034). Le navigateur ne parle qu'à NOS routes, jamais au proxy :
// la clé `LITELLM_API_KEY` reste côté serveur. Squelette « chat » ; le contexte reco arrive en S-040.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessages(value: unknown): value is LlmMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((m) => isRecord(m) && typeof m.role === "string" && typeof m.content === "string")
  );
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "JSON invalide" }, { status: 400 });
  }
  const messages = isRecord(body) ? body.messages : undefined;
  if (!isMessages(messages)) {
    return NextResponse.json({ ok: false, reason: "Champ « messages » requis (role + content)" }, { status: 400 });
  }
  const result = await callLLM(messages);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
