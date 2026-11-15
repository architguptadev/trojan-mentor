import { NextResponse } from "next/server";
import { geminiConfigFromEnv } from "@/lib/extraction/gemini";
import { extractProfile } from "@/lib/extraction/service";
import { MAX_UPLOAD_BYTES } from "@/lib/extraction/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports capability only. Never returns the key. */
export async function GET() {
  return NextResponse.json({ geminiConfigured: geminiConfigFromEnv() !== null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024)
    return NextResponse.json({ ok: false, code: "too_large", message: "Files must be 2 MB or smaller.", canFallback: false }, { status: 413 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, code: "malformed", message: "The upload couldn’t be read.", canFallback: false }, { status: 400 });
  }
  const file = form.get("file");
  const text = form.get("text");
  const engine = form.get("engine") === "ai" ? "ai" : "demo";
  const consent = form.get("externalAIConsent") === "true";
  const result = await extractProfile(
    {
      engine,
      externalAIConsent: consent,
      file: file instanceof File && file.size > 0 ? { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined,
      pastedText: typeof text === "string" && text.length ? text : undefined,
    },
    geminiConfigFromEnv(),
  );
  const status = result.ok ? 200 : result.code === "too_large" ? 413 : ["quota"].includes(result.code) ? 429 : ["timeout", "provider_error", "auth", "invalid_response"].includes(result.code) ? 502 : 422;
  return NextResponse.json(result, { status, headers: { "cache-control": "no-store" } });
}
