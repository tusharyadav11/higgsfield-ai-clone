"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, Check, Maximize, Play, X } from "lucide-react";
import { lsGet, lsSet, useReducedMotion } from "@/lib/guide/bus";
import { FALLBACK_CHAPTERS, TOUR_VIDEO, activeChapter, clampSeek, fmtClock, parseChaptersVtt, type Chapter } from "@/lib/guide/tour-video";

const FOCUSABLE = 'button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])';

function trackMode(v: HTMLVideoElement | null, on: boolean) {
  const tr = v?.textTracks[0];
  if (tr) tr.mode = on ? "showing" : "hidden";
}

/**
 * Product-tour video modal. Mounted only while open, so the poster, the video and the chapters file
 * are not requested until the user asks for them.
 */
export function TourVideo({ onClose, onTry }: { onClose: () => void; onTry: () => void }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [chapters, setChapters] = useState<Chapter[]>(FALLBACK_CHAPTERS);
  const [time, setTime] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [watched] = useState(() => lsGet<boolean>(TOUR_VIDEO.watchedKey, false));
  const markWatched = useCallback(() => lsSet(TOUR_VIDEO.watchedKey, true), []);

  // focus management + scroll lock
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>('[data-testid="tour-video-close"]')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  // chapters come from the recorded chapters.vtt so a re-record needs no code change
  useEffect(() => {
    const ac = new AbortController();
    fetch(TOUR_VIDEO.chapters, { signal: ac.signal })
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => {
        const c = parseChaptersVtt(t);
        if (c.length) setChapters(c);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  const seek = useCallback((t: number) => {
    const v = video.current;
    if (v) v.currentTime = clampSeek(t, v.duration);
  }, []);
  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, []);
  const setCaptions = useCallback((on: boolean) => {
    trackMode(video.current, on);
    setCaptionsOn(on);
  }, []);
  const fullscreen = useCallback(() => {
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen().catch(() => undefined);
    else v.webkitEnterFullscreen?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const els = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const onControl = t.tagName === "BUTTON" || t.tagName === "A";
    const v = video.current;
    if (e.key === " " && !onControl) {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (!v) return;
      e.preventDefault();
      seek(v.currentTime + (e.key === "ArrowRight" ? 5 : -5));
    } else if (e.key.toLowerCase() === "c") {
      setCaptions(!captionsOn);
    } else if (e.key.toLowerCase() === "f") {
      fullscreen();
    }
  };

  const cur = activeChapter(chapters, time);
  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-scrim p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Kinetic product tour video"
        data-testid="tour-video"
        onKeyDown={onKeyDown}
        className="w-full min-w-0 max-w-5xl rounded-2xl border border-line bg-surface p-3 text-fg shadow-2xl sm:p-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-lg">Kinetic product tour</h2>
            <p className="hidden text-xs text-muted sm:block">
              Space play/pause · ← → skip 5s · C captions · F fullscreen · Esc close{watched ? " · Watched" : ""}
            </p>
          </div>
          <button type="button" data-testid="tour-video-close" onClick={onClose} aria-label="Close tour video" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <video
            ref={video}
            data-testid="tour-video-player"
            src={TOUR_VIDEO.src}
            poster={TOUR_VIDEO.poster}
            controls
            playsInline
            muted
            autoPlay={!reduced}
            preload="metadata"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setTime(v.currentTime);
              if (v.duration && v.currentTime / v.duration > 0.9) markWatched();
            }}
            onEnded={markWatched}
            onLoadedMetadata={() => setCaptions(false)}
            className="aspect-video w-full min-w-0 rounded-xl bg-black object-contain max-[900px]:max-h-[60dvh] [@media(max-height:500px)]:max-h-[70dvh]"
          >
            <track default kind="captions" srcLang="en" label="English" src={TOUR_VIDEO.captions} />
          </video>
          <ol aria-label="Chapters" className="flex min-w-0 flex-wrap gap-1.5 lg:max-h-[26rem] lg:flex-col lg:flex-nowrap lg:overflow-y-auto">
            {chapters.map((c, i) => (
              <li key={c.start} className="min-w-0 lg:w-full">
                <button
                  type="button"
                  data-testid={`tour-video-chapter-${i + 1}`}
                  aria-current={i === cur ? "true" : undefined}
                  onClick={() => {
                    seek(c.start + 0.05);
                    video.current?.play().catch(() => undefined);
                  }}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-xs sm:text-sm ${i === cur ? "border-accent bg-accent text-accent-fg" : "border-line text-fg hover:bg-surface-2"}`}
                >
                  <span className="tabular-nums opacity-70">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="hidden tabular-nums opacity-70 sm:inline">{fmtClock(c.start)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" data-testid="tour-video-try" onClick={() => { markWatched(); onTry(); }} className={`${btn} bg-accent text-accent-fg`}>
            <Play className="size-4" aria-hidden /> Try it yourself
          </button>
          <button type="button" aria-pressed={captionsOn} onClick={() => setCaptions(!captionsOn)} className={`${btn} border border-line text-fg hover:bg-surface-2`}>
            {captionsOn ? <Check className="size-4" aria-hidden /> : <Captions className="size-4" aria-hidden />} Subtitles
          </button>
          <button type="button" onClick={fullscreen} className={`${btn} border border-line text-fg hover:bg-surface-2`}>
            <Maximize className="size-4" aria-hidden /> Fullscreen
          </button>
          <button type="button" data-testid="tour-video-skip" onClick={onClose} className="ml-auto inline-flex min-h-11 items-center px-3 text-sm text-muted underline underline-offset-4 hover:text-fg">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
