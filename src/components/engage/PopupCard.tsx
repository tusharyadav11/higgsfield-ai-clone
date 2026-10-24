"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pause, X } from "lucide-react";

const COLORS = ["var(--accent)", "#ffffff", "#7c3aed", "#22d3ee", "#f472b6", "#fbbf24"];
type Bit = { id: number; dx: string; dy: string; rot: string; color: string; w: number; h: number };

/** Small custom confetti burst (reuses the global `confetti` keyframes). Skipped for reduced motion. */
function Confetti() {
  const [bits, setBits] = useState<Bit[] | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mk = Array.from({ length: 30 }, (_, i): Bit => {
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 130;
      return {
        id: i,
        dx: `${Math.round(Math.cos(a) * d)}px`,
        dy: `${Math.round(Math.sin(a) * d - 50)}px`,
        rot: `${Math.round((Math.random() - 0.5) * 900)}deg`,
        color: COLORS[i % COLORS.length],
        w: 5 + Math.round(Math.random() * 4),
        h: 8 + Math.round(Math.random() * 5),
      };
    });
    const t0 = setTimeout(() => setBits(mk), 0);
    const t1 = setTimeout(() => setBits(null), 1500);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, []);
  if (!bits) return null;
  return (
    <div aria-hidden data-testid="popup-confetti" className="pointer-events-none absolute left-1/2 top-8 z-10">
      {bits.map((b) => (
        <i
          key={b.id}
          className="absolute rounded-[2px]"
          style={{ width: b.w, height: b.h, background: b.color, "--dx": b.dx, "--dy": b.dy, "--rot": b.rot, animation: "confetti 1.2s cubic-bezier(.15,.7,.3,1) forwards" } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg transition hover:brightness-110";
export const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 text-sm font-semibold text-fg transition hover:border-accent";

export function PopupCard({
  id,
  title,
  icon,
  modal,
  confetti,
  onClose,
  onMute,
  onPause,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  /** a celebration: role=dialog and focus moves to its first action */
  modal?: boolean;
  confetti?: boolean;
  onClose: () => void;
  onMute: () => void;
  onPause: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!modal) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, [modal]);

  return (
    <div
      ref={ref}
      data-engage
      data-testid="popup-card"
      data-popup={id}
      role={modal ? "dialog" : "status"}
      aria-labelledby={titleId}
      aria-live={modal ? undefined : "polite"}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-x-2 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-fg shadow-2xl motion-safe:animate-[fade-up_.28s_ease-out_both] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-[22rem]"
    >
      {confetti && <Confetti />}
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text">{icon}</span>
        <h2 id={titleId} className="min-w-0 flex-1 pt-2 text-base font-semibold leading-tight tracking-tight">
          {title}
        </h2>
        <button type="button" data-testid="popup-close" onClick={onClose} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 space-y-3 text-sm text-muted">{children}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 border-t border-line pt-1 text-xs text-muted">
        <button type="button" data-testid="popup-mute" onClick={onMute} className="min-h-11 rounded-lg px-1 underline-offset-2 hover:text-fg hover:underline">
          Don&apos;t show tips like this
        </button>
        <button type="button" data-testid="popup-pause" onClick={onPause} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 underline-offset-2 hover:text-fg hover:underline">
          <Pause className="size-3" aria-hidden /> Pause tips
        </button>
      </div>
    </div>
  );
}
