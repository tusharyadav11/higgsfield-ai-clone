/** Tiny fuzzy scorer: higher is better, 0 means no match. */
export function score(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const idx = t.indexOf(q);
  if (idx >= 0) return idx === 0 || /\W/.test(t[idx - 1]) ? 70 : 55;
  // all words present
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => t.includes(w))) return 50;
  // subsequence
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      if (last >= 0 && j - last > 1) gaps++;
      last = j;
      i++;
    }
  }
  if (i === q.length && q.length >= 2) return Math.max(5, 30 - gaps * 4);
  return 0;
}

export function scoreAny(query: string, texts: string[]): number {
  let best = 0;
  texts.forEach((t, i) => {
    const s = score(query, t) * (i === 0 ? 1 : 0.8);
    if (s > best) best = s;
  });
  return best;
}
