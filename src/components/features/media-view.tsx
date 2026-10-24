"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { BLUR_DATA_URL, hash } from "@/lib/generate";
import { motionFor } from "@/lib/media-library";
import { ASPECT_SIZE, type Aspect, type Kind } from "@/lib/models";
import { createSlotManager } from "@/lib/playback-slots";
import "./motion.css";

type Conn = { saveData?: boolean; effectiveType?: string };
const conn = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: Conn }).connection);
const isLite = (c: Conn | undefined) => !!c && (!!c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType ?? ""));

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

export type MotionMode = "full" | "kb" | "none";

/**
 * full: play the video loop. kb: Save-Data / slow network, poster-only with a CSS Ken-Burns drift.
 * none: prefers-reduced-motion, no motion at all.
 */
export function useMotionMode(): MotionMode {
  // server snapshot is "reduce" so SSR never ships/starts motion; it switches on after hydration when allowed
  const reduce = useMedia("(prefers-reduced-motion: reduce)", true);
  const lite = useSyncExternalStore(
    (cb) => {
      const c = conn() as (Conn & EventTarget) | undefined;
      c?.addEventListener?.("change", cb);
      return () => c?.removeEventListener?.("change", cb);
    },
    () => isLite(conn()),
    () => false,
  );
  return reduce ? "none" : lite ? "kb" : "full";
}

/** False for prefers-reduced-motion and data-saver / slow-network users. */
export function useMotionAllowed() {
  return useMotionMode() === "full";
}

/* Global playback budget: 3 videos on desktop, 2 on touch; denied entirely when motion is not allowed. */
const slots = createSlotManager({
  max: () => (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches ? 2 : 3),
  allowed: () =>
    typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !isLite(conn()),
});

const isLocal = (s: string) => s.startsWith("/");

export type MediaProps = {
  kind: Kind;
  src: string;
  poster?: string;
  /** Cinematic loop for an image (defaults to the local library's loop for this photo). */
  motion?: string;
  aspect: Aspect;
  alt: string;
  blur?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Fill an already-sized positioned parent instead of owning an aspect-ratio box. */
  fillParent?: boolean;
  children?: React.ReactNode;
};

/** Fixed-aspect box: still photo first (blur-up), then an in-view muted loop cross-faded over it. */
export function MediaView({ kind, src, poster, motion, aspect, alt, blur, priority = false, sizes, className = "", fillParent = false, children }: MediaProps) {
  const { w, h } = ASPECT_SIZE[aspect];
  const still = kind === "video" ? (poster ?? src) : src;
  const loop = kind === "video" ? src : (motion ?? motionFor(src));
  const mode = useMotionMode();
  const box = useRef<HTMLDivElement>(null);

  // Blur-up -> sharp plus a one-shot light sweep, only for images not yet painted at hydration
  // (so SSR/cached images never flash blurred and nothing waits on JS).
  useEffect(() => {
    const wrap = box.current;
    const img = wrap?.querySelector("img");
    if (!wrap || !img || img.complete) return;
    img.classList.add("mv-blurPending");
    const done = () => {
      img.classList.add("mv-blurDone");
      img.classList.remove("mv-blurPending");
      wrap.classList.add("mv-reveal");
      window.setTimeout(() => wrap.classList.remove("mv-reveal"), 1000);
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    return () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
    };
  }, [still]);

  const kb = mode === "kb" && loop ? `mv-kb${hash(src) % 4}` : "";
  return (
    <div
      ref={box}
      className={`mv-sheen ${fillParent ? "absolute inset-0" : "relative"} overflow-hidden bg-surface-2 ${className}`}
      style={fillParent ? undefined : { aspectRatio: `${w} / ${h}` }}
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
        className={`object-cover ${kb}`}
      />
      {loop && (mode === "full" || kind === "video") && (
        <VideoLayer src={loop} poster={blur ?? BLUR_DATA_URL} badge={kind === "video"} auto={mode === "full"} />
      )}
      {children}
    </div>
  );
}

/**
 * Looping muted video layered above the still image.
 * - element created only within about one screen of the viewport (phones drop it again when far away to free memory)
 * - preload="none" until it is visible (>=40%) and granted a playback slot, then "auto"
 * - paused when off-screen or the tab is hidden; desktop also starts on hover
 */
export function VideoLayer({ src, poster, badge = false, auto = true }: { src: string; poster?: string; badge?: boolean; auto?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const id = useRef<symbol>(Symbol("video"));
  const hoverRef = useRef(false);
  const tapRef = useRef(false);
  const touch = useMedia("(hover: none)", false);
  const [near, setNear] = useState(false);
  const [vis, setVis] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [tapped, setTapped] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [created, setCreated] = useState(false);
  if (near && !created) setCreated(true);
  const mounted = touch ? near : created;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const far = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: touch ? "60% 0px" : "100% 0px" });
    const seen = new IntersectionObserver(
      ([e]) => {
        const v = e.isIntersecting && e.intersectionRatio >= 0.4;
        setVis(v);
        if (!v) {
          tapRef.current = false;
          setTapped(null);
        }
      },
      { threshold: [0, 0.4] },
    );
    far.observe(el);
    seen.observe(el);
    return () => {
      far.disconnect();
      seen.disconnect();
    };
  }, [touch]);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const want = !hidden && (tapped ?? (auto && (vis || hover)));
  if (!mounted && ready) setReady(false);

  useEffect(() => {
    const v = vid.current;
    const me = id.current;
    if (!v) return;
    if (!want) {
      slots.release(me);
      v.pause();
      return;
    }
    const go = () => {
      v.preload = "auto";
      v.play().catch(() => undefined);
    };
    if (slots.request(me, { stop: () => v.pause(), onGrant: go, steal: hoverRef.current || tapRef.current, explicit: tapRef.current })) go();
    return () => slots.release(me);
  }, [want, mounted]);

  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      onMouseEnter={() => {
        hoverRef.current = true;
        setHover(true);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        setHover(false);
        tapRef.current = false;
        setTapped(null);
      }}
      onClick={() => {
        tapRef.current = !want;
        setTapped(!want);
      }}
    >
      {mounted && (
        <video
          ref={vid}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setReady(true)}
          onPause={() => setReady(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {mounted && ready && <span aria-hidden className={"mv-live"} />}
      {badge && !ready && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <Play size={10} fill="currentColor" /> Video
        </span>
      )}
    </div>
  );
}
