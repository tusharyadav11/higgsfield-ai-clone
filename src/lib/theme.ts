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

/* ---------------- light / dark / system mode ---------------- */

export const THEMES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";
export const DEFAULT_THEME: ThemeMode = "dark";
export const THEME_KEY = "theme";
export const THEME_COLOR: Record<ResolvedTheme, string> = { dark: "#08080a", light: "#f6f6f9" };

export function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/** Inline boot script (no imports): sets data-theme / data-theme-mode, theme-color and color-scheme metas before first paint. */
export const THEME_BOOT_SNIPPET = `(function(){try{var m=null;try{m=localStorage.getItem("${THEME_KEY}")}catch(e){}if(m!=="light"&&m!=="dark"&&m!=="system")m="${DEFAULT_THEME}";var r=m==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):m;var d=document.documentElement;d.dataset.theme=r;d.dataset.themeMode=m;var h=document.head;function mk(n,v){var e=h.querySelector('meta[name="'+n+'"]');if(!e){e=document.createElement("meta");e.name=n;h.appendChild(e)}e.content=v}mk("theme-color",r==="light"?"${THEME_COLOR.light}":"${THEME_COLOR.dark}");mk("color-scheme",r)}catch(e){}})();`;

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return mode;
}

export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (isThemeMode(v)) return v;
  } catch {}
  return DEFAULT_THEME;
}

/** Client only: paint a mode (no persistence). `fade` adds a short-lived crossfade class. */
export function paintTheme(mode: ThemeMode, fade = false) {
  const root = document.documentElement;
  const r = resolveTheme(mode);
  const changed = root.dataset.theme !== r;
  if (fade && changed && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-fade");
    window.setTimeout(() => root.classList.remove("theme-fade"), 520);
  }
  root.dataset.theme = r;
  root.dataset.themeMode = mode;
  for (const [n, v] of [["theme-color", THEME_COLOR[r]], ["color-scheme", r]] as const) {
    let e = document.head.querySelector<HTMLMetaElement>(`meta[name="${n}"]`);
    if (!e) {
      e = document.createElement("meta");
      e.name = n;
      document.head.appendChild(e);
    }
    e.content = v;
  }
}

/** Client only: apply + persist. */
export function applyTheme(mode: ThemeMode) {
  paintTheme(mode, true);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {}
}
