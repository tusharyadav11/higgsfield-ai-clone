/** Pure colour maths + custom accent persistence. Client-only helpers are guarded. */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type HSV = { h: number; s: number; v: number }; // h 0..360, s/v 0..1
export type HSL = { h: number; s: number; l: number }; // h 0..360, s/l 0..1

export const APP_BG = "#08080a";
/** App background in light mode (keep in sync with --bg in globals.css). */
export const LIGHT_BG = "#f6f6f9";
/** Lowest light surface the ink must also read on (--surface-2). */
export const LIGHT_SURFACE_2 = "#ebebf1";
export type Mode = "light" | "dark";
export const bgFor = (mode: Mode) => (mode === "light" ? LIGHT_BG : APP_BG);
export const DARK_FG = "#0a0a0a";
export const LIGHT_FG = "#ffffff";
export const CUSTOM_KEY = "accent-custom";
export const CUSTOM_COOKIE = "accent-custom";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "#abc" | "abc" | "#aabbcc" | "AABBCC" -> "#aabbcc"; anything else -> null. */
export function normalizeHex(input: string): string | null {
  if (typeof input !== "string") return null;
  const m = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(m)) return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(m)) return `#${m}`.toLowerCase();
  return null;
}

export function hexToRgb(hex: string): RGB | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return { r: parseInt(n.slice(1, 3), 16), g: parseInt(n.slice(3, 5), 16), b: parseInt(n.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s, 0, 1), V = clamp(v, 0, 1);
  const c = V * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = V - c;
  let r = 0, g = 0, b = 0;
  if (H < 60) [r, g, b] = [c, x, 0];
  else if (H < 120) [r, g, b] = [x, c, 0];
  else if (H < 180) [r, g, b] = [0, c, x];
  else if (H < 240) [r, g, b] = [0, x, c];
  else if (H < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: rgbToHsv({ r, g, b }).h, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const S = clamp(s, 0, 1), L = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const v = L + c / 2;
  return hsvToRgb({ h, s: v === 0 ? 0 : (2 * (v - L)) / v, v });
}

export const hexToHsv = (hex: string): HSV | null => {
  const rgb = hexToRgb(hex);
  return rgb && rgbToHsv(rgb);
};
export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv));
export const hexToHsl = (hex: string): HSL | null => {
  const rgb = hexToRgb(hex);
  return rgb && rgbToHsl(rgb);
};
export const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/** WCAG contrast ratio, 1..21. Invalid input is treated as black. */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text colour with the higher contrast on `hex`. */
export function readableOn(hex: string): "#0a0a0a" | "#ffffff" {
  return contrast(hex, DARK_FG) >= contrast(hex, LIGHT_FG) ? DARK_FG : LIGHT_FG;
}

/**
 * Nudges lightness (hue/saturation kept) until the colour reaches `min`:1 against the app background of `mode`:
 * lighter on dark, darker on light.
 */
export function ensureUsableAccent(hex: string, min = 3, mode: Mode = "dark"): string {
  const n = normalizeHex(hex);
  if (!n) return "#c6ff3d";
  const bg = bgFor(mode);
  const ok = (c: string) => contrast(c, bg) >= min && (mode === "dark" || contrast(c, LIGHT_SURFACE_2) >= min * 0.93);
  if (ok(n)) return n;
  const hsl = rgbToHsl(hexToRgb(n)!);
  const dir = mode === "dark" ? 1 : -1;
  for (let i = 0; i <= 100; i++) {
    const l = clamp(hsl.l + dir * (i / 100), 0, 1);
    const out = hslToHex({ ...hsl, l });
    if (ok(out)) return out;
  }
  return mode === "dark" ? "#ffffff" : "#000000";
}

/** Accent used for TEXT/icons ("ink"): >= 5.5:1 on dark, >= 4.6:1 on light surfaces. */
export function accentTextColour(hex: string, mode: Mode = "dark"): string {
  const n = normalizeHex(hex) ?? "#c6ff3d";
  return ensureUsableAccent(n, mode === "dark" ? 5.5 : 4.9, mode);
}

/* ---------------- custom accent persistence (client only) ---------------- */

export function loadCustomAccent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) {
      const hex = normalizeHex((JSON.parse(raw) as { hex?: string }).hex ?? "");
      if (hex) return hex;
    }
  } catch {}
  try {
    const m = document.cookie.match(/(?:^|; )accent-custom=([0-9a-fA-F]{6})/);
    if (m) return normalizeHex(m[1]);
  } catch {}
  return null;
}

