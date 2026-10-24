"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFeedPage } from "@/lib/feed-cache";
import type { Post } from "@/lib/seed";
import { PostCard, PostCardSkeleton } from "./post-card";

const TAGS = ["all", "portrait", "cinematic", "anime", "product", "landscape", "scifi", "fashion", "abstract"];
const RATIOS = ["3 / 4", "1 / 1", "9 / 16", "4 / 3", "3 / 4", "16 / 9"];

export function ExploreFeed() {
  const [tag, setTag] = useState("all");
  const [state, setState] = useState<{ tag: string; items: Post[]; next: string | null; done: boolean; error: boolean }>({
    tag: "all",
    items: [],
    next: null,
    done: false,
    error: false,
  });
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const cur = useRef(state);
  useEffect(() => {
    cur.current = state;
  });

  const loadMore = useCallback(async (t: string, reset: boolean) => {
    if (loading.current && !reset) return;
    loading.current = true;
    const cursor = reset ? null : cur.current.next;
    try {
      const page = await fetchFeedPage(t === "all" ? "" : t, cursor, 12);
      setState((s) => {
        if (s.tag !== t) return s;
        const base = reset ? [] : s.items;
        return { ...s, items: [...base, ...page.items], next: page.nextCursor, done: page.nextCursor === null, error: false };
      });
    } catch {
      setState((s) => (s.tag === t ? { ...s, error: true } : s));
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void loadMore(tag, true);
  }, [tag, loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const s = cur.current;
        if (e.isIntersecting && s.tag === tag && s.next && !s.done) void loadMore(tag, false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tag, loadMore, state.next]);

  const first = state.items.length === 0 && !state.done && !state.error;

  return (
    <div>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`tag-chip-${t}`}
            aria-pressed={tag === t}
            onClick={() => {
              if (t === tag) return;
              setState({ tag: t, items: [], next: null, done: false, error: false });
              setTag(t);
            }}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm capitalize transition-colors ${
              tag === t ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {state.items.map((p, i) => (
          <PostCard key={p.id} post={p} priority={i < 2} />
        ))}
        {first && RATIOS.map((r, i) => <PostCardSkeleton key={i} ratio={r} />)}
      </div>
      {state.done && state.items.length === 0 && (
        <p className="py-16 text-center text-muted">Nothing here yet.</p>
      )}
      {state.error && (
        <div className="py-8 text-center">
          <p className="mb-3 text-muted">Could not load the feed.</p>
          <button
            type="button"
            onClick={() => void loadMore(tag, state.items.length === 0)}
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Retry
          </button>
        </div>
      )}
      <div ref={sentinel} className="h-10" aria-hidden />
      {state.done && state.items.length > 0 && (
        <p className="py-6 text-center text-xs text-muted">You have seen it all. Go create something.</p>
      )}
    </div>
  );
}
