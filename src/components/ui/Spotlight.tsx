"use client";
import { useEffect } from "react";

/**
 * One delegated pointer listener for the whole app. Writes --mx/--my (spotlight) and --rx/--ry (tilt)
 * onto the hovered `[data-spot]` element; all visuals are CSS (see globals.css). Mouse-like pointers only.
 */
export function SpotlightRoot() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    let last: HTMLElement | null = null;
    let ev: PointerEvent | null = null;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
    const run = () => {
      raf = 0;
      if (!ev) return;
      const t = (ev.target as Element | null)?.closest?.("[data-spot]") as HTMLElement | null;
      if (last && last !== t) reset(last);
      last = t;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      t.style.setProperty("--mx", `${x}px`);
      t.style.setProperty("--my", `${y}px`);
      if (t.hasAttribute("data-tilt")) {
        t.style.setProperty("--rx", `${(0.5 - y / r.height) * 7}deg`);
        t.style.setProperty("--ry", `${(x / r.width - 0.5) * 7}deg`);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      ev = e;
      if (!raf) raf = requestAnimationFrame(run);
    };
    const leave = () => {
      if (last) reset(last);
      last = null;
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
