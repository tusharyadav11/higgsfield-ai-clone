import { ACTIONS, ARTICLES, PAGES, SUGGESTIONS, TOOLS } from "./kb";
import { scoreAny } from "./fuzzy";

export type AssistLink = { label: string; href?: string; run?: "tour" | "tour-video" | "first-video" | "claim" };
export type AssistReply = { text: string; links: AssistLink[] };

const STOP = new Set(["the", "a", "an", "to", "do", "i", "how", "where", "is", "can", "my", "me", "what", "of", "in", "on", "for", "and", "it", "get", "find", "need", "want", "please", "you"]);

/** Deterministic, offline intent matcher over the KB. */
export function localAnswer(question: string): AssistReply {
  const q = question.toLowerCase().trim();
  const links: AssistLink[] = [];
  if (/(how (it|this|kinetic) works|show me how|demo|overview|watch)/.test(q) && !/(make|create|generate|first)/.test(q)) {
    return { text: "Here is a 60-second video that shows how Kinetic works. You can jump to any chapter.", links: [{ label: "Watch tour", run: "tour-video" }, { label: "Take the interactive tour", run: "tour" }] };
  }
  if (/\b(tour|tutorial|walk ?through|show me around|onboard)/.test(q) && !/video/.test(q)) {
    return { text: "Happy to show you around. The tour takes about 30 seconds and I will move the cursor for you.", links: [{ label: "Start the tour", run: "tour" }] };
  }
  if (/video/.test(q) && /(first|make|create|how|start|generate)/.test(q)) {
    return {
      text: "Making a video takes four steps: open Create, describe what you want (or press Surprise me), pick a video model such as Kling Fast, then press Generate. I can do the first steps with you.",
      links: [{ label: "Show me, step by step", run: "first-video" }, { label: "Take me to Create", href: "/create?model=kling-fast" }],
    };
  }
  if (/(claim|daily|streak|free credit|bonus)/.test(q)) {
    return { text: "Claim your daily credits on Home: press the streak card's claim button once per day to add credits and grow your streak.", links: [{ label: "Take me there", run: "claim" }] };
  }
  const words = q.split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  const needle = words.join(" ");
  if (!needle) return fallback();
  const cands: { s: number; kind: "article" | "page" | "tool" | "action"; i: number }[] = [];
  ARTICLES.forEach((a, i) => cands.push({ s: scoreAny(needle, [a.title, ...a.keywords]) + words.filter((w) => a.keywords.includes(w) || a.title.toLowerCase().includes(w)).length * 15, kind: "article", i }));
  PAGES.forEach((p, i) => cands.push({ s: scoreAny(needle, [p.title, ...p.keywords]) + words.filter((w) => p.keywords.includes(w) || p.title.toLowerCase() === w).length * 15, kind: "page", i }));
  TOOLS.forEach((p, i) => cands.push({ s: scoreAny(needle, [p.title, ...p.keywords]) + words.filter((w) => p.keywords.includes(w)).length * 12, kind: "tool", i }));
  ACTIONS.forEach((a, i) => cands.push({ s: scoreAny(needle, [a.title, ...a.keywords]) * 0.8, kind: "action", i }));
  cands.sort((a, b) => b.s - a.s);
  const top = cands[0];
  if (!top || top.s < 15) return fallback();
  let text = "";
  const add = (label: string, href?: string) => {
    if (href && !links.some((l) => l.href === href)) links.push({ label, href });
  };
  if (top.kind === "article") {
    const a = ARTICLES[top.i];
    text = a.body;
    if (a.href) add("Take me there", a.href);
  } else if (top.kind === "page") {
    const p = PAGES[top.i];
    text = `${p.title}: ${p.blurb}`;
    add("Take me there", p.href);
  } else if (top.kind === "tool") {
    const p = TOOLS[top.i];
    text = `${p.title}: ${p.blurb}`;
    add("Take me there", p.href);
  } else {
    const a = ACTIONS[top.i];
    text = `${a.title}: ${a.blurb}`;
    if (a.href) add("Take me there", a.href);
    else if (a.run === "tour" || a.run === "tour-video" || a.run === "first-video" || a.run === "claim") links.push({ label: "Do it with me", run: a.run });
  }
  return { text, links: links.slice(0, 3) };
}

function fallback(): AssistReply {
  return {
    text: "I am not sure about that one. Try one of these, or take the 30-second tour. Kinetic has Home, Create, Explore, Library and Pricing.",
    links: [{ label: "Start the tour", run: "tour" }, { label: "Open Create", href: "/create" }],
  };
}

export { SUGGESTIONS };
