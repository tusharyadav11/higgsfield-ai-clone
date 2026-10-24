// Pure helpers for the product-tour video player (chapters + seek logic). No DOM, storage or clock.
export type Chapter = { start: number; end: number; title: string };

export const TOUR_VIDEO = {
  src: "/media/tour/kinetic-tour.mp4",
  poster: "/media/tour/kinetic-tour.jpg",
  captions: "/media/tour/kinetic-tour.vtt",
  chapters: "/media/tour/chapters.vtt",
  watchedKey: "kinetic.tour.video.watched",
} as const;

/** Fallback used until (or if) chapters.vtt cannot be fetched. Regenerate by re-recording; the VTT wins when present. */
export const FALLBACK_CHAPTERS: Chapter[] = [
  { start: 0, end: 9, title: "Welcome" },
  { start: 9, end: 17, title: "Search" },
  { start: 17, end: 27, title: "Explore" },
  { start: 27, end: 45, title: "Create" },
  { start: 45, end: 51, title: "Result" },
  { start: 51, end: 57, title: "Library & usage" },
  { start: 57, end: 64, title: "Make it yours" },
  { start: 64, end: 72, title: "Connect to Claude" },
];

/** "00:01:02.500" or "01:02.500" -> seconds; NaN when malformed. */
export function parseTimestamp(t: string): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(t.trim());
  if (!m) return NaN;
  const ms = m[4] ? Number(m[4].padEnd(3, "0")) : 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000;
}

/** Parses a WebVTT chapters file; skips malformed cues; result sorted by start. */
export function parseChaptersVtt(vtt: string): Chapter[] {
  const out: Chapter[] = [];
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->").map((x) => x.trim().split(/\s+/)[0]);
    const start = parseTimestamp(a);
    const end = parseTimestamp(b);
    const title = lines.slice(i + 1).join(" ").trim();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start || !title) continue;
    out.push({ start, end, title });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Index of the chapter containing `time` (the last one whose start <= time); -1 when there are none. */
export function activeChapter(chapters: Chapter[], time: number): number {
  let idx = -1;
  for (let i = 0; i < chapters.length; i++) if (time + 0.001 >= chapters[i].start) idx = i;
  return idx;
}

/** Clamp a seek target into [0, duration]. Unknown/invalid duration only clamps at 0. */
export function clampSeek(time: number, duration: number): number {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  return Number.isFinite(duration) && duration > 0 ? Math.min(t, duration) : t;
}

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
