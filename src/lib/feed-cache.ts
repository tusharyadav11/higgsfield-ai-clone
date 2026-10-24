import type { Post } from "./seed";

export type FeedPage = { items: Post[]; nextCursor: string | null };
const cache = new Map<string, FeedPage>();
const inflight = new Map<string, Promise<FeedPage>>();

/** Client-side in-memory cache of /api/feed pages. */
export function fetchFeedPage(tag: string, cursor: string | null, limit = 12): Promise<FeedPage> {
  const key = `${tag}|${cursor ?? ""}|${limit}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const qs = new URLSearchParams({ limit: String(limit) });
  if (tag) qs.set("tag", tag);
  if (cursor) qs.set("cursor", cursor);
  const p = fetch(`/api/feed?${qs}`)
    .then((r) => {
      if (!r.ok) throw new Error(`feed ${r.status}`);
      return r.json() as Promise<FeedPage>;
    })
    .then((d) => {
      cache.set(key, d);
      return d;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
