"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/color/useTheme";
import { THEMES, type ThemeMode } from "@/lib/theme";
import { cn } from "./cn";

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "System" };

/** Segmented sun / moon / monitor control. `compact` shrinks the hit areas for the header (still 36px+ wide, 44px tall row). */
export function ThemeToggle({ className, compact = false, id = "theme-segmented" }: { className?: string; compact?: boolean; id?: string }) {
  const { mode, resolved, setMode } = useTheme();
  const next = THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length];
  return (
    <div
      data-testid={id}
      role="radiogroup"
      aria-label={`Theme: ${LABEL[mode]}${mode === "system" ? ` (${resolved})` : ""}. Next: ${LABEL[next]}`}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5", className)}
    >
      {THEMES.map((t) => {
        const Icon = ICON[t];
        const on = mode === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${LABEL[t]} theme`}
            title={`${LABEL[t]} theme`}
            data-testid={`${id}-option-${t}`}
            onClick={() => setMode(t)}
            className={cn(
              "flex items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              compact ? "size-9" : "h-11 min-w-11 gap-1.5 px-3 text-sm font-medium",
              on ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {!compact && <span>{LABEL[t]}</span>}
          </button>
        );
      })}
    </div>
  );
}

const GAP = 8;
const MENU_W = 168;

/** Header control: one 44px icon button (current mode) that opens a small menu with the three options. */
export function ThemeMenu({ className }: { className?: string }) {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const next = THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length];
  const Icon = mode === "system" ? ICON[resolved] : ICON[mode];

  const place = useCallback(() => {
    const p = panel.current, t = trigger.current;
    if (!p || !t) return;
    const vw = document.documentElement.clientWidth;
    const r = t.getBoundingClientRect();
    p.style.left = `${Math.min(Math.max(r.right - MENU_W, GAP), vw - MENU_W - GAP)}px`;
    p.style.top = `${r.bottom + GAP}px`;
  }, []);
  useLayoutEffect(() => {
    if (open) place();
  });
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-testid="theme-toggle"
        aria-label={`Theme: ${LABEL[mode]}${mode === "system" ? ` (${resolved})` : ""}. Next: ${LABEL[next]}. Open theme menu`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-2.5 text-fg outline-none transition-colors hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none",
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="radiogroup"
            aria-label="Theme"
            data-testid="theme-menu"
            style={{ left: 0, top: 0, width: MENU_W }}
            className="fixed z-[100] flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-[var(--shadow-c)] transition-[opacity,transform] duration-200 starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
          >
            {THEMES.map((t) => {
              const I = ICON[t];
              const on = mode === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-testid={`theme-option-${t}`}
                  onClick={() => setMode(t)}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    on ? "bg-accent text-accent-fg" : "text-fg hover:bg-surface-2",
                  )}
                >
                  <I className="size-4" aria-hidden />
                  {LABEL[t]}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
