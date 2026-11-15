import { demoParse } from "./demoParser";
import { readDocument } from "./document";
import { extractWithGemini, type GeminiConfig } from "./gemini";
import { detectInstructionLikeText, sanitizeExtraction } from "./sanitize";
import { ExtractionError, matchSchool, type ExtractionResponse, type RawExtraction } from "./schema";

export interface ExtractRequest {
  file?: { name: string; type: string; bytes: Uint8Array };
  pastedText?: string;
  engine: "ai" | "demo";
  externalAIConsent: boolean;
}

export const MAX_PASTE_CHARS = 30000;

/**
 * Turns an uploaded/pasted resume into editable, sanitized fields. Nothing is persisted here:
 * the raw document lives only for the duration of this request.
 */
export async function extractProfile(req: ExtractRequest, gemini: GeminiConfig | null): Promise<ExtractionResponse> {
  try {
    let text = "";
    let pdfBytes: Uint8Array | null = null;
    if (req.file) {
      const doc = await readDocument(req.file.name, req.file.type, req.file.bytes);
      text = doc.text;
      if (doc.kind === "pdf") pdfBytes = doc.bytes;
    } else if (typeof req.pastedText === "string") {
      if (req.pastedText.length > MAX_PASTE_CHARS) throw new ExtractionError("too_large", "Pasted text is limited to 30,000 characters.");
      text = req.pastedText;
    } else {
      throw new ExtractionError("empty", "Upload a resume or paste its text.");
    }

    const hits = detectInstructionLikeText(text);
    const warnings: string[] = [];
    if (hits.length)
      warnings.push(
        `This document contains text that reads like instructions to an AI system (“${hits[0].slice(0, 60)}”). It was treated as data, not followed, and matching values were dropped.`,
      );

    let raw: RawExtraction;
    let engine: "gemini" | "demo-parser";
    if (req.engine === "ai") {
      if (!req.externalAIConsent)
        throw new ExtractionError("consent_required", "Gemini can only read your resume with your permission. You can use the local text parser instead.", true);
      if (!gemini) throw new ExtractionError("not_configured", "Gemini isn’t configured on this server. Use the local text parser instead.", true);
      if (!pdfBytes && text.trim().length < 40) throw new ExtractionError("unreadable", "We couldn’t find enough readable text in this document.");
      raw = await extractWithGemini(pdfBytes ? { kind: "pdf", base64: Buffer.from(pdfBytes).toString("base64") } : { kind: "text", text }, gemini);
      engine = "gemini";
    } else {
      if (text.trim().length < 40)
        throw new ExtractionError(
          "unreadable",
          pdfBytes
            ? "We couldn’t find readable text in this PDF (it may be a scanned image). The demo parser can’t read images — paste the text instead."
            : "There isn’t enough text here to read. Paste the full resume text.",
        );
      raw = demoParse(text);
      engine = "demo-parser";
    }

    const { profile, dropped } = sanitizeExtraction(raw);
    // Models sometimes return only "University of Southern California". Recover the specific
    // school from the document's own text when it names one.
    if (!matchSchool(profile.school)) {
      const fromDoc = matchSchool(text);
      if (fromDoc) profile.school = fromDoc;
    }
    if (dropped && !hits.length) warnings.push("Some extracted values looked like instructions and were dropped.");
    const filled = [profile.name, profile.school, profile.careerGoals].filter(Boolean).length + profile.skills.length;
    if (filled < 2) warnings.push("Only a few fields could be read. Please fill in the rest by hand.");

    return {
      ok: true,
      engine,
      profile,
      warnings,
      notice:
        engine === "gemini"
          ? "Interpreted by Gemini (external AI). Review every field — the model can be wrong. The document was not stored."
          : "Demo parser — not AI. Read with fixed rules and keyword lists. Review every field. The document was not stored.",
    };
  } catch (e) {
    if (e instanceof ExtractionError) return { ok: false, code: e.code, message: e.message, canFallback: e.canFallback };
    return { ok: false, code: "provider_error", message: "Something went wrong while reading the document.", canFallback: true };
  }
}
