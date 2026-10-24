import { artDataUri, rng } from "./generate";
import { MODELS, type Aspect, type Kind } from "./models";

export type Post = {
  id: string;
  kind: Kind;
  title: string;
  prompt: string;
  model: string;
  aspect: Aspect;
  author: string;
  likes: number;
  remixes: number;
  tags: string[];
  src: string;
  poster: string;
  createdAt: string;
};

export const TAGS = [
  "portrait",
  "cinematic",
  "anime",
  "product",
  "landscape",
  "scifi",
  "fashion",
  "abstract",
] as const;

const PROMPTS: Record<string, string[]> = {
  portrait: [
    "Close-up portrait of an elderly fisherman, weathered skin, soft window light",
    "Girl with freckles and glitter eyeliner, golden hour backlight",
    "Dancer mid-spin in a dusty studio, motion blur, warm tones",
    "Cyberpunk street vendor with holographic apron, rain reflections",
    "Twin sisters in matching vintage dresses, 35mm film",
    "Monk meditating on a cliff edge, misty sunrise",
  ],
  cinematic: [
    "Lone car on an empty desert highway at dusk, anamorphic lens flare",
    "Detective in a neon alley, rain, teal and orange grade",
    "Slow dolly through an abandoned ballroom, dust in sunbeams",
    "Heist crew walking in slow motion past a burning vault",
    "Train crossing a snowy bridge, wide establishing shot",
    "Storm chasers silhouetted against a supercell, epic scale",
  ],
  anime: [
    "Samurai fox in a bamboo forest at dawn, anime key visual",
    "Magical girl summoning a comet, sparkling pastel sky",
    "Rooftop ramen shop on a rainy night, lo-fi anime style",
    "Mecha pilot looking over a flooded city, Ghibli palette",
    "Spirit cat guiding lanterns across a river",
    "Cherry blossom duel between two sword masters",
  ],
  product: [
    "Glass perfume bottle among orchids, studio light",
    "Matte black sneaker floating over a neon grid",
    "Minimal skincare set on wet stone, soft shadows",
    "Chrome headphones on pastel gradient, glossy reflections",
    "Craft coffee bag with steam rising, warm kitchen light",
    "Smartwatch exploded view with glowing components",
  ],
  landscape: [
    "Baroque cathedral made of ice, aurora overhead",
    "Floating islands above a sea of clouds, golden light",
    "Bioluminescent beach at midnight, long exposure",
    "Terraced rice fields in fog, drone view",
    "Volcano and lightning, ash cloud, ultra detailed",
    "Lavender valley with an old stone farmhouse at sunrise",
  ],
  scifi: [
    "Astronaut tending a greenhouse on a red desert planet",
    "Retro-futuristic diner on the moon, 70s film grain",
    "Colossal space station orbiting a ringed gas giant",
    "Android painter in a loft full of canvases, neon sign glow",
    "Alien marketplace under twin suns, bustling crowd",
    "Derelict starship overgrown with glowing moss",
  ],
  fashion: [
    "Streetwear editorial in a fog-filled parking garage, flash",
    "Model in sculptural silver gown on a salt flat",
    "Vintage tailoring campaign, tungsten light, grainy",
    "Neon puffer jacket in a snowstorm, high fashion",
    "Avant-garde headpiece of folded paper, studio backdrop",
    "Runway of mirrors, kaleidoscope reflections",
  ],
  abstract: [
    "Liquid chrome waves frozen in time, iridescent",
    "Fractal garden of glass flowers, macro",
    "Smoke ribbons in complementary colors, black backdrop",
    "Geometric city of translucent cubes, soft gradient fog",
    "Ink drops blooming in water, magenta and teal",
    "Silk folds in a gust of wind, pearlescent",
  ],
};

const AUTHORS = ["luma.k", "pixelwren", "noir.studio", "aya_ai", "mothership", "kiln", "sol_fx", "vantablack", "orbit9", "halcyon"];
const ASPECT_CYCLE: Aspect[] = ["9:16", "1:1", "16:9", "4:3", "9:16", "4:3", "1:1", "16:9"];

function titleOf(p: string) {
  const t = p.split(",")[0].split(" ").slice(0, 4).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function build(): Post[] {
  const r = rng(1337);
  const base = Date.UTC(2026, 5, 1, 12);
  const out: Post[] = [];
  for (let i = 0; i < 48; i++) {
    const tag = TAGS[i % TAGS.length];
    const prompt = PROMPTS[tag][Math.floor(i / TAGS.length)];
    const kind: Kind = r() < 0.28 ? "video" : "image";
    const aspect = kind === "video" ? (i % 2 ? "16:9" : "9:16") : ASPECT_CYCLE[Math.floor(r() * ASPECT_CYCLE.length)];
    const pool = MODELS.filter((m) => m.kind === kind);
    const second = TAGS[(i * 3 + 1) % TAGS.length];
    const id = `p${String(i + 1).padStart(2, "0")}`;
    out.push({
      id,
      kind,
      title: titleOf(prompt),
      prompt,
      model: pool[Math.floor(r() * pool.length)].id,
      aspect,
      author: AUTHORS[Math.floor(r() * AUTHORS.length)],
      likes: 40 + Math.floor(r() * 4800),
      remixes: 5 + Math.floor(r() * 900),
      tags: second === tag ? [tag] : r() < 0.4 ? [tag, second] : [tag],
      src: artDataUri(prompt, aspect, kind === "video"),
      poster: artDataUri(prompt, aspect, false),
      createdAt: new Date(base - i * 3600_000 * 5).toISOString(),
    });
  }
  return out;
}

let cache: Post[] | null = null;
export function getPosts(): Post[] {
  return (cache ??= build());
}
