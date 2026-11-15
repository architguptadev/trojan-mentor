// A small, hand-written synonym ontology used by the heuristic compatibility score.
// It is intentionally transparent: every term maps to a canonical key and a label,
// and matches are explained by naming the canonical concept that both sides share.

const GROUPS: Record<string, { label: string; terms: string[] }> = {
  "product-management": {
    label: "Product management",
    terms: ["product management", "product manager", "pm", "apm", "associate product manager", "product"],
  },
  "software-engineering": {
    label: "Software engineering",
    terms: ["software engineering", "software engineer", "swe", "backend", "frontend", "full-stack", "full stack", "developer", "web development"],
  },
  "machine-learning": {
    label: "Machine learning",
    terms: ["machine learning", "ml", "ai", "artificial intelligence", "deep learning", "ml engineer", "applied ml", "llm", "llms"],
  },
  "data-science": {
    label: "Data science & analytics",
    terms: ["data science", "data scientist", "analytics", "data analysis", "data analyst", "statistics", "sql", "r"],
  },
  "climate-energy": {
    label: "Climate & energy",
    terms: ["climate", "clean energy", "energy", "sustainability", "climate tech", "renewables", "decarbonization"],
  },
  "public-policy": {
    label: "Public policy",
    terms: ["public policy", "policy", "government", "urban planning", "civic tech", "public sector", "policy analysis"],
  },
  "health-care": {
    label: "Health care",
    terms: ["health care", "healthcare", "health", "digital health", "medicine", "clinical", "public health", "biotech"],
  },
  "finance": {
    label: "Finance",
    terms: ["finance", "investment banking", "banking", "private equity", "venture capital", "vc", "financial modeling", "fintech", "investing"],
  },
  "consulting": {
    label: "Consulting & strategy",
    terms: ["consulting", "management consulting", "strategy", "case interviews", "business strategy"],
  },
  "entertainment-media": {
    label: "Entertainment & media",
    terms: ["entertainment", "film", "television", "tv", "media", "streaming", "music industry", "games", "gaming", "animation"],
  },
  "journalism": {
    label: "Journalism & communications",
    terms: ["journalism", "reporting", "communications", "editorial", "writing", "storytelling", "pr", "public relations"],
  },
  "design-ux": {
    label: "Design & UX",
    terms: ["design", "ux", "ui", "user experience", "product design", "ux research", "user research", "interaction design", "figma"],
  },
  "marketing": {
    label: "Marketing & growth",
    terms: ["marketing", "brand", "growth", "brand strategy", "digital marketing", "social media"],
  },
  "entrepreneurship": {
    label: "Entrepreneurship",
    terms: ["entrepreneurship", "startup", "startups", "founder", "founding", "venture"],
  },
  "research": {
    label: "Research",
    terms: ["research", "phd", "academic research", "lab research"],
  },
  "marine-science": {
    label: "Marine science",
    terms: ["marine biology", "marine biologist", "marine science", "oceanography", "ocean conservation", "fisheries"],
  },
  "python": { label: "Python", terms: ["python", "pandas", "numpy"] },
  "javascript": { label: "JavaScript / TypeScript", terms: ["javascript", "typescript", "react", "node", "next.js"] },
  "public-speaking": { label: "Public speaking", terms: ["public speaking", "presenting", "pitching", "debate"] },
  "leadership": { label: "Leadership", terms: ["leadership", "team leadership", "people management", "managing teams"] },
  "hardware": { label: "Hardware & robotics", terms: ["hardware", "robotics", "embedded", "electrical engineering", "mechanical engineering"] },
};

const TERM_INDEX = new Map<string, string>();
for (const [key, g] of Object.entries(GROUPS)) {
  for (const t of g.terms) TERM_INDEX.set(t, key);
}

export function normalizeTerm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.+\-\s/&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a free-text term to a canonical concept key. Unknown terms map to themselves. */
export function canonical(raw: string): string {
  const n = normalizeTerm(raw);
  if (!n) return "";
  return TERM_INDEX.get(n) ?? `raw:${n}`;
}

export function labelFor(key: string): string {
  if (GROUPS[key]) return GROUPS[key].label;
  return key.startsWith("raw:") ? capitalize(key.slice(4)) : key;
}

export function canonicalSet(terms: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of terms) {
    const c = canonical(t);
    if (c) s.add(c);
  }
  return s;
}

export function knownConcepts(): { key: string; label: string; terms: string[] }[] {
  return Object.entries(GROUPS).map(([key, g]) => ({ key, ...g }));
}

/** Scan free text for ontology terms (whole-word). Used by the deterministic demo parser. */
export function conceptsInText(text: string): string[] {
  const n = ` ${normalizeTerm(text)} `;
  const found = new Set<string>();
  for (const [term, key] of TERM_INDEX) {
    if (term.length <= 2) continue; // too ambiguous for free-text scanning (e.g. "pm", "r")
    if (n.includes(` ${term} `)) found.add(key);
  }
  return [...found];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
