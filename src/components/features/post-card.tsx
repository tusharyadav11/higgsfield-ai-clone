"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Heart, Play, Wand2 } from "lucide-react";
import { BLUR_DATA_URL } from "@/lib/generate";
import { ASPECT_SIZE } from "@/lib/models";
import type { Post } from "@/lib/seed";
import { useStore } from "@/lib/store";

export function remixHref(p: Pick<Post, "id" | "prompt" | "model">) {
  const qs = new URLSearchParams({ remix: p.id, prompt: p.prompt, model: p.model });
  return `/create?${qs}`;
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function PostCard({ post, priority = false }: { post: Post; priority?: boolean }) {
  const router = useRouter();
  const liked = useStore((s) => !!s.likes[post.id]);
  const like = useStore((s) => s.like);
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hover, setHover] = useState(false);
  const { w, h } = ASPECT_SIZE[post.aspect];
  const isVideo = post.kind === "video";
  const playing = isVideo && (inView || hover);

  useEffect(() => {
    if (!isVideo || !box.current) return;
    const el = box.current;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.6), {
      threshold: [0, 0.6],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [isVideo]);

  return (
    <article
      data-testid="feed-card"
      className="group mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div
        ref={box}
        className="relative overflow-hidden bg-surface-2"
        style={{ aspectRatio: `${w} / ${h}` }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Image
          src={post.poster}
          alt={post.title}
          width={w}
          height={h}
          loading={priority ? "eager" : "lazy"}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          unoptimized
          className="h-full w-full object-cover"
        />
        {isVideo && (
          <>
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-0"
              preload="none"
              muted
              playsInline
              loop
              poster={post.poster}
              aria-hidden
            />
            {playing && (
              <Image
                src={post.src}
                alt=""
                width={w}
                height={h}
                unoptimized
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              <Play size={10} fill="currentColor" /> Video
            </span>
          </>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-fg">{post.title}</h3>
          <span className="shrink-0 text-xs text-muted">@{post.author}</span>
        </div>
        <p className="line-clamp-2 text-xs text-muted">{post.prompt}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="like-btn"
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            onClick={() => like(post.id)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs text-muted transition-colors hover:text-fg active:scale-95"
          >
            <Heart size={16} className={liked ? "fill-accent text-accent" : ""} />
            <span suppressHydrationWarning>{fmt(post.likes + (liked ? 1 : 0))}</span>
          </button>
          <Link
            href={remixHref(post)}
            prefetch={false}
            data-testid="remix-btn"
            onMouseEnter={() => router.prefetch("/create")}
            onFocus={() => router.prefetch("/create")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg transition-transform active:scale-95"
          >
            <Wand2 size={14} /> Remix
            <span className="opacity-70">{fmt(post.remixes)}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PostCardSkeleton({ ratio = "3 / 4" }: { ratio?: string }) {
  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="animate-pulse bg-surface-2" style={{ aspectRatio: ratio }} />
      <div className="space-y-2 p-3">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-9" />
      </div>
    </div>
  );
}