/** Paint only (no persistence): used for live preview while dragging. */
export function previewCustomAccent(hex: string): string | null {
  const n = normalizeHex(hex);
  if (typeof document === "undefined" || !n) return null;
  const el = document.documentElement;
  el.dataset.accent = "custom";
  el.style.setProperty("--accent", n);
  el.style.setProperty("--accent-fg", readableOn(n));
  el.style.setProperty("--accent-text-d", accentTextColour(n, "dark"));
  el.style.setProperty("--accent-text-l", accentTextColour(n, "light"));
  return n;
}

/** Apply + persist (localStorage + cookie). Returns the normalised hex or null if invalid. */
export function applyCustomAccent(hex: string): string | null {
  const n = previewCustomAccent(hex);
  if (!n) return null;
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ hex: n }));
  } catch {}
  try {
    document.cookie = `${CUSTOM_COOKIE}=${n.slice(1)}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
  return n;
}

/** Remove inline props and persisted custom colour. Caller sets a named data-accent afterwards. */
export function clearCustomAccent() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.removeProperty("--accent");
  el.style.removeProperty("--accent-fg");
  el.style.removeProperty("--accent-text-d");
  el.style.removeProperty("--accent-text-l");
  if (el.dataset.accent === "custom") delete el.dataset.accent;
  try {
    localStorage.removeItem(CUSTOM_KEY);
  } catch {}
  try {
    document.cookie = `${CUSTOM_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {}
}

/**
 * Self-contained JS (no imports) for the layout's inline <script>. Run it AFTER the named-accent boot
 * code: if a custom accent is saved it overrides data-accent and sets --accent/--accent-fg. Never throws.
 */
export const ACCENT_BOOT_SNIPPET = `(function(){try{var h=null;try{var r=localStorage.getItem("accent-custom");if(r){h=JSON.parse(r).hex}}catch(e){}if(!h){var m=document.cookie.match(/(?:^|; )accent-custom=([0-9a-fA-F]{6})/);if(m)h="#"+m[1]}if(!h||!/^#[0-9a-fA-F]{6}$/.test(h))return;h=h.toLowerCase();function lin(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}function lum(a){return 0.2126*lin(a[0])+0.7152*lin(a[1])+0.0722*lin(a[2])}function px(x){return[1,3,5].map(function(i){return parseInt(x.substr(i,2),16)})}function hx(a){return"#"+a.map(function(v){return("0"+Math.round(v).toString(16)).slice(-2)}).join("")}function cr(a,b){var p=lum(px(a)),q=lum(px(b));return(Math.max(p,q)+0.05)/(Math.min(p,q)+0.05)}function hsl(a){var R=a[0]/255,G=a[1]/255,B=a[2]/255,x=Math.max(R,G,B),n=Math.min(R,G,B),d=x-n,l=(x+n)/2,s=d===0?0:d/(1-Math.abs(2*l-1)),H=0;if(d!==0){H=x===R?((G-B)/d)%6:x===G?(B-R)/d+2:(R-G)/d+4;H*=60;if(H<0)H+=360}return[H,s,l]}function rgb(H,S,L){var c=(1-Math.abs(2*L-1))*S,v=L+c/2,s=v===0?0:2*(v-L)/v,C=v*s,X=C*(1-Math.abs((H/60)%2-1)),m=v-C,t=H<60?[C,X,0]:H<120?[X,C,0]:H<180?[0,C,X]:H<240?[0,X,C]:H<300?[X,0,C]:[C,0,X];return t.map(function(u){return(u+m)*255})}function ink(min,bg,dir,b2){function ok(c){return cr(c,bg)>=min&&(!b2||cr(c,b2)>=min*0.93)}if(ok(h))return h;var q=hsl(px(h));for(var i=0;i<=100;i++){var o=hx(rgb(q[0],q[1],Math.min(1,Math.max(0,q[2]+dir*i/100))));if(ok(o))return o}return dir>0?"#ffffff":"#000000"}var e=document.documentElement;e.dataset.accent="custom";e.style.setProperty("--accent",h);e.style.setProperty("--accent-fg",(lum(px(h))+0.05)/0.053035>=1.05/(lum(px(h))+0.05)?"#0a0a0a":"#ffffff");e.style.setProperty("--accent-text-d",ink(5.5,"#08080a",1));e.style.setProperty("--accent-text-l",ink(4.9,"#f6f6f9",-1,"#ebebf1"))}catch(x){}})();`;
