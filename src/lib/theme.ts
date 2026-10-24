export const ACCENTS = ["lime", "violet", "ember", "ocean"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "lime";
export const ACCENT_COOKIE = "accent";
export const ACCENT_SWATCH: Record<Accent, string> = {
  lime: "#c6ff3d",
  violet: "#a78bfa",
  ember: "#ff7a2f",
  ocean: "#3ab8ff",
};

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && (ACCENTS as readonly string[]).includes(v);
}

/** Client only: apply, persist to localStorage and cookie. */
export function applyAccent(a: Accent) {
  document.documentElement.dataset.accent = a;
  try {
    localStorage.setItem(ACCENT_COOKIE, a);
  } catch {}
  document.cookie = `${ACCENT_COOKIE}=${a}; path=/; max-age=31536000; samesite=lax`;
}
