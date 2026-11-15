/** Original mark: two open arcs facing each other — a conversation. Not a university mark. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="31" height="31" rx="2" fill="#7d1428" />
      <path d="M13.5 9.5a6.5 6.5 0 1 0 0 13" fill="none" stroke="#fffcf6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.5 9.5a6.5 6.5 0 1 1 0 13" fill="none" stroke="#d9b45f" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.6" fill="#fffcf6" />
    </svg>
  );
}
