"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Palette, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { ColorPicker } from "./ColorPicker";
import { useAccent } from "./useAccent";

const PHONE_QUERY = "(max-width: 639px)";
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
const PANEL_W = 296;
const GAP = 8;

export function ColorPopover({ className }: { className?: string }) {
  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);

  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  }, []);

  /* anchored placement (desktop): shift into the viewport, flip above when there is no room below */
  const place = useCallback(() => {
    const p = panel.current, t = trigger.current;
    if (!p || !t || isPhone) return;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = Math.min(PANEL_W, vw - 2 * GAP);
    const r = t.getBoundingClientRect();
    p.style.width = `${w}px`;
    p.style.maxHeight = `${vh - 2 * GAP}px`;
    const h = Math.min(p.offsetHeight, vh - 2 * GAP);
    const left = Math.min(Math.max(r.right - w, GAP), vw - w - GAP);
    let top = r.bottom + GAP;
    if (top + h > vh - GAP) top = r.top - GAP - h >= GAP ? r.top - GAP - h : Math.max(GAP, vh - GAP - h);
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
  }, [isPhone]);

  useLayoutEffect(() => {
    if (open) place();
  });
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    const ro = new ResizeObserver(on);
    if (panel.current) ro.observe(panel.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
      ro.disconnect();
    };
  }, [open, place]);

  /* outside click + Escape + initial focus */
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      close(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    panel.current?.querySelector<HTMLElement>('[data-testid="accent-sv-area"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, close]);

  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-testid="accent-switcher"
        aria-label="Accent colour"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-fg outline-none transition-colors hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none",
          className,
        )}
      >
        <span className="size-5 rounded-full ring-1 ring-white/25" style={{ background: accent.hex }} />
        <Palette className="size-4 text-muted" aria-hidden />
      </button>
      {open &&
        createPortal(
          <>
            {isPhone && <div aria-hidden className="fixed inset-0 z-[90] bg-black/60 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none" />}
            <div
              ref={panel}
              role="dialog"
              aria-label="Accent colour picker"
              aria-modal={isPhone || undefined}
              onKeyDown={trap}
              className={cn(
                "fixed z-[100] overflow-y-auto overscroll-contain border border-line bg-surface p-4 shadow-2xl shadow-black/60 transition-[opacity,transform] duration-200 starting:opacity-0 motion-reduce:transition-none",
                isPhone
                  ? "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] starting:translate-y-6"
                  : "rounded-2xl starting:-translate-y-1",
              )}
              style={isPhone ? { width: "100%" } : { left: 0, top: 0 }}
            >
              <div className="mb-3 flex items-center justify-between">
                {isPhone && <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />}
                <h2 className="text-sm font-semibold">Accent colour</h2>
                <button
                  type="button"
                  aria-label="Close"
                  data-testid="accent-close"
                  onClick={() => close()}
                  className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="size-4" />
                </button>
              </div>
              <ColorPicker value={accent.hex} onChange={accent.setHex} onReset={accent.reset} />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
