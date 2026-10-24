// Static knowledge base: single source of truth for search, tour copy and the assistant.
export type KbPage = { id: string; title: string; href: string; blurb: string; keywords: string[] };
export type KbAction = {
  id: string;
  title: string;
  blurb: string;
  href?: string;
  run?: "tour" | "first-video" | "assistant" | "claim" | "shortcuts" | "invite";
  keywords: string[];
};
export type KbArticle = { id: string; title: string; body: string; href?: string; keywords: string[] };

export const PAGES: KbPage[] = [
  { id: "home", title: "Home", href: "/", blurb: "Trending, daily streak, tools and models.", keywords: ["start", "main", "dashboard", "streak", "trending"] },
  { id: "create", title: "Create", href: "/create", blurb: "The studio: write a prompt, pick a model, generate.", keywords: ["generate", "make", "studio", "image", "video", "prompt", "new"] },
  { id: "explore", title: "Explore", href: "/explore", blurb: "Community feed. Find ideas and remix them.", keywords: ["community", "feed", "inspiration", "ideas", "browse", "remix"] },
  { id: "library", title: "Library", href: "/library", blurb: "Everything you generated, saved on this device.", keywords: ["saved", "history", "my", "creations", "gallery", "delete", "download"] },
  { id: "pricing", title: "Pricing", href: "/pricing", blurb: "Plans (Free, Pro, Studio) and credit costs.", keywords: ["plans", "upgrade", "credits", "cost", "pay", "buy", "subscription"] },
];

export const TOOLS: KbPage[] = [
  { id: "surprise", title: "Surprise me", href: "/create", blurb: "One click fills a random great prompt and model.", keywords: ["random", "idea", "stuck", "inspire"] },
  { id: "remix", title: "Remix", href: "/explore", blurb: "Reuse any community prompt as your starting point.", keywords: ["copy", "reuse", "prompt", "community"] },
  { id: "accent", title: "Accent colours", href: "/", blurb: "Switch the app palette: Lime, Violet, Ember, Ocean.", keywords: ["theme", "color", "colour", "palette", "dark"] },
  { id: "aspect", title: "Aspect ratios", href: "/create", blurb: "1:1, 16:9, 9:16 and 4:3 framing for your result.", keywords: ["size", "ratio", "square", "vertical", "wide", "format"] },
];

export const ACTIONS: KbAction[] = [
  { id: "gen-image", title: "Generate an image", blurb: "Open the studio with image mode on.", href: "/create", keywords: ["make", "create", "picture", "photo", "art"] },
  { id: "gen-video", title: "Make my first video", blurb: "Guided walkthrough that fills the prompt for you.", run: "first-video", keywords: ["video", "first", "guide", "walkthrough", "clip", "movie"] },
  { id: "claim", title: "Claim daily credits", blurb: "Go home and collect today's credits and streak.", run: "claim", keywords: ["streak", "free", "bonus", "daily", "credits"] },
  { id: "invite", title: "Invite a friend", blurb: "Share Kinetic and earn bragging rights.", run: "invite", keywords: ["share", "referral", "friend", "link"] },
  { id: "claude", title: "Connect to Claude", blurb: "Use the assistant to get help, or open claude.ai.", run: "assistant", keywords: ["ai", "chat", "anthropic", "assistant", "help"] },
  { id: "tour", title: "Take the product tour", blurb: "30-second guided tour with a moving cursor.", run: "tour", keywords: ["tutorial", "onboarding", "learn", "help", "how"] },
  { id: "shortcuts", title: "Keyboard shortcuts", blurb: "See every shortcut.", run: "shortcuts", keywords: ["keys", "hotkeys", "cmd", "ctrl"] },
];

export const ARTICLES: KbArticle[] = [
  { id: "a-first", title: "How to make your first image or video", href: "/create", body: "Go to Create, type what you want to see (or press Surprise me), choose Image or Video, pick a model and press Generate. Results are saved to your Library.", keywords: ["first", "start", "begin", "how", "generate", "make", "new"] },
  { id: "a-prompt", title: "Writing a good prompt", href: "/create", body: "Describe subject, setting, light and style in one sentence, e.g. 'a fox in neon rain, cinematic, 35mm'. Short and specific beats long and vague. Remix a community prompt if you are stuck.", keywords: ["prompt", "write", "tips", "better", "describe"] },
  { id: "a-credits", title: "How credits work", href: "/pricing", body: "Free accounts start with 50 credits. Images cost 2 to 4, videos 10 to 20 depending on model. Claim daily credits on Home to keep your streak. Out of credits? See Pricing.", keywords: ["credits", "cost", "free", "streak", "daily", "cheap", "money"] },
  { id: "a-models", title: "Which model should I pick?", href: "/create", body: "Fast models (Flux Lite, Kling Fast) are cheapest for trying ideas. Quality models (Imagen Pro, Sora Max) cost more and look best. Video models make clips, image models make stills.", keywords: ["model", "which", "best", "fast", "quality", "difference"] },
  { id: "a-remix", title: "Remixing community posts", href: "/explore", body: "On Explore or Trending press Remix on any card. Create opens with that prompt and model filled in, ready to tweak and generate.", keywords: ["remix", "copy", "reuse", "community", "explore"] },
  { id: "a-library", title: "Finding and deleting your creations", href: "/library", body: "Everything you generate lives in Library on this device. You can re-run or delete items there. Nothing is uploaded to an account.", keywords: ["library", "saved", "find", "delete", "history", "download"] },
  { id: "a-privacy", title: "Is my data saved online?", body: "No sign-up needed. Credits, streak and library are stored locally in your browser, so clearing site data resets them.", keywords: ["privacy", "data", "account", "login", "signup", "storage"] },
];

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl/⌘", "K"], label: "Open search" },
  { keys: ["/"], label: "Open search (when not typing)" },
  { keys: ["↑", "↓"], label: "Move through results" },
  { keys: ["Enter"], label: "Open selected result" },
  { keys: ["Esc"], label: "Close search, assistant, menus or tour" },
  { keys: ["←", "→"], label: "Back / Next during the tour" },
];

export const WHATS_NEW = [
  "Command palette: search pages, models, prompts and help with Ctrl/⌘ K.",
  "Interactive tour with a guided cursor and a 'make my first video' flow.",
  "Built-in assistant that answers 'where is…' and 'how do I…'.",
  "Daily streak and credit claim, plus four accent palettes.",
];

export const SUGGESTIONS = [
  "How do I make my first video?",
  "Where do I claim free credits?",
  "Which model is best?",
  "Where are my creations?",
];

/** Compact KB text for the LLM system prompt. */
export function kbPrompt(): string {
  return [
    "You are Kinetic's in-app guide for an AI image/video creation studio. Users are beginners.",
    "Answer in at most 4 short sentences, plain language, no markdown headings. Only use facts below; if unsure, say so and point to the nearest page.",
    "Pages:",
    ...PAGES.map((p) => `- ${p.title} (${p.href}): ${p.blurb}`),
    "Features:",
    ...TOOLS.map((p) => `- ${p.title}: ${p.blurb}`),
    "Help:",
    ...ARTICLES.map((a) => `- ${a.title}: ${a.body}`),
    "There is also a 30-second product tour; offer it when users seem lost.",
  ].join("\n");
}
