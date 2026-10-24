import { getPosts, type Post } from "./seed";

export type FeedResult = { items: Post[]; nextCursor: string | null };
const memo = new Map<string, FeedResult>();

/** Throws RangeError on a malformed cursor. */
export function queryFeed(tag: string, cursor: string | null, limit: number): FeedResult {
  let offset = 0;
  if (cursor !== null && cursor !== "") {
    if (!/^\d{1,6}$/.test(cursor)) throw new RangeError("bad cursor");
    offset = Number(cursor);
  }
  const key = `${tag}|${offset}|${limit}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const all = tag ? getPosts().filter((p) => p.tags.includes(tag)) : getPosts();
  const items = all.slice(offset, offset + limit);
  const next = offset + limit;
  const res = { items, nextCursor: next < all.length ? String(next) : null };
  memo.set(key, res);
  return res;
}
