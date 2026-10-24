"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { BLUR_DATA_URL } from "@/lib/generate";
import { ASPECT_SIZE, type Aspect, type Kind } from "@/lib/models";

/* Only 2 videos may play at once across the whole page. */
const MAX_PLAYING = 2;
const active: { id: symbol; stop: () => void }[] = [];
function claim(id: symbol, stop: () => void) {
  const i = active.findIndex((a) => a.id === id);
  if (i >= 0) active.splice(i, 1);
  active.push({ id, stop });
  while (active.length > MAX_PLAYING) active.shift()?.stop();
}
function release(id: symbol) {
  const i = active.findIndex((a) => a.id === id);
  if (i >= 0) active.splice(i, 1);
}

type Conn = { saveData?: boolean };
const noop = () => () => undefined;

function useMedia(query: string, server: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

/** False for prefers-reduced-motion and data-saver users (and during SSR). */
export function useMotionAllowed() {
  const reduce = useMedia("(prefers-reduced-motion: reduce)", true);
  const saver = useSyncExternalStore(
    noop,
    () => !!(navigator as Navigator & { connection?: Conn }).connection?.saveData,
    () => true,
  );
  return !reduce && !saver;
}

const isLocal = (s: string) => s.startsWith("/");

export type MediaProps = {
  kind: Kind;
  src: string;
  poster?: string;
  aspect: Aspect;
  alt: string;
  blur?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/** Fixed-aspect box: photo via next/image, or poster-first lazy video. */
export function MediaView({ kind, src, poster, aspect, alt, blur, priority = false, sizes, className = "" }: MediaProps) {
  const { w, h } = ASPECT_SIZE[aspect];
  const still = kind === "video" ? (poster ?? src) : src;
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${className}`}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      <Image
        src={still}
        alt={alt}
        fill
        sizes={sizes ?? "(min-width:1024px) 25vw, (min-width:640px) 33vw, 100vw"}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        placeholder="blur"
        blurDataURL={blur ?? BLUR_DATA_URL}
        unoptimized={!isLocal(still)}
        className="object-cover"
      />
      {kind === "video" && <VideoLayer src={src} />}
    </div>
  );
}

/** Video layered above the poster. Nothing downloads until it is first asked to play. */
export function VideoLayer({ src, controlsHint = true }: { src: string; controlsHint?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const id = useRef<symbol>(Symbol("video"));
  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(false);
  const touch = !useMedia("(hover: hover)", true);
  const motion = useMotionAllowed();
  const [tapped, setTapped] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.6), {
      threshold: [0, 0.6],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // hover on desktop, in-view (>60%) on touch; an explicit tap overrides either.
  const auto = motion && (touch ? inView : hover && inView);
  const want = tapped ?? auto;

  // Evicted by a newer player: pause only; resumes when it is asked to play again.
  const stop = useCallback(() => vid.current?.pause(), []);

  if (want && !mounted) setMounted(true);

  useEffect(() => {
    const v = vid.current;
    const me = id.current;
    if (want) {
      if (!v) return;
      claim(me, stop);
      v.play().catch(() => undefined);
    } else {
      v?.pause();
      release(me);
    }
  }, [want, mounted, stop]);

  useEffect(() => {
    const me = id.current;
    return () => release(me);
  }, []);

  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setTapped(null);
      }}
      onClick={() => setTapped(!want)}
    >
      {mounted && (
        <video
          ref={vid}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onPlaying={() => setReady(true)}
          onPause={() => setReady(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {controlsHint && !ready && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <Play size={10} fill="currentColor" /> Video
        </span>
      )}
    </div>
  );
}
