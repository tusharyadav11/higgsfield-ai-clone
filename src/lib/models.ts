export type Kind = "image" | "video";
export type Aspect = "1:1" | "16:9" | "9:16" | "4:3";
export type Model = {
  id: string;
  name: string;
  kind: Kind;
  credits: number;
  speed: "fast" | "balanced" | "quality";
};

export const MODELS: Model[] = [
  { id: "flux-lite", name: "Flux Lite", kind: "image", credits: 2, speed: "fast" },
  { id: "soul-v2", name: "Soul v2", kind: "image", credits: 3, speed: "balanced" },
  { id: "imagen-pro", name: "Imagen Pro", kind: "image", credits: 4, speed: "quality" },
  { id: "kling-fast", name: "Kling Fast", kind: "video", credits: 10, speed: "fast" },
  { id: "veo-lite", name: "Veo Lite", kind: "video", credits: 15, speed: "balanced" },
  { id: "sora-max", name: "Sora Max", kind: "video", credits: 20, speed: "quality" },
];

export const ASPECTS: Aspect[] = ["1:1", "16:9", "9:16", "4:3"];

export const getModel = (id: string | null | undefined) =>
  MODELS.find((m) => m.id === id);

export const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  "1:1": { w: 512, h: 512 },
  "16:9": { w: 640, h: 360 },
  "9:16": { w: 360, h: 640 },
  "4:3": { w: 640, h: 480 },
};

export const SURPRISE_PROMPTS = [
  "A neon-lit koi pond floating above a rainy Tokyo skyline, cinematic",
  "Astronaut tending a greenhouse on a red desert planet, golden hour",
  "Macro shot of a glass perfume bottle surrounded by orchids, studio light",
  "Baroque cathedral made of ice, aurora overhead, ultra detailed",
  "Retro-futuristic diner on the moon, 70s film grain",
  "Samurai fox in a bamboo forest at dawn, anime key visual",
  "Liquid chrome waves frozen in time, abstract iridescent",
  "Streetwear editorial in a fog-filled parking garage, flash photography",
];
