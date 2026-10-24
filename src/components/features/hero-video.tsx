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

  return (
    <section ref={box} className="relative isolate overflow-hidden rounded-3xl border border-line bg-surface">
      <Image
        src={HERO_VIDEO.poster}
        alt=""
        fill
        priority
        sizes="(min-width:1280px) 1200px, 100vw"
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
          preload="metadata"
          aria-hidden
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
      <div className="relative max-w-xl px-6 py-14 sm:px-10 sm:py-24">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-bg/60 px-3 py-1 text-xs text-muted backdrop-blur">
          <Sparkles size={12} className="text-accent" /> Every model. One studio.
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-6xl">See it. Remix it. Make it yours.</h1>
        <p className="mt-4 text-base text-fg/80">
          Generate images and video from the best models, or remix what the community is making right now.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-7 text-sm font-semibold text-accent-fg"
          >
            Start creating
          </Link>
          <Link
            href="/explore"
            className="inline-flex min-h-12 items-center rounded-full border border-line bg-bg/60 px-7 text-sm text-fg backdrop-blur"
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
      <h2 id="showcase-h" className="mb-3 text-lg font-semibold text-fg">From prompt to picture</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            href={remixHref(p)}
            prefetch={false}
            className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface-2"
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
