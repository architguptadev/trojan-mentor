import { conceptsInText, labelFor } from "@/domain/ontology";
import { matchSchool, type RawExtraction } from "./schema";

/**
 * DEMO PARSER — NOT AI.
 * A deterministic, rule-based reader for plain-text resumes laid out with simple labelled lines
 * ("Objective:", "Skills:", "Interests:", "Communities:"). It uses line labels, a list of USC
 * school names and a small keyword ontology. It does not understand language.
 */
export function demoParse(text: string): RawExtraction {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const field = (...labels: string[]) => {
    for (const l of lines) {
      const m = l.match(/^([A-Za-z /&]+)\s*[:\-–—]\s*(.+)$/);
      if (m && labels.some((x) => m[1].trim().toLowerCase() === x)) return m[2].trim();
    }
    return "";
  };
  const split = (s: string) =>
    s
      .split(/[,;|•·]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const name = lines.find((l) => !l.includes(":") && /^[\p{L}' .-]{3,60}$/u.test(l)) ?? "";
  const schoolLine = lines.find((l) => matchSchool(l)) ?? "";
  const school = schoolLine ? (matchSchool(schoolLine) as string) : "";
  const programLine = lines.find((l) => /\b(B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|MBA|Ph\.?D\.?|B\.?F\.?A\.?|M\.?F\.?A\.?)\b/.test(l)) ?? "";
  const program = (programLine.match(/((?:B|M)\.?\s?(?:S|A|F\.?A)\.?|MBA|Ph\.?D\.?)[^,|;()]*?(?=,|\||;|\(|\bexpected\b|$)/i)?.[0] ?? "").trim();
  const yearMatch = (lines.find((l) => /expected|class of|graduat/i.test(l)) ?? programLine).match(/20\d{2}/);
  const careerGoals = field("objective", "goal", "goals", "career goal", "career goals", "summary");
  const goalConcepts = conceptsInText(careerGoals);
  const roleField = split(field("target roles", "target role", "roles", "seeking"));
  const industryField = split(field("industries", "industry", "fields"));

  return {
    name,
    school,
    program,
    gradYear: yearMatch ? Number(yearMatch[0]) : null,
    careerGoals,
    targetRoles: roleField.length ? roleField : goalConcepts.filter((c) => ROLE_LIKE.has(c)).map(labelFor),
    industries: industryField.length ? industryField : goalConcepts.filter((c) => !ROLE_LIKE.has(c)).map(labelFor),
    skills: split(field("skills", "technical skills", "tools")),
    interests: split(field("interests")),
    communities: split(field("communities", "activities", "involvement", "organizations")),
  };
}

const ROLE_LIKE = new Set(["product-management", "software-engineering", "machine-learning", "data-science", "design-ux", "consulting", "research"]);
