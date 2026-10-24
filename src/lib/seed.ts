import { rng } from "./generate";
import { PHOTOS, VIDEOS, motionFor } from "./media-library";
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
  /** Tiny base64 placeholder for next/image blurDataURL (additive field). */
  blur?: string;
  /** Short cinematic loop (mp4) for image posts; poster is the original photo (additive field). */
  motion?: string;
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

// [kind, media id, title, tags, prompt]; every prompt describes what the real local photo/video shows.
const ENTRIES: [("i" | "v"), string, string, string[], string][] = [
  ["i", "01", "Glass Pyramid", ["scifi", "abstract"], "Looking up at a faceted glass-and-steel pyramid tower, symmetrical futuristic architecture, cold pale sky"],
  ["i", "08", "Continental", ["product", "cinematic"], "Front of a classic mint-green 1960s Lincoln Continental, chrome grille, bright street, shallow focus"],
  ["i", "17", "Brick Lane", ["cinematic"], "Narrow city alley between brick buildings with a lone cyclist, soft overcast light, street photography"],
  ["v", "aurora-neon", "Neon Aurora", ["abstract", "scifi"], "Neon aurora ribbons drifting through darkness, cyan and magenta light, slow motion loop"],
  ["i", "24", "Rail Yard Dusk", ["scifi", "cinematic"], "Converging rail tracks toward a glowing industrial skyline at dusk, purple haze"],
  ["i", "32", "Curved Concrete", ["abstract", "fashion"], "Sweeping curved concrete and terracotta facade against a mint sky, minimalist architecture"],
  ["i", "40", "Peloton Blur", ["cinematic"], "Cyclists in a motion-blurred black-and-white peloton, panning shot"],
  ["v", "v-ember", "Ember Rise", ["cinematic", "abstract"], "Vertical molten ember glow rising in the dark, orange and crimson light leaks, slow motion"],
  ["i", "07", "Last Tram Home", ["cinematic"], "Empty vintage tram interior, shallow depth of field, warm amber light down the aisle"],
  ["i", "16", "Balloon over Palms", ["landscape", "cinematic"], "Hot-air balloon rising over a palm oasis at dawn, hazy desert horizon, vintage film tones"],
  ["i", "23", "Misty Lake Pines", ["landscape"], "Pine forest on a glassy lake at dawn, low fog, pastel sky"],
  ["v", "ocean-silk", "Deep Current", ["landscape", "abstract"], "Bioluminescent ocean currents swirling in the deep, teal glow, smooth loop"],
  ["i", "31", "Tunnel Exit", ["portrait", "cinematic"], "Three silhouettes at a bright tunnel opening, high contrast, cinematic backlight"],
  ["i", "38", "Cliff Light", ["landscape", "cinematic"], "Sunlit rock spire and a fir tree above a hazy valley, warm backlight, epic vista"],
  ["i", "06", "Grand Terminal", ["cinematic"], "Long exposure of a grand train station concourse, ghosted commuters, light pouring through tall windows"],
  ["v", "violet-nebula", "Violet Nebula", ["scifi", "abstract"], "Violet nebula clouds breathing in deep space, pink starlight, cinematic loop"],
  ["i", "14", "Bird at Dusk", ["anime", "cinematic"], "Lone bird crossing an apricot storm sky, billowing sunset clouds, anime key visual"],
  ["i", "22", "Cloud Study", ["landscape", "abstract"], "Dramatic black-and-white clouds above layered hills, high contrast film look"],
  ["i", "30", "Calm Sunset Sea", ["landscape"], "Mirror-flat sea at sunset, peach-to-blue gradient sky, faint distant coastline"],
  ["v", "v-neon", "Neon Smoke", ["scifi", "cinematic"], "Vertical neon smoke ribbons in a cyberpunk night, cyan and magenta, slow drift"],
  ["i", "37", "Ski Lift Dawn", ["landscape", "cinematic"], "Empty ski lift cables above a sea of clouds, chalet silhouette, blue-hour sky"],
  ["i", "05", "Wave Macro", ["abstract"], "Macro of a glassy blue ocean wave about to curl, deep cobalt gradient, ultra clean"],
  ["i", "13", "Headland Road", ["landscape"], "Winding road over a green coastal headland above a turquoise bay, drone view"],
  ["v", "sunset-haze", "Golden Haze", ["cinematic"], "Golden hour haze over a magenta horizon, soft cinematic atmosphere"],
  ["i", "21", "Canal Light", ["cinematic", "landscape"], "Narrow canal between towering brick warehouses, glowing haze at the end, small boat"],
  ["i", "28", "Coast Rails", ["cinematic"], "Railroad tracks running straight along a sunlit coastal bluff, pastel sky, vanishing point"],
  ["i", "36", "Drift", ["fashion", "portrait"], "Overhead shot of two people lying on a white boat drifting on deep teal water"],
  ["v", "rose-gold", "Rose Gold Silk", ["fashion", "abstract"], "Liquid rose-gold silk flowing softly, luxury fashion backdrop, warm glow"],
  ["i", "04", "Shoreline Blues", ["landscape"], "Beach shoreline with rolling surf, deep blue ocean under soft clouds, wide angle"],
  ["i", "12", "Sparkler Hands", ["portrait", "anime"], "Hands holding a blazing sparkler in the dark, warm bokeh sparks, Shinkai-style glow"],
  ["i", "20", "Boots and Denim", ["fashion", "portrait"], "Editorial crop of a woman in a beige jacket, slim jeans and ankle boots perched on a stool"],
  ["v", "lime-pulse", "Reactor Pulse", ["scifi"], "Toxic lime energy pulses inside a dark reactor core, glowing teal veins"],
  ["i", "27", "Curl", ["abstract", "landscape"], "Turquoise ocean wave curling under stormy clouds, frozen mid-break"],
  ["i", "35", "Blue Ridges", ["anime", "landscape"], "Layered misty blue mountain ridges fading into haze, Ghibli-style atmospheric perspective"],
  ["i", "03", "Alpine Lake Silence", ["landscape"], "Snow-dusted alpine summit above a still dark lake, teal haze, minimalist landscape photo"],
  ["v", "v-ocean", "Midnight Tide", ["landscape", "abstract"], "Vertical deep-ocean light bands swaying at midnight, teal and aqua"],
  ["i", "10", "Desk Minimal", ["product"], "Silver laptop on a white minimalist desk, bright high-key product shot, soft shadows"],
  ["i", "19", "Bus Blur", ["cinematic"], "City street at golden hour, red double-decker and motion-blurred taxi, long shutter"],
  ["i", "26", "Interchange", ["scifi", "abstract"], "Top-down aerial of a looping highway interchange beside a turquoise bay"],
  ["v", "ice-glass", "Ice Glass", ["abstract"], "Frozen glass shards of light refracting through ice, cold blue shimmer"],
  ["i", "34", "Alps Blue Hour", ["landscape"], "Snow-streaked rocky alpine ridge under deep blue sky and cumulus clouds"],
  ["i", "02", "Storm Peak Sunrise", ["landscape", "cinematic"], "Jagged mountain peak wrapped in storm clouds above a dark pine forest, warm golden light, epic scale"],
  ["i", "09", "Overgrown Rails", ["landscape", "cinematic"], "Abandoned railway vanishing into a green forest tunnel, symmetrical one-point perspective"],
  ["v", "ember-flow", "Ember Flow", ["abstract", "cinematic"], "Molten ember silk flowing in slow motion, orange and crimson glow"],
  ["i", "18", "Cafe Work Table", ["product"], "Open laptop on a wooden cafe table beside a glass of water, warm bokeh background"],
  ["i", "25", "Rangefinder", ["product"], "Silver Fujifilm rangefinder camera with a red shutter button, dark moody product shot"],
  ["i", "33", "Above the Clouds", ["landscape", "scifi"], "Sea of clouds from above at sunrise, a tiny aircraft speck, dreamy pastel"],
  ["v", "v-violet", "Violet Reel", ["anime", "fashion"], "Vertical violet and pink light leak for fashion reels, dreamy haze, pastel anime glow"],
];

