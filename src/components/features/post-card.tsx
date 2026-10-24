"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Wand2 } from "lucide-react";
import type { Post } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { MediaView } from "./media-view";

export function remixHref(p: Pick<Post, "id" | "prompt" | "model">) {
  const qs = new URLSearchParams({ remix: p.id, prompt: p.prompt, model: p.model });
  return `/create?${qs}`;
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { dx: `${Math.round(Math.cos(a) * 20)}px`, dy: `${Math.round(Math.sin(a) * 20)}px` };
});

export function PostCard({ post, priority = false }: { post: Post; priority?: boolean }) {
  const router = useRouter();
  const liked = useStore((s) => !!s.likes[post.id]);
  const like = useStore((s) => s.like);
  // bumps on each like (not unlike) to replay the heart burst
  const [burst, setBurst] = useState(0);
  return (
    <article
      data-testid="feed-card"
      data-spot
      className="spot lift group mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <MediaView
        kind={post.kind}
        src={post.src}
        poster={post.poster}
        aspect={post.aspect}
        alt={post.title}
        blur={post.blur}
        priority={priority}
        className="[&_img]:transition-transform [&_img]:duration-700 [&_img]:ease-out group-hover:[&_img]:scale-[1.04]"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] translate-y-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-14 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-3 text-xs leading-relaxed text-white/90">&ldquo;{post.prompt}&rdquo;</p>
          <Link
            href={remixHref(post)}
            prefetch={false}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-auto mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-fg btn-glow"
          >
            <Wand2 size={13} /> Remix this
          </Link>
        </div>
      </MediaView>
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
            onClick={() => {
              if (!liked) setBurst((b) => b + 1);
              like(post.id);
            }}
            className="relative inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs text-muted transition-[color,transform] hover:text-fg active:scale-90"
          >
            <span className="relative grid place-items-center">
              <Heart
                key={liked ? "on" : "off"}
                size={16}
                className={liked ? "heart-pop fill-accent text-accent drop-shadow-[0_0_6px_var(--accent)]" : ""}
              />
              {burst > 0 && liked && (
                <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
                  {SPARKS.map((s, i) => (
                    <i
                      key={i}
                      className="absolute left-1/2 top-1/2 size-1 rounded-full bg-accent"
                      style={{ "--dx": s.dx, "--dy": s.dy, animation: "spark 0.6s ease-out forwards" } as React.CSSProperties}
                    />
                  ))}
                </span>
              )}
            </span>
            <span suppressHydrationWarning>{fmt(post.likes + (liked ? 1 : 0))}</span>
          </button>
          <Link
            href={remixHref(post)}
            prefetch={false}
            data-testid="remix-btn"
            onMouseEnter={() => router.prefetch("/create")}
            onFocus={() => router.prefetch("/create")}
            className="btn-glow inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg"
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
    <div aria-hidden className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="skeleton" style={{ aspectRatio: ratio }} />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3.5 w-2/3 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="flex h-11 items-center justify-between">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}
