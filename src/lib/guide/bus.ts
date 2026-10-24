"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";

export type GuideEvent = "search" | "assistant" | "tour" | "first-video" | "claim" | "shortcuts" | "whatsnew" | "invite" | "tour-video";
const NAME = "guide:open";

export const TOUR_VIDEO_EVENT = "kinetic:tour-video";

/** Opens the product-tour video modal from anywhere (also: `window.dispatchEvent(new Event("kinetic:tour-video"))`). */
export function openTourVideo() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOUR_VIDEO_EVENT));
}

export function openGuide(kind: GuideEvent) {
  if (kind === "tour-video") return openTourVideo();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<GuideEvent>(NAME, { detail: kind }));
}

export function useGuideEvents(handler: (k: GuideEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<GuideEvent>).detail);
    window.addEventListener(NAME, fn);
    return () => window.removeEventListener(NAME, fn);
  }, []);
}

function subMq(q: string) {
  return (cb: () => void) => {
    const m = window.matchMedia(q);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
}
const RM = "(prefers-reduced-motion: reduce)";
const subRm = subMq(RM);
export function useReducedMotion() {
  return useSyncExternalStore(subRm, () => window.matchMedia(RM).matches, () => false);
}

const noop = () => () => {};
export function useIsMac() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent), () => false);
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}