const AUTHORS = ["luma.k", "pixelwren", "noir.studio", "aya_ai", "mothership", "kiln", "sol_fx", "vantablack", "orbit9", "halcyon"];

function build(): Post[] {
  const r = rng(1337);
  const base = Date.UTC(2026, 5, 1, 12);
  return ENTRIES.map(([k, mid, title, tags, prompt], i) => {
    const kind: Kind = k === "v" ? "video" : "image";
    const pool = MODELS.filter((m) => m.kind === kind);
    const model = pool[Math.floor(r() * pool.length)].id;
    const author = AUTHORS[Math.floor(r() * AUTHORS.length)];
    const likes = 40 + Math.floor(r() * 4800);
    const remixes = 5 + Math.floor(r() * 900);
    const asset = k === "v" ? VIDEOS.find((v) => v.id === mid)! : PHOTOS.find((p) => p.id === `ph-${mid}`)!;
    return {
      id: `p${String(i + 1).padStart(2, "0")}`,
      kind,
      title,
      prompt,
      model,
      aspect: asset.aspect,
      author,
      likes,
      remixes,
      tags,
      src: asset.src,
      poster: "poster" in asset ? (asset as { poster: string }).poster : asset.src,
      blur: asset.blur,
      ...(k === "i" && motionFor(asset.src) ? { motion: motionFor(asset.src) } : {}),
      createdAt: new Date(base - i * 3600_000 * 5).toISOString(),
    };
  });
}

let cache: Post[] | null = null;
export function getPosts(): Post[] {
  return (cache ??= build());
}
