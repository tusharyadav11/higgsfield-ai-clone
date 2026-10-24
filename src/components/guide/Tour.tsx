"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MousePointer2 } from "lucide-react";
import { TOURS, type TourKey } from "@/lib/guide/tour";
import { useReducedMotion } from "@/lib/guide/bus";

type Rect = { x: number; y: number; w: number; h: number };
const WAIT_MS = 3000;
const sel = (id: string) => `[data-testid="${id}"]`;
const pathOf = (r: string) => r.split("?")[0];

function setNative(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

export function Tour({ tourKey, onEnd }: { tourKey: TourKey; onEnd: (finished: boolean) => void }) {
  const steps = TOURS[tourKey];
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [arrived, setArrived] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  });
  const step = steps[idx];
  const last = idx === steps.length - 1;

  const next = useCallback(() => {
    if (idx >= steps.length - 1) onEnd(true);
    else {
      setRect(null);
      setIdx(idx + 1);
    }
  }, [idx, steps.length, onEnd]);
  const back = useCallback(() => {
    if (idx > 0) {
      setRect(null);
      setIdx(idx - 1);
    }
  }, [idx]);

  // Locate, track, act on and (if missing) skip the current target.
  useEffect(() => {
    const s = steps[idx];
    if (s.route && pathOf(s.route) !== pathRef.current) router.push(s.route);
    const start = performance.now();
    let raf = 0;
    let found = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let typer: ReturnType<typeof setInterval> | undefined;
    let prev = "";
    const act = (el: HTMLElement) => {
      timers.push(
        setTimeout(() => {
          if (s.fill && el instanceof HTMLTextAreaElement) {
            const text = s.fill;
            if (reduced) setNative(el, text);
            else {
              let n = 0;
              setNative(el, "");
              typer = setInterval(() => {
                n += 2;
                setNative(el, text.slice(0, n));
                if (n >= text.length) clearInterval(typer);
              }, 22);
            }
          }
          if (s.select && el instanceof HTMLSelectElement && [...el.options].some((o) => o.value === s.select)) setNative(el, s.select);
          if (s.autoClick) el.click();
        }, reduced ? 100 : 900),
      );
    };
    const loop = () => {
      const el = document.querySelector<HTMLElement>(sel(s.target));
      const r = el?.getBoundingClientRect();
      const ok = !!el && !!r && r.width > 0 && r.height > 0 && (!s.route || pathOf(s.route) === pathRef.current);
      if (ok && el && r) {
        if (!found) {
          found = true;
          if (r.top < 70 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
          act(el);
          timers.push(setTimeout(() => setArrived((a) => a + 1), reduced ? 0 : 750));
        }
        const key = [r.left, r.top, r.width, r.height].map(Math.round).join();
        if (key !== prev) {
          prev = key;
          setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
        }
      } else if (!found && performance.now() - start > WAIT_MS) {
        // Never block: skip a target that does not exist here.
        if (idx >= steps.length - 1) onEnd(false);
        else setIdx(idx + 1);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers = [];
      if (typer) clearInterval(typer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "Escape") onEnd(false);
      else if (!typing && e.key === "ArrowRight") next();
      else if (!typing && e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onEnd]);

  const confirm = () => {
    const el = document.querySelector<HTMLElement>(sel(step.target));
    el?.click();
    setTimeout(() => onEnd(true), 350);
  };

  const vw = typeof window === "undefined" ? 360 : window.innerWidth;
  const vh = typeof window === "undefined" ? 640 : window.innerHeight;
  const cardW = Math.min(320, vw - 24);
  let cardStyle: React.CSSProperties = { left: 12, bottom: 90, width: cardW };
  if (rect) {
    const below = rect.y + rect.h + 14 + 190 < vh;
    const left = Math.max(12, Math.min(vw - cardW - 12, rect.x + rect.w / 2 - cardW / 2));
    cardStyle = below
      ? { left, top: rect.y + rect.h + 14, width: cardW }
      : rect.y - 14 - 190 > 56
        ? { left, top: rect.y - 14 - 190, width: cardW }
        : { left: Math.max(12, vw - cardW - 12), bottom: 96, width: cardW };
  }
  const pad = 6;
  const cur = rect && { x: rect.x + Math.min(rect.w * 0.6, rect.w - 10), y: rect.y + rect.h * 0.6 };

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" data-testid="tour-overlay">
      <style>{`@keyframes tour-ripple{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.4);opacity:0}}`}</style>
      {rect && (
        <div
          aria-hidden
          className="absolute rounded-xl ring-2 ring-accent"
          style={{
            left: rect.x - pad,
            top: rect.y - pad,
            width: rect.w + pad * 2,
            height: rect.h + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.62)",
            transition: reduced ? "none" : "all 600ms cubic-bezier(.22,1,.36,1)",
          }}
        />
      )}
      {cur && !reduced && (
        <div
          aria-hidden
          data-testid="tour-cursor"
          className="absolute left-0 top-0"
          style={{ transform: `translate(${cur.x}px, ${cur.y}px)`, transition: "transform 700ms cubic-bezier(.22,1,.36,1)" }}
        >
          <span key={arrived} className="absolute -left-3 -top-3 size-6 rounded-full bg-accent/60" style={{ animation: arrived ? "tour-ripple 600ms ease-out" : "none", opacity: arrived ? undefined : 0 }} />
          <MousePointer2 className="relative size-6 fill-white text-black drop-shadow-lg" />
        </div>
      )}
      <div
        role="region"
        aria-label="Product tour"
        aria-live="polite"
        className="pointer-events-auto fixed rounded-2xl border border-line bg-surface p-4 text-fg shadow-2xl"
        style={cardStyle}
      >
        {!rect && <p className="mb-2 text-xs text-muted">Finding that on the page...</p>}
        <h2 className="text-base font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-accent" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <span className="sr-only">
          Step {idx + 1} of {steps.length}
        </span>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" data-testid="tour-skip" onClick={() => onEnd(false)} className="min-h-11 rounded-lg px-2 text-sm text-muted hover:text-fg">
            Skip
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button type="button" onClick={back} className="min-h-11 rounded-lg border border-line px-3 text-sm hover:border-accent">
                Back
              </button>
            )}
            {step.confirm ? (
              <button type="button" data-testid="tour-next" onClick={confirm} disabled={!rect} className="min-h-11 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-50">
                {step.confirm}
              </button>
            ) : (
              <button type="button" data-testid="tour-next" onClick={next} autoFocus className="min-h-11 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg">
                {last ? "Done" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
