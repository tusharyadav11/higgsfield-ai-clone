import { describe, it, expect } from "vitest";
import {
  normalizeHex, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, hexToHsv, hsvToHex, hexToHsl, hslToHex,
  contrast, readableOn, ensureUsableAccent, accentTextColour, ACCENT_BOOT_SNIPPET, APP_BG, LIGHT_BG, LIGHT_SURFACE_2,
} from "@/lib/color";
import { THEME_BOOT_SNIPPET } from "@/lib/theme";
import { readFileSync } from "node:fs";

describe("hex parsing", () => {
  it("normalises 3/6 digit with or without #", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("f0a")).toBe("#ff00aa");
    expect(normalizeHex("  #C6FF3D ")).toBe("#c6ff3d");
    expect(normalizeHex("c6ff3d")).toBe("#c6ff3d");
  });
  it("rejects invalid", () => {
    for (const bad of ["", "#", "#ff", "#ffff", "#fffff", "#fffffff", "gggggg", "#12345g", "rgb(0,0,0)"]) expect(normalizeHex(bad)).toBeNull();
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToHsv("zz")).toBeNull();
    expect(hexToHsl("zz")).toBeNull();
  });
});

describe("conversions", () => {
  it("known values", () => {
    expect(hexToRgb("#ff00aa")).toEqual({ r: 255, g: 0, b: 170 });
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe("#ff0080");
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv({ r: 0, g: 0, b: 255 }).h).toBe(240);
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 1 });
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });
  it("greys have zero saturation", () => {
    for (const g of [0, 17, 128, 255]) {
      expect(rgbToHsv({ r: g, g, b: g }).s).toBe(0);
      expect(rgbToHsl({ r: g, g, b: g }).s).toBe(0);
    }
  });
  it("hue wraps", () => {
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ h: -120, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
  });
  it("round-trips within +-1 for a colour sweep", () => {
    for (let r = 0; r < 256; r += 15)
      for (let g = 0; g < 256; g += 15)
        for (let b = 0; b < 256; b += 15) {
          const rgb = { r, g, b };
          for (const back of [hsvToRgb(rgbToHsv(rgb)), hslToRgb(rgbToHsl(rgb))]) {
            expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
            expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
            expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
          }
        }
    expect(hsvToHex(hexToHsv("#a78bfa")!)).toBe("#a78bfa");
    expect(hslToHex(hexToHsl("#3ab8ff")!)).toBe("#3ab8ff");
  });
});

