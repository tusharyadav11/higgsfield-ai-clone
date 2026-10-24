"use client";
import { useEffect, useRef, useState } from "react";

/** Eases a number toward `value` (rAF, <1s). Server and first client render both show `value`. */
export function CountUp({ value, from, ms = 1100, className }: { value: number; from?: number; ms?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  const started = useRef(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = !started.current && from !== undefined ? from : cur.current;
    started.current = true;
    if (reduce || start === value) {
      cur.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      cur.current = Math.round(start + (value - start) * e);
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, from, ms]);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }} suppressHydrationWarning>
      {shown.toLocaleString("en-US")}
    </span>
  );
}
