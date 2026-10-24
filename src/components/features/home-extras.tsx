import Link from "next/link";
import Image from "next/image";
import { Clapperboard, ImageIcon, Wand2, UserRound, Shirt, Box, Sparkles } from "lucide-react";
import { artDataUri } from "@/lib/generate";
import { MODELS } from "@/lib/models";

const TOOLS = [
  { icon: ImageIcon, name: "Text to image", d: "Prompt in, art out in seconds.", href: "/create" },
  { icon: Clapperboard, name: "Text to video", d: "Short cinematic clips.", href: "/create?model=kling-fast" },
  { icon: Wand2, name: "Remix", d: "Start from a community prompt.", href: "/explore" },
  { icon: UserRound, name: "Portraits", d: "Studio-grade faces.", href: "/create?prompt=Studio%20portrait%2C%20soft%20window%20light" },
  { icon: Shirt, name: "Fashion", d: "Editorial looks.", href: "/create?prompt=Streetwear%20editorial%2C%20flash%20photography" },
  { icon: Box, name: "Product shots", d: "Hero shots, no studio.", href: "/create?prompt=Glass%20perfume%20bottle%2C%20studio%20light" },
];

export function Hero() {
  const art = artDataUri("kinetic-hero", "16:9");
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface">
      <Image src={art} alt="" width={640} height={360} priority unoptimized className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
      <div className="relative max-w-xl px-6 py-14 sm:px-10 sm:py-20">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-bg/60 px-3 py-1 text-xs text-muted">
          <Sparkles size={12} className="text-accent" /> Every model. One studio.
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">See it. Remix it. Make it yours.</h1>
        <p className="mt-4 text-muted">Generate images and video from the best models, or remix what the community is making right now.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/create" className="inline-flex min-h-12 items-center rounded-full bg-accent px-7 text-sm font-semibold text-accent-fg">Start creating</Link>
          <Link href="/explore" className="inline-flex min-h-12 items-center rounded-full border border-line bg-bg/60 px-7 text-sm text-fg">Explore</Link>
        </div>
      </div>
    </section>
  );
}

export function ToolsGrid() {
  return (
    <section aria-labelledby="tools-h">
      <h2 id="tools-h" className="mb-3 text-lg font-semibold text-fg">Tools</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TOOLS.map(({ icon: Icon, name, d, href }) => (
          <Link key={name} href={href} className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent">
            <Icon size={20} className="mb-3 text-accent" />
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
      <h2 id="models-h" className="mb-3 text-lg font-semibold text-fg">Models</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {MODELS.map((m) => (
          <Link key={m.id} href={`/create?model=${m.id}`} className="shrink-0 rounded-2xl border border-line bg-surface px-5 py-3 hover:border-accent">
            <p className="text-sm font-medium text-fg">{m.name}</p>
            <p className="text-xs capitalize text-muted">{m.kind} · {m.speed} · {m.credits} cr</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
