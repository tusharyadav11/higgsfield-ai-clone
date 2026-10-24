"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveal-on-scroll. Server HTML and first paint are fully visible (no hidden content without JS);
 * after mount, blocks that start below the fold fade up once when they scroll into view.
 * Skipped entirely under prefers-reduced-motion.
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" | "section" }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.rv = "hide";
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.rv = "in";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const style = delay ? { transitionDelay: `${delay}ms` } : undefined;
  const cls = `transition-[opacity,transform] duration-700 ease-out data-[rv=hide]:translate-y-5 data-[rv=hide]:opacity-0 data-[rv=in]:translate-y-0 data-[rv=in]:opacity-100 ${className}`;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={cls} style={style}>
      {children}
    </Tag>
  );
}
