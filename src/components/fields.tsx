"use client";

import { useId, useState } from "react";
import { DAY_PARTS, WEEKDAYS, type Slot } from "@/domain/types";

export function SlotPicker({ value, onChange, legend, hint, invalid }: { value: Slot[]; onChange: (v: Slot[]) => void; legend: string; hint?: string; invalid?: boolean }) {
  const id = useId();
  const toggle = (s: Slot) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={invalid || undefined}>
      <legend>{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="hint" style={{ margin: "4px 0 10px" }}>
          {hint}
        </p>
      )}
      <div className="slot-grid" role="group" style={{ marginTop: hint ? 0 : 10 }}>
        <span aria-hidden="true" />
        {WEEKDAYS.map((d) => (
          <span key={d} className="day" aria-hidden="true">
            {d}
          </span>
        ))}
        {DAY_PARTS.map((p) => (
          <SlotRow key={p} part={p} value={value} toggle={toggle} />
        ))}
      </div>
    </fieldset>
  );
}

function SlotRow({ part, value, toggle }: { part: (typeof DAY_PARTS)[number]; value: Slot[]; toggle: (s: Slot) => void }) {
  return (
    <>
      <span className="slot-label" aria-hidden="true">
        {part[0].toUpperCase() + part.slice(1)}
      </span>
      {WEEKDAYS.map((d) => {
        const s = `${d}-${part}` as Slot;
        return (
          <label key={s}>
            <input type="checkbox" checked={value.includes(s)} onChange={() => toggle(s)} aria-label={`${d} ${part}`} />
            <span className="box" aria-hidden="true" />
          </label>
        );
      })}
    </>
  );
}

/** Comma-separated list editor that keeps raw text while typing. */
export function ListField({ label, value, onChange, hint, required, invalid }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; required?: boolean; invalid?: boolean }) {
  const id = useId();
  const [text, setText] = useState(value.join(", "));
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="muted"> (required)</span>}
      </label>
      <input
        id={id}
        type="text"
        value={text}
        aria-describedby={`${id}-hint`}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 15),
          );
        }}
      />
      <span id={`${id}-hint`} className="hint">
        {hint ?? "Separate items with commas."}
      </span>
    </div>
  );
}

export function TextField({ label, value, onChange, hint, required, multiline, invalid, type = "text", maxLength = 500 }: { label: string; value: string; onChange: (v: string) => void; hint?: string; required?: boolean; multiline?: boolean; invalid?: boolean; type?: string; maxLength?: number }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="muted"> (required)</span>}
      </label>
      {multiline ? (
        <textarea id={id} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={invalid || undefined} required={required} />
      ) : (
        <input id={id} type={type} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={invalid || undefined} required={required} />
      )}
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}
