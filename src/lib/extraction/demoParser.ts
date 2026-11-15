import { conceptsInText, labelFor } from "@/domain/ontology";
import { matchSchool, type RawExtraction } from "./schema";

/**
 * SIMPLE READER — NOT AI.
 * A deterministic, rule-based reader for resumes. It understands two common layouts:
 *   1. labelled lines, e.g. "Skills: Python, SQL"
 *   2. section headings on their own line, e.g. "SKILLS" followed by the content (typical of PDFs,
 *      including letter-spaced headings like "S K I L L S" that PDF text extraction produces).
 * It uses line labels, a list of USC school names and a small keyword ontology. It does not
 * understand language.
 */
export function demoParse(text: string): RawExtraction {
  const lines = text
    .split(/\r?\n/)
    .map((l) => collapseSpacedCaps(l.trim()))
    .filter(Boolean);

  // Index sections: a heading line (known label, optionally with a trailing colon) owns the
  // lines that follow until the next heading.
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const l of lines) {
    const h = l.replace(/[:：]\s*$/, "").trim().toLowerCase();
    if (HEADINGS.has(h)) {
      current = h;
      if (!sections.has(h)) sections.set(h, []);
      continue;
    }
    if (current) sections.get(current)!.push(l);
  }

  const field = (...labels: string[]) => {
    for (const l of lines) {
      const m = l.match(/^([A-Za-z /&]+)\s*[:\-–—]\s*(.+)$/);
      if (m && labels.some((x) => m[1].trim().toLowerCase() === x)) return m[2].trim();
    }
    for (const x of labels) {
      const body = sections.get(x);
      if (body && body.length) return body.join(LIST_SECTIONS.has(x) ? ", " : " ");
    }
    return "";
  };
  const split = (s: string) =>
    s
      .split(/[,;|•·]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const name = lines.find((l) => !l.includes(":") && !HEADINGS.has(l.toLowerCase()) && /^[\p{L}' .-]{3,60}$/u.test(l)) ?? "";
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

const LIST_SECTIONS = new Set(["skills", "technical skills", "tools", "interests", "communities", "activities", "involvement", "organizations", "target roles", "industries"]);
const HEADINGS = new Set([
  "objective", "goal", "goals", "career goal", "career goals", "summary", "profile",
  "target roles", "industries", "skills", "technical skills", "tools", "interests",
  "communities", "activities", "involvement", "organizations",
  "education", "experience", "work experience", "projects", "leadership", "awards", "honors",
]);

/** "S K I L L S" -> "SKILLS". Only touches lines made entirely of single spaced capitals. */
function collapseSpacedCaps(l: string) {
  return /^(?:[A-Z&] ){2,}[A-Z&]$/.test(l) ? l.replace(/ /g, "") : l;
}

const ROLE_LIKE = new Set(["product-management", "software-engineering", "machine-learning", "data-science", "design-ux", "consulting", "research"]);