describe("contrast", () => {
  it("extremes", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrast("#fff", "#fff")).toBeCloseTo(1, 5);
    expect(contrast("#777", "#fff")).toBeCloseTo(contrast("#fff", "#777"), 10);
  });
  it("readableOn picks higher contrast", () => {
    expect(readableOn("#ffffff")).toBe("#0a0a0a");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#c6ff3d")).toBe("#0a0a0a");
    expect(readableOn("#7c3aed")).toBe("#ffffff");
    expect(readableOn("#808080")).toBe("#0a0a0a");
  });
  it("all presets keep AA with their chosen text", () => {
    for (const h of ["#c6ff3d", "#a78bfa", "#ff7a2f", "#3ab8ff"]) expect(contrast(h, readableOn(h))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ensureUsableAccent", () => {
  it("leaves good colours alone", () => {
    expect(ensureUsableAccent("#c6ff3d")).toBe("#c6ff3d");
    expect(ensureUsableAccent("FFF")).toBe("#ffffff");
  });
  it("lifts near-background colours to >= 3:1", () => {
    for (const h of ["#000000", "#080808", "#111111", "#0a0020"]) {
      const out = ensureUsableAccent(h);
      expect(contrast(out, APP_BG)).toBeGreaterThanOrEqual(3);
      expect(out).not.toBe(h);
    }
  });
  it("keeps hue when nudging", () => {
    const out = ensureUsableAccent("#1a0033");
    const a = hexToHsl("#1a0033")!, b = hexToHsl(out)!;
    expect(Math.abs(a.h - b.h)).toBeLessThan(6);
  });
  it("invalid falls back to lime", () => {
    expect(ensureUsableAccent("nope")).toBe("#c6ff3d");
  });
});

describe("boot snippet", () => {
  const run = (store: Record<string, string> | "throw", cookie = "") => {
    const style: Record<string, string> = {};
    const el = { dataset: {} as Record<string, string>, style: { setProperty: (k: string, v: string) => (style[k] = v) } };
    const localStorage = {
      getItem: (k: string) => {
        if (store === "throw") throw new Error("blocked");
        return store[k] ?? null;
      },
    };
    new Function("localStorage", "document", ACCENT_BOOT_SNIPPET)(localStorage, { cookie, documentElement: el });
    return { el, style };
  };
  it("restores from localStorage", () => {
    const { el, style } = run({ "accent-custom": JSON.stringify({ hex: "#ff00aa" }) });
    expect(el.dataset.accent).toBe("custom");
    expect(style["--accent"]).toBe("#ff00aa");
    expect(style["--accent-fg"]).toBe(readableOn("#ff00aa"));
    expect(style["--accent-text-d"]).toBe(accentTextColour("#ff00aa", "dark"));
    expect(style["--accent-text-l"]).toBe(accentTextColour("#ff00aa", "light"));
  });
  it("derives the same dark and light inks as accentTextColour for a spread of colours", () => {
    for (const hex of ["#c6ff3d", "#ffffff", "#000000", "#ffd400", "#1a0033", "#3ab8ff", "#ff4fa3", "#808080", "#7c3aed"]) {
      const { style } = run({ "accent-custom": JSON.stringify({ hex }) });
      expect(style["--accent-text-d"]).toBe(accentTextColour(hex, "dark"));
      expect(style["--accent-text-l"]).toBe(accentTextColour(hex, "light"));
    }
  });
  it("falls back to cookie when storage throws", () => {
    const { style } = run("throw", "a=1; accent-custom=3ab8ff");
    expect(style["--accent"]).toBe("#3ab8ff");
  });
  it("is a no-op / never throws on junk", () => {
    expect(run({}).el.dataset.accent).toBeUndefined();
    expect(run({ "accent-custom": "{not json" }).el.dataset.accent).toBeUndefined();
    expect(run({ "accent-custom": JSON.stringify({ hex: "red" }) }).el.dataset.accent).toBeUndefined();
  });
  it("agrees with readableOn for every grey step", () => {
    for (let g = 0; g < 256; g += 5) {
      const hex = rgbToHex({ r: g, g, b: g });
      expect(run({ "accent-custom": JSON.stringify({ hex }) }).style["--accent-fg"]).toBe(readableOn(hex));
    }
  });
});

describe("theme-aware accent", () => {
  const samples = ["#c6ff3d", "#ffff00", "#ffffff", "#a78bfa", "#ff7a2f", "#3ab8ff", "#000000", "#111111", "#7c3aed", "#34e5a0", "#ffc83d", "#1a0033", "#ff4fa3"];
  it("light mode darkens pale accents to >= 3:1 on the light background, keeping hue", () => {
    for (const h of samples) {
      const out = ensureUsableAccent(h, 3, "light");
      expect(contrast(out, LIGHT_BG), h).toBeGreaterThanOrEqual(3);
    }
    const a = hexToHsl("#c6ff3d")!, b = hexToHsl(ensureUsableAccent("#c6ff3d", 3, "light"))!;
    expect(Math.abs(a.h - b.h)).toBeLessThan(8);
    expect(ensureUsableAccent("#c6ff3d", 3, "light")).not.toBe("#c6ff3d");
  });
  it("dark mode is unchanged by the mode parameter default", () => {
    for (const h of samples) expect(ensureUsableAccent(h)).toBe(ensureUsableAccent(h, 3, "dark"));
  });
  it("accent ink reads on its theme: >= 5.5 dark, >= 4.5 on bg and surface-2 in light", () => {
    for (const h of samples) {
      expect(contrast(accentTextColour(h, "dark"), APP_BG), h).toBeGreaterThanOrEqual(5.5);
      const l = accentTextColour(h, "light");
      expect(contrast(l, LIGHT_BG), h).toBeGreaterThanOrEqual(4.5);
      expect(contrast(l, LIGHT_SURFACE_2), h).toBeGreaterThanOrEqual(4.5);
      expect(contrast(l, "#ffffff"), h).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("text-on-accent is AA for any accent", () => {
    for (const h of samples) expect(contrast(h, readableOn(h)), h).toBeGreaterThanOrEqual(4.5);
  });
});

describe("globals.css palette", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = (sel: string) => css.match(new RegExp(sel.replace(/[[\]()".]/g, "\\$&") + "\\s*\\{([^}]*)\\}"))?.[1] ?? "";
  const tok = (b: string, n: string) => b.match(new RegExp("--" + n + ":\\s*(#[0-9a-fA-F]{6})"))?.[1];
  const light = block(':root[data-theme="light"]');
  it("light tokens meet AA", () => {
    const bg = tok(light, "bg")!, surface = tok(light, "surface")!, s2 = tok(light, "surface-2")!, fg = tok(light, "fg")!, muted = tok(light, "muted")!, line = tok(light, "line")!;
    expect(bg).toBe(LIGHT_BG);
    expect(s2).toBe(LIGHT_SURFACE_2);
    for (const base of [bg, surface, s2]) {
      expect(contrast(fg, base)).toBeGreaterThanOrEqual(7);
      expect(contrast(muted, base)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(line, bg)).toBeGreaterThanOrEqual(1.4);
    for (const n of ["danger", "success", "warn", "earn"]) for (const base of [bg, surface, s2]) expect(contrast(tok(light, n)!, base), n).toBeGreaterThanOrEqual(4.5);
  });
  it("named palettes: fills carry AA text and the light ink reads on light surfaces", () => {
    for (const n of ["lime", "violet", "ember", "ocean"]) {
      const dark = block(`:root[data-accent="${n}"]`);
      const lt = block(`:root[data-theme="light"][data-accent="${n}"]`);
      for (const b of [dark, lt]) {
        const acc = tok(b, "accent") ?? tok(dark, "accent")!, fg = tok(b, "accent-fg") ?? tok(dark, "accent-fg")!;
        expect(contrast(acc, fg), n).toBeGreaterThanOrEqual(4.5);
      }
      const ink = tok(lt, "accent-text")!;
      for (const base of [LIGHT_BG, "#ffffff", LIGHT_SURFACE_2]) expect(contrast(ink, base), n).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tok(dark, "accent")!, APP_BG)).toBeGreaterThanOrEqual(5.5);
    }
  });
});

describe("theme boot snippet", () => {
  const run = (stored: string | null | "throw", lightPref: boolean) => {
    const attrs: Record<string, string> = {};
    const els: Record<string, { name: string; content: string }> = {};
    const doc = {
      documentElement: { dataset: attrs },
      head: {
        querySelector: (q: string) => els[q.match(/name="([^"]+)"/)![1]] ?? null,
        appendChild: (e: { name: string; content: string }) => { els[e.name] = e; },
      },
      createElement: () => ({ name: "", content: "" }),
    };
    const ls = { getItem: () => { if (stored === "throw") throw new Error("x"); return stored; } };
    const win = { matchMedia: (q: string) => ({ matches: lightPref && q.includes("light") }) };
    new Function("localStorage", "document", "window", "matchMedia", THEME_BOOT_SNIPPET)(ls, doc, win, win.matchMedia);
    const metas = Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.content]));
    return { attrs, metas };
  };
  it("defaults to dark", () => {
    expect(run(null, true).attrs).toMatchObject({ theme: "dark", themeMode: "dark" });
    expect(run("throw", true).attrs.theme).toBe("dark");
    expect(run("junk", true).attrs.theme).toBe("dark");
  });
  it("restores light/dark and resolves system", () => {
    expect(run("light", false).attrs).toMatchObject({ theme: "light", themeMode: "light" });
    expect(run("dark", true).attrs.theme).toBe("dark");
    expect(run("system", true).attrs).toMatchObject({ theme: "light", themeMode: "system" });
    expect(run("system", false).attrs.theme).toBe("dark");
  });
  it("sets theme-color and color-scheme", () => {
    const { metas } = run("light", false);
    expect(metas["theme-color"]).toBe(LIGHT_BG);
    expect(metas["color-scheme"]).toBe("light");
  });
});
