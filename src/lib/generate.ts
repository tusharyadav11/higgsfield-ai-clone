import { ASPECT_SIZE, type Aspect, type Kind } from "./models";

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Deterministic generated art as an SVG data URI (zero network). */
export function artDataUri(
  seed: string,
  aspect: Aspect = "1:1",
  animated = false,
): string {
  const { w, h } = ASPECT_SIZE[aspect];
  const r = rng(hash(seed));
  const h1 = Math.floor(r() * 360);
  const h2 = (h1 + 40 + Math.floor(r() * 140)) % 360;
  const h3 = (h2 + 60 + Math.floor(r() * 120)) % 360;
  const hues = [h1, h2, h3];
  let blobs = "";
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = Math.round(r() * w);
    const cy = Math.round(r() * h);
    const rad = Math.round((0.2 + r() * 0.4) * Math.max(w, h));
    const anim = animated
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;${Math.round((r() - 0.5) * 80)} ${Math.round((r() - 0.5) * 80)};0 0" dur="${(4 + r() * 4).toFixed(1)}s" repeatCount="indefinite"/>`
      : "";
    blobs += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#g${i % 3})" opacity="${(0.55 + r() * 0.4).toFixed(2)}">${anim}</circle>`;
  }
  let rings = "";
  const cx = Math.round(w * (0.3 + r() * 0.4));
  const cy = Math.round(h * (0.3 + r() * 0.4));
  for (let i = 1; i <= 4; i++) {
    rings += `<circle cx="${cx}" cy="${cy}" r="${i * Math.round(Math.min(w, h) * 0.09)}" fill="none" stroke="hsl(${h3} 90% 85%)" stroke-opacity="${(0.35 - i * 0.07).toFixed(2)}" stroke-width="1.5"/>`;
  }
  const defs = hues
    .map(
      (hu, i) =>
        `<radialGradient id="g${i}"><stop offset="0" stop-color="hsl(${hu} 90% 62%)"/><stop offset="1" stop-color="hsl(${hu} 90% 40%)" stop-opacity="0"/></radialGradient>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 60% 12%)"/><stop offset="1" stop-color="hsl(${h2} 65% 20%)"/></linearGradient>${defs}</defs><rect width="${w}" height="${h}" fill="url(#bg)"/>${blobs}${rings}</svg>`;
  return uri(svg);
}

export const BLUR_DATA_URL = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#1a1a22"/></svg>`,
);

export type GenerateInput = {
  kind: Kind;
  model: string;
  prompt: string;
  aspect: Aspect;
};

export type Generation = GenerateInput & {
  id: string;
  url: string;
  createdAt: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mock(input: GenerateInput): Promise<string> {
  await sleep(1200 + Math.random() * 1300);
  return artDataUri(
    `${input.prompt}|${input.model}`,
    input.aspect,
    input.kind === "video",
  );
}

async function fal(input: GenerateInput): Promise<string | null> {
  if (input.kind !== "image") return null;
  const size: Record<Aspect, string> = {
    "1:1": "square_hd",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:3": "landscape_4_3",
  };
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: input.prompt, image_size: size[input.aspect] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { images?: { url?: string }[] };
  return data.images?.[0]?.url ?? null;
}

export async function generate(input: GenerateInput): Promise<Generation> {
  let url: string | null = null;
  if (process.env.FAL_KEY) {
    try {
      url = await fal(input);
    } catch {
      url = null;
    }
  }
  if (!url) url = await mock(input);
  return {
    id: `gen_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    url,
    kind: input.kind,
    prompt: input.prompt,
    model: input.model,
    aspect: input.aspect,
    createdAt: new Date().toISOString(),
  };
}
