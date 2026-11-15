import { ExtractionError } from "./schema";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
export const ACCEPTED = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
} as const;

export type ValidatedDocument = { kind: "pdf"; bytes: Uint8Array; text: string } | { kind: "text"; text: string };

export function validateUploadMeta(name: string, type: string, size: number) {
  if (size === 0) throw new ExtractionError("empty", "That file is empty.");
  if (size > MAX_UPLOAD_BYTES) throw new ExtractionError("too_large", `Files must be 2 MB or smaller (this one is ${(size / 1024 / 1024).toFixed(1)} MB).`);
  const ext = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const okExt = Object.values(ACCEPTED).some((exts) => (exts as readonly string[]).includes(ext));
  const okType = type === "" || type in ACCEPTED || type === "application/octet-stream";
  if (!okExt || !okType) throw new ExtractionError("unsupported_type", "Upload a PDF, .txt or .md file.");
  return ext === ".pdf" ? "pdf" : "text";
}

export async function readDocument(name: string, type: string, bytes: Uint8Array): Promise<ValidatedDocument> {
  const kind = validateUploadMeta(name, type, bytes.byteLength);
  if (kind === "pdf") {
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 5));
    if (head !== "%PDF-") throw new ExtractionError("malformed", "That file doesn’t look like a valid PDF.");
    let text = "";
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
    } catch {
      throw new ExtractionError("malformed", "We couldn’t open that PDF. It may be damaged or password-protected.");
    }
    return { kind: "pdf", bytes, text: text ?? "" };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ExtractionError("malformed", "That text file isn’t valid UTF-8. Try saving it again as plain text.");
  }
  if (/\u0000/.test(text)) throw new ExtractionError("malformed", "That file contains binary data, not text.");
  return { kind: "text", text };
}
