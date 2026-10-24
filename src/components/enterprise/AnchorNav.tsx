"use client";
import { useEffect, useState } from "react";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "benefits", label: "Benefits" },
  { id: "calculator", label: "Calculator" },
  { id: "compare", label: "Compare" },
  { id: "summary", label: "Summary" },
  { id: "quote", label: "Request a quote" },
  { id: "faq", label: "FAQ" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function scrollToSection(id: string, focus = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
  } catch {}
  if (focus) {
    const f = el.querySelector<HTMLElement>("input:not([type=hidden]):not([tabindex='-1']), select, textarea");
    window.setTimeout(() => f?.focus({ preventScroll: true }), reduced() ? 0 : 450);
  }
}

/** Sticky in-page navigation (sits under the app header) with smooth scroll and scroll-spy. */
export function AnchorNav() {
  const [active, setActive] = useState<SectionId>("overview");
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let cur: SectionId = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) cur = s.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = SECTIONS[SECTIONS.length - 1].id;
      setActive(cur);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    calc();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // keep the active pill visible inside the horizontally scrollable bar on small screens
  useEffect(() => {
    const b = document.querySelector<HTMLElement>(`[data-testid="ent-nav-${active}"]`);
    const ul = b?.closest("ul");
    if (b && ul && ul.scrollWidth > ul.clientWidth) ul.scrollTo({ left: b.offsetLeft - ul.clientWidth / 2 + b.clientWidth / 2, behavior: reduced() ? "auto" : "smooth" });
  }, [active]);

  return (
    <nav aria-label="On this page" className="sticky top-14 z-20 -mx-3 border-b border-line bg-bg/80 px-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <ul className="scrollbar-none mx-auto flex max-w-6xl gap-1 overflow-x-auto py-1.5">
        {SECTIONS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                data-testid={`ent-nav-${s.id}`}
                aria-current={on ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(s.id);
                }}
                className={`flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
