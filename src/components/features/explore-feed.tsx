"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

  const chips = useRef<Record<string, HTMLButtonElement | null>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number } | null>(null);
  const [edge, setEdge] = useState({ l: 0, r: 1 });
  const measure = useCallback(() => {
    const b = chips.current[tag];
    const sc = scroller.current;
    if (b) setPill({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth });
    if (sc) setEdge({ l: sc.scrollLeft > 4 ? 1 : 0, r: sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4 ? 1 : 0 });
  }, [tag]);
  useLayoutEffect(() => {
    measure();
    const b = chips.current[tag];
    const sc = scroller.current;
    if (b && sc) sc.scrollTo({ left: b.offsetLeft - (sc.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tag, measure]);

  const first = state.items.length === 0 && !state.done && !state.error;

  return (
    <div>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-5 border-b border-line/60 bg-bg/70 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div
          ref={scroller}
          onScroll={measure}
          className="scrollbar-none overflow-x-auto"
          style={{
            maskImage: `linear-gradient(90deg, transparent, #000 calc(${edge.l} * 28px), #000 calc(100% - ${edge.r} * 28px), transparent)`,
          }}
        >
          <div className="relative flex w-max gap-1 sm:w-auto sm:flex-wrap">
            {pill && (
              <span
                aria-hidden
                className="absolute left-0 top-0 h-11 rounded-full bg-accent shadow-[0_6px_22px_-8px_var(--glow)] transition-[transform,width] duration-300 ease-[cubic-bezier(.3,1.3,.5,1)]"
                style={{ width: pill.w, transform: `translate(${pill.x}px, ${pill.y}px)` }}
              />
            )}
            {TAGS.map((t) => (
              <button
                key={t}
                ref={(el) => {
                  chips.current[t] = el;
                }}
                type="button"
                data-testid={`tag-chip-${t}`}
                aria-pressed={tag === t}
                onClick={() => {
                  if (t === tag) return;
                  setState({ tag: t, items: [], next: null, done: false, error: false });
                  setTag(t);
                }}
                className={`relative min-h-11 shrink-0 rounded-full px-4 text-sm font-medium capitalize transition-[color,transform] duration-200 active:scale-95 ${
                  tag === t ? "text-accent-fg" : "text-muted hover:text-fg"
                } ${tag === t && !pill ? "bg-accent" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
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
