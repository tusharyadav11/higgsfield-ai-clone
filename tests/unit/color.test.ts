import { describe, it, expect } from "vitest";
import {
  normalizeHex, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, hexToHsv, hsvToHex, hexToHsl, hslToHex,
  contrast, readableOn, ensureUsableAccent, ACCENT_BOOT_SNIPPET, APP_BG,
} from "@/lib/color";

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
