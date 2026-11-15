import type { CSSProperties } from "react";

// Muted, distinct tones for monogram portraits. Chosen for >= 4.5:1 text contrast.
const TONES: [string, string][] = [
  ["#f3e3e4", "#6d1424"],
  ["#f4ead3", "#6b4c0e"],
  ["#e3ece5", "#24533a"],
  ["#e4e8f2", "#2f3f6b"],
  ["#efe4ee", "#5a2a57"],
  ["#e9e6df", "#463f37"],
  ["#f6e6da", "#7a3a12"],
  ["#e0ecec", "#1f5354"],
];

function tone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function Avatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const [bg, ink] = tone(id);
  return (
    <span className="avatar" aria-hidden="true" style={{ "--size": `${size}px`, "--tone-bg": bg, "--tone-ink": ink } as CSSProperties}>
      {initials(name)}
    </span>
  );
}

export function Person({ id, name, meta, size }: { id: string; name: string; meta?: string; size?: number }) {
  return (
    <div className="person">
      <Avatar id={id} name={name} size={size} />
      <div>
        <p className="person-name">{name}</p>
        {meta && <p className="person-meta">{meta}</p>}
      </div>
    </div>
  );
}

export function shortSchool(school: string) {
  return school
    .replace(/ School of Engineering$/, "")
    .replace(/ School of Business$/, "")
    .replace(/ School for Communication and Journalism$/, "")
    .replace(/ College of Letters, Arts and Sciences$/, "")
    .replace(/^School of /, "")
    .replace(/ School of Public Policy$/, "");
}
