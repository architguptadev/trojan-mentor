import { matchSchool, type ExtractedProfile, type RawExtraction } from "./schema";

/** Patterns that suggest a document is trying to instruct an AI system. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
  /disregard (all |any |the )?(previous|prior|above) /i,
  /\bsystem prompt\b/i,
  /\byou are (now )?(an? )?(ai|assistant|language model|chatbot)\b/i,
  /\b(assistant|system)\s*:/i,
  /\b(rate|score|rank) (this|the) (candidate|student|applicant)\b/i,
  /\b(match|pair) me with\b/i,
  /\bset (the )?(score|compatibility) to\b/i,
  /<\s*\/?\s*(script|system|instructions?)\b/i,
];

export function detectInstructionLikeText(text: string): string[] {
  const hits: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    const m = text.match(p);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits)];
}

// Strip C0/C1 control characters (except newline/tab), zero-width and bidi-override characters.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;

export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  let t = s.replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
  return t;
}

function cleanList(xs: unknown, maxItems = 12, maxLen = 60): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const t = cleanText(x, maxLen).replace(/^[-•*·\s]+/, "");
    if (!t || detectInstructionLikeText(t).length) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Normalize and bound any extractor output. Instruction-like values are dropped, not obeyed. */
export function sanitizeExtraction(raw: RawExtraction, currentYear = new Date().getFullYear()): { profile: ExtractedProfile; dropped: number } {
  let dropped = 0;
  const guard = (s: string) => {
    if (detectInstructionLikeText(s).length) {
      dropped++;
      return "";
    }
    return s;
  };
  const yearNum = typeof raw.gradYear === "string" ? parseInt(raw.gradYear, 10) : raw.gradYear;
  const gradYear = typeof yearNum === "number" && Number.isFinite(yearNum) && yearNum >= currentYear - 10 && yearNum <= currentYear + 8 ? yearNum : null;
  const schoolRaw = guard(cleanText(raw.school, 120));
  const profile: ExtractedProfile = {
    name: guard(cleanText(raw.name, 80)),
    school: matchSchool(schoolRaw) ?? schoolRaw,
    program: guard(cleanText(raw.program, 120)),
    gradYear,
    careerGoals: guard(cleanText(raw.careerGoals, 500)),
    targetRoles: cleanList(raw.targetRoles, 6),
    industries: cleanList(raw.industries, 8),
    skills: cleanList(raw.skills, 15),
    interests: cleanList(raw.interests, 10),
    communities: cleanList(raw.communities, 8),
  };
  const before = [raw.targetRoles, raw.industries, raw.skills, raw.interests, raw.communities].reduce((a, l) => a + (l?.length ?? 0), 0);
  const after = profile.targetRoles.length + profile.industries.length + profile.skills.length + profile.interests.length + profile.communities.length;
  dropped += Math.max(0, Math.min(before, 57) - after) > 0 ? countInjectedListItems(raw) : 0;
  return { profile, dropped };
}

function countInjectedListItems(raw: RawExtraction) {
  return [raw.targetRoles, raw.industries, raw.skills, raw.interests, raw.communities]
    .flat()
    .filter((x) => typeof x === "string" && detectInstructionLikeText(x).length).length;
}
