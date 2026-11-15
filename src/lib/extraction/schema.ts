import { z } from "zod";

export const USC_SCHOOLS = [
  { name: "Viterbi School of Engineering", keys: ["viterbi", "school of engineering"] },
  { name: "Marshall School of Business", keys: ["marshall"] },
  { name: "Annenberg School for Communication and Journalism", keys: ["annenberg"] },
  { name: "Dornsife College of Letters, Arts and Sciences", keys: ["dornsife", "letters, arts and sciences"] },
  { name: "School of Cinematic Arts", keys: ["cinematic arts", "sca"] },
  { name: "Price School of Public Policy", keys: ["price school", "public policy"] },
  { name: "Thornton School of Music", keys: ["thornton"] },
  { name: "Roski School of Art and Design", keys: ["roski"] },
  { name: "Iovine and Young Academy", keys: ["iovine", "young academy"] },
  { name: "Keck School of Medicine", keys: ["keck"] },
  { name: "Gould School of Law", keys: ["gould"] },
  { name: "Rossier School of Education", keys: ["rossier"] },
  { name: "Leonard Davis School of Gerontology", keys: ["leonard davis", "gerontology"] },
  { name: "Suzanne Dworak-Peck School of Social Work", keys: ["dworak-peck", "social work"] },
  { name: "Kaufman School of Dance", keys: ["kaufman"] },
  { name: "School of Dramatic Arts", keys: ["dramatic arts"] },
  { name: "School of Architecture", keys: ["school of architecture"] },
  { name: "Mann School of Pharmacy", keys: ["mann school", "pharmacy"] },
  { name: "Ostrow School of Dentistry", keys: ["ostrow", "dentistry"] },
] as const;

export function matchSchool(text: string): string | null {
  const t = text.toLowerCase();
  for (const s of USC_SCHOOLS) if (s.keys.some((k) => t.includes(k))) return s.name;
  return null;
}

const list = z.array(z.string()).max(40).default([]);

/** Raw shape we accept from any extractor (model or parser) BEFORE sanitizing. */
export const RawExtraction = z.object({
  name: z.string().default(""),
  school: z.string().default(""),
  program: z.string().default(""),
  gradYear: z.union([z.number(), z.string(), z.null()]).default(null),
  careerGoals: z.string().default(""),
  targetRoles: list,
  industries: list,
  skills: list,
  interests: list,
  communities: list,
});
export type RawExtraction = z.infer<typeof RawExtraction>;

export interface ExtractedProfile {
  name: string;
  school: string;
  program: string;
  gradYear: number | null;
  careerGoals: string;
  targetRoles: string[];
  industries: string[];
  skills: string[];
  interests: string[];
  communities: string[];
}

export type ExtractionEngine = "gemini" | "demo-parser";

export type ExtractionErrorCode =
  | "too_large"
  | "unsupported_type"
  | "malformed"
  | "unreadable"
  | "empty"
  | "consent_required"
  | "not_configured"
  | "timeout"
  | "quota"
  | "auth"
  | "invalid_response"
  | "provider_error";

export class ExtractionError extends Error {
  constructor(
    public code: ExtractionErrorCode,
    message: string,
    public canFallback = false,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export type ExtractionResponse =
  | { ok: true; engine: ExtractionEngine; profile: ExtractedProfile; warnings: string[]; notice: string }
  | { ok: false; code: ExtractionErrorCode; message: string; canFallback: boolean };

/** JSON schema handed to Gemini's structured-output mode. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    school: { type: "STRING" },
    program: { type: "STRING" },
    gradYear: { type: "INTEGER", nullable: true },
    careerGoals: { type: "STRING" },
    targetRoles: { type: "ARRAY", items: { type: "STRING" } },
    industries: { type: "ARRAY", items: { type: "STRING" } },
    skills: { type: "ARRAY", items: { type: "STRING" } },
    interests: { type: "ARRAY", items: { type: "STRING" } },
    communities: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["name", "school", "program", "careerGoals", "targetRoles", "industries", "skills", "interests", "communities"],
} as const;
