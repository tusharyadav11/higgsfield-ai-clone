import Link from "next/link";
import { Clapperboard, ImageIcon, Wand2, UserRound, Shirt, Box } from "lucide-react";
import { MODELS } from "@/lib/models";

const TOOLS = [
  { icon: ImageIcon, name: "Text to image", d: "Prompt in, art out in seconds.", href: "/create" },
  { icon: Clapperboard, name: "Text to video", d: "Short cinematic clips.", href: "/create?model=kling-fast" },
  { icon: Wand2, name: "Remix", d: "Start from a community prompt.", href: "/explore" },
  { icon: UserRound, name: "Portraits", d: "Studio-grade faces.", href: "/create?prompt=Studio%20portrait%2C%20soft%20window%20light" },
  { icon: Shirt, name: "Fashion", d: "Editorial looks.", href: "/create?prompt=Streetwear%20editorial%2C%20flash%20photography" },
  { icon: Box, name: "Product shots", d: "Hero shots, no studio.", href: "/create?prompt=Glass%20perfume%20bottle%2C%20studio%20light" },
];

export function ToolsGrid() {
  return (
    <section aria-labelledby="tools-h" className="flex h-full flex-col">
      <h2 id="tools-h" className="mb-3 text-xl font-semibold text-fg">Tools</h2>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {TOOLS.map(({ icon: Icon, name, d, href }) => (
          <Link key={name} href={href} data-spot
            data-tilt
            className="spot spot-fill group relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-accent/12 text-accent-text transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
              <Icon size={20} />
            </span>
            <p className="text-sm font-medium text-fg">{name}</p>
            <p className="mt-1 text-xs text-muted">{d}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ModelsStrip() {
  return (
    <section aria-labelledby="models-h">
      <h2 id="models-h" className="mb-3 text-xl font-semibold text-fg">Models</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {MODELS.map((m) => (
          <Link key={m.id} href={`/create?model=${m.id}`} data-spot
            className="spot lift shrink-0 rounded-2xl border border-line bg-surface/90 px-5 py-3">
            <p className="text-sm font-medium text-fg">{m.name}</p>
            <p className="text-xs capitalize text-muted">{m.kind} · {m.speed} · {m.credits} cr</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Trending prompts marquee. Pure CSS; pauses on hover/focus; every item remixes on click. */
export function PromptTicker({ items }: { items: { id: string; prompt: string; model: string; remixes: number }[] }) {
  const href = (p: { id: string; prompt: string; model: string }) => `/create?${new URLSearchParams({ remix: p.id, prompt: p.prompt, model: p.model })}`;
  const row = (hidden: boolean) =>
    items.map((p) => (
      <Link
        key={`${hidden}-${p.id}`}
        href={href(p)}
        prefetch={false}
        tabIndex={hidden ? -1 : undefined}
        className="group inline-flex min-h-11 max-w-[22rem] shrink-0 items-center gap-2 rounded-full border border-line bg-surface/80 py-2 pl-3 pr-4 text-sm text-fg/90 transition-[border-color,background-color,transform] hover:border-accent hover:bg-surface-2 active:scale-95"
      >
        <Wand2 size={14} className="shrink-0 text-accent-text transition-transform group-hover:rotate-12" />
        <span className="truncate">{p.prompt}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted">{p.remixes.toLocaleString("en-US")}</span>
      </Link>
    ));
  return (
    <div className="marquee" aria-label="Trending prompts: click one to remix it">
      <div className="marquee-track py-1">
        {row(false)}
        <div className="contents" aria-hidden>
          {row(true)}
        </div>
      </div>
    </div>
  );
}
