"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMotionAllowed } from "./media-view";
import { Sparkles, Wand2 } from "lucide-react";
import { HERO_VIDEO } from "@/lib/media-library";
import { remixHref } from "./post-card";
import type { Post } from "@/lib/seed";

/** Home hero: priority poster (LCP) + muted looping video that only starts when allowed and visible. */
export function HeroVideo() {
  const box = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const allowed = useMotionAllowed();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    const v = vid.current;
    if (!allowed || !el || !v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => undefined);
      else v.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [allowed]);

  const words = ["See", "it.", "Remix", "it.", "Make", "it", "yours."];
  return (
    <section
      ref={box}
      className="relative isolate flex h-full min-h-[30rem] items-end overflow-hidden rounded-[1.75rem] border border-line bg-surface sm:min-h-[34rem]"
    >
      <Image
        src={HERO_VIDEO.poster}
        alt=""
        fill
        priority
        sizes="(min-width:1280px) 800px, (min-width:1024px) 62vw, 100vw"
        placeholder="blur"
        blurDataURL={HERO_VIDEO.blur}
        className="object-cover"
      />
      {allowed && (
        <video
          ref={vid}
          src={HERO_VIDEO.src}
          poster={HERO_VIDEO.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          aria-hidden
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-transparent" />
      <div className="relative w-full max-w-2xl px-5 pb-8 pt-24 sm:px-10 sm:pb-12">
        <p className="fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-medium text-fg/90 backdrop-blur-md">
          <Sparkles size={12} className="text-accent" /> Every model. One studio.
        </p>
        <h1 className="text-[2.6rem] font-bold leading-[1.02] tracking-tighter text-fg min-[400px]:text-5xl sm:text-7xl">
          {words.map((w, i) => (
            <span key={i}>
              <span className="kw" style={{ "--i": i } as React.CSSProperties}>
                <span className={i >= 4 ? "text-shine" : ""}>{w}</span>
              </span>
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>
        <p className="fade-up mt-5 max-w-md text-base text-fg/80 sm:text-lg" style={{ "--d": 6 } as React.CSSProperties}>
          Generate images and video from the best models, or remix what the community is making right now.
        </p>
        <div className="fade-up mt-7 flex flex-wrap gap-3" style={{ "--d": 7 } as React.CSSProperties}>
          <Link
            href="/create"
            className="btn-glow inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-accent-fg"
          >
            <Wand2 size={16} /> Start creating
          </Link>
          <Link
            href="/explore"
            className="inline-flex min-h-12 items-center rounded-full border border-white/20 bg-white/5 px-7 text-sm font-medium text-fg backdrop-blur-md transition-[background-color,transform,border-color] hover:border-accent hover:bg-white/10 active:scale-95"
          >
            Explore
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Prompt -> result showcase: three still photos with the prompt that "made" them. */
export function Showcase({ posts }: { posts: Post[] }) {
  return (
    <section aria-labelledby="showcase-h">
      <h2 id="showcase-h" className="mb-3 text-xl font-semibold text-fg">From prompt to picture</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            href={remixHref(p)}
            prefetch={false}
            data-spot
            className="spot lift group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface-2"
          >
            <Image
              src={p.poster}
              alt={p.title}
              fill
              sizes="(min-width:640px) 33vw, 100vw"
              placeholder="blur"
              blurDataURL={p.blur}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
              <p className="line-clamp-2 text-xs text-white/90">&ldquo;{p.prompt}&rdquo;</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                <Wand2 size={12} /> Remix this
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
