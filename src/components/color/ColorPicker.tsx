"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, Ref } from "react";
import { Check, Pipette, RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/components/ui/cn";
import {
  APP_BG, contrast, ensureUsableAccent, hexToHsv, hexToRgb, hsvToHex, normalizeHex, readableOn, rgbToHex, type HSV,
} from "@/lib/color";

export type PickerChange = (hex: string, meta: { commit: boolean }) => void;

export const PRESETS = [
  { name: "lime", hex: "#c6ff3d" },
  { name: "violet", hex: "#a78bfa" },
  { name: "ember", hex: "#ff7a2f" },
  { name: "ocean", hex: "#3ab8ff" },
  { name: "pink", hex: "#ff4fa3" },
  { name: "mint", hex: "#34e5a0" },
  { name: "gold", hex: "#ffc83d" },
  { name: "red", hex: "#ff4d4d" },
] as const;
const LEGACY = new Set(["lime", "violet", "ember", "ocean"]);
const RECENT_KEY = "accent-recent";

/* ---------- recent colours: tiny external store over localStorage ---------- */
const recentListeners = new Set<() => void>();
function readRecentRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribeRecent(cb: () => void) {
  recentListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    recentListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function pushRecent(hex: string) {
  try {
    const cur = (JSON.parse(readRecentRaw()) as string[]).filter((h) => h !== hex);
    localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...cur].slice(0, 6)));
  } catch {}
  recentListeners.forEach((l) => l());
}
function useRecent(): string[] {
  const raw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => "[]");
  return useMemo(() => {
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a.map((h) => normalizeHex(String(h))).filter((h): h is string => !!h).slice(0, 6) : [];
    } catch {
      return [];
    }
  }, [raw]);
}

const noopSubscribe = () => () => {};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ---------- pointer drag helper (mouse, touch, pen) ---------- */
function useDrag(onDrag: (fx: number, fy: number) => void, onEnd: () => void) {
  const el = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const cb = useRef({ onDrag, onEnd });
  useEffect(() => {
    cb.current = { onDrag, onEnd };
  });
  const move = (e: ReactPointerEvent) => {
    const r = el.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    cb.current.onDrag(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
  };
  const finish = (e: ReactPointerEvent) => {
    if (!active.current) return;
    active.current = false;
    try {
      el.current?.releasePointerCapture(e.pointerId);
    } catch {}
    cb.current.onEnd();
  };
  return {
    ref: el as Ref<HTMLDivElement>,
    onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      active.current = true;
      move(e);
    },
    onPointerMove(e: ReactPointerEvent) {
      if (active.current) move(e);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
  };
}

export function ColorPicker({
  value,
  onChange,
  onReset,
  showInputs = true,
  className,
}: {
  value: string;
  onChange: PickerChange;
  onReset?: () => void;
  /** hex + RGB inputs (default true) */
  showInputs?: boolean;
  className?: string;
}) {
  const uid = useId();
  const normalized = normalizeHex(value) ?? "#c6ff3d";
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(normalized)!);
  const [prevValue, setPrevValue] = useState(normalized);
  const hex = hsvToHex(hsv);

  // external value change (preset elsewhere, reset, another tab): adopt it but keep hue for greys/black
  if (normalized !== prevValue) {
    setPrevValue(normalized);
    if (normalized !== hex) {
      const n = hexToHsv(normalized)!;
      setHsv({ h: n.s === 0 || n.v === 0 ? hsv.h : n.h, s: n.s, v: n.v });
    }
  }

  const recent = useRecent();
  const hasEyeDropper = useSyncExternalStore(noopSubscribe, () => "EyeDropper" in window, () => false);

  /* rAF-throttled live updates; commits flush synchronously */
  const raf = useRef(0);
  const pending = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const live = useCallback((h: string) => {
    pending.current = h;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (pending.current) onChangeRef.current(pending.current, { commit: false });
      pending.current = null;
    });
  }, []);
  const commit = useCallback((h: string, remember = true) => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pending.current = null;
    onChangeRef.current(h, { commit: true });
    if (remember) pushRecent(h);
  }, []);

  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  });
  const update = (next: HSV, mode: "live" | "commit" | "key") => {
    setHsv(next);
    const h = hsvToHex(next);
    if (mode === "live") live(h);
    else commit(h, mode === "commit");
  };
  const adopt = (h: string, remember = true) => {
    const n = hexToHsv(h)!;
    setHsv({ h: n.s === 0 || n.v === 0 ? hsv.h : n.h, s: n.s, v: n.v });
    commit(h, remember);
  };

  /* SV area */
  const sv = useDrag(
    (fx, fy) => update({ ...hsvRef.current, s: fx, v: 1 - fy }, "live"),
    () => commit(hsvToHex(hsvRef.current)),
  );
  const onSvKey = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    let { s, v } = hsv;
    if (e.key === "ArrowLeft") s -= step;
    else if (e.key === "ArrowRight") s += step;
    else if (e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowDown") v -= step;
    else return;
    e.preventDefault();
    update({ ...hsv, s: clamp(s, 0, 1), v: clamp(v, 0, 1) }, "key");
  };

  /* hue */
  const hue = useDrag(
    (fx) => update({ ...hsvRef.current, h: fx * 360 }, "live"),
    () => commit(hsvToHex(hsvRef.current)),
  );
  const onHueKey = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 36 : 3.6;
    let h = hsv.h;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") h -= step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") h += step;
    else if (e.key === "Home") h = 0;
    else if (e.key === "End") h = 359.9;
    else return;
    e.preventDefault();
    update({ ...hsv, h: clamp(h, 0, 359.9) }, "key");
  };

  /* hex input */
  const [draft, setDraft] = useState<string | null>(null);
  const shownHex = draft ?? hex;
  const onHexInput = (text: string) => {
    setDraft(text);
    const n = normalizeHex(text);
    if (!n) return;
    const full = text.trim().replace(/^#/, "").length === 6;
    const parsed = hexToHsv(n)!;
    setHsv({ h: parsed.s === 0 || parsed.v === 0 ? hsv.h : parsed.h, s: parsed.s, v: parsed.v });
    if (full) {
      commit(n);
    } else live(n);
  };
  const hexBlur = () => {
    const n = draft === null ? null : normalizeHex(draft);
    if (n) commit(n);
    setDraft(null);
  };

  /* rgb inputs */
  const rgb = hexToRgb(hex)!;
  const setChannel = (k: "r" | "g" | "b", text: string) => {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return;
    adopt(rgbToHex({ ...rgb, [k]: clamp(Math.round(n), 0, 255) }));
  };

  const doReset = () => {
    if (onReset) onReset();
    else onChange(PRESETS[0].hex, { commit: true });
  };

  const eyedrop = async () => {
    try {
      const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const r = await new ED().open();
      const n = normalizeHex(r.sRGBHex);
      if (n) adopt(n);
    } catch {
      /* cancelled */
    }
  };

  const fg = readableOn(hex);
  const ratio = contrast(hex, fg);
  const aa = ratio >= 4.5;
  const dim = contrast(hex, APP_BG) < 3;
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const svText = `Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`;
  const btn =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg transition-colors hover:border-accent/50 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent";
  const field =
    "min-h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 font-mono text-sm text-fg outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div data-testid="accent-picker" className={cn("flex w-full min-w-0 flex-col gap-3 text-fg", className)}>
      <div
        {...sv}
        role="slider"
        tabIndex={0}
        data-testid="accent-sv-area"
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={svText}
        onKeyDown={onSvKey}
        className="relative h-40 w-full cursor-crosshair touch-none select-none rounded-xl outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent min-[420px]:h-44"
        style={{
          backgroundColor: hueColor,
          backgroundImage: "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,.55),0_2px_8px_rgba(0,0,0,.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
        />
      </div>

      <div className="flex h-11 items-center">
        <div
          {...hue}
          role="slider"
          tabIndex={0}
          data-testid="accent-hue"
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          aria-valuetext={`Hue ${Math.round(hsv.h)} degrees`}
          onKeyDown={onHueKey}
          className="relative h-7 w-full cursor-pointer touch-none select-none rounded-full outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
          style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,.55),0_2px_8px_rgba(0,0,0,.5)]"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
          />
        </div>
      </div>

      {showInputs && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Hex colour</span>
              <input
                data-testid="accent-hex-input"
                value={shownHex}
                onChange={(e) => onHexInput(e.target.value)}
                onBlur={hexBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                maxLength={7}
                aria-invalid={draft !== null && !normalizeHex(draft)}
                className={cn(field, draft !== null && !normalizeHex(draft) && "border-red-400")}
              />
            </label>
            {hasEyeDropper && (
              <button type="button" data-testid="accent-eyedropper" aria-label="Pick colour from screen" onClick={eyedrop} className={cn(btn, "w-11 shrink-0 px-0")}>
                <Pipette className="size-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["r", "g", "b"] as const).map((k) => (
              <label key={k} className="min-w-0">
                <span className="sr-only">{k.toUpperCase()} channel</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={255}
                  aria-label={k.toUpperCase()}
                  data-testid={`accent-rgb-${k}`}
                  value={rgb[k]}
                  onChange={(e) => setChannel(k, e.target.value)}
                  className={cn(field, "px-2 text-center")}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {!showInputs && hasEyeDropper && (
        <button type="button" data-testid="accent-eyedropper" onClick={eyedrop} className={btn}>
          <Pipette className="size-4" /> Pick from screen
        </button>
      )}

      <div role="group" aria-label="Preset colours" className="grid grid-cols-4 justify-items-center">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            data-testid={`accent-preset-${p.name}`}
            aria-label={`${p.name} accent`}
            aria-pressed={hex === p.hex}
            onClick={() => adopt(p.hex)}
            className="group flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span
              data-testid={LEGACY.has(p.name) ? `accent-option-${p.name}` : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform motion-reduce:transition-none group-hover:scale-110",
                hex === p.hex ? "ring-2 ring-fg" : "ring-0",
              )}
              style={{ background: p.hex }}
            >
              {hex === p.hex && <Check className="size-4" strokeWidth={3} style={{ color: readableOn(p.hex) }} />}
            </span>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div>
          <p id={`${uid}-recent`} className="mb-0.5 text-xs text-muted">
            Recent
          </p>
          <div role="group" aria-labelledby={`${uid}-recent`} className="flex flex-wrap">
            {recent.map((h) => (
              <button
                key={h}
                type="button"
                data-testid={`accent-recent-${h.slice(1)}`}
                aria-label={`Recent colour ${h}`}
                onClick={() => adopt(h, false)}
                className="group flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="size-6 rounded-full ring-1 ring-line transition-transform motion-reduce:transition-none group-hover:scale-110" style={{ background: h }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div
          data-testid="accent-contrast"
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
            aa ? "border-line text-muted" : "border-amber-400/50 text-amber-300",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: hex, color: fg }}>
            Aa
          </span>
          <span className="min-w-0">
            Text on this colour: {aa ? <>AA <Check className="inline size-3" /></> : <>below AA <TriangleAlert className="inline size-3" /></>}{" "}
            <span className="font-mono">{(Math.floor(ratio * 10) / 10).toFixed(1)}:1</span>
          </span>
        </div>
        {dim && (
          <button type="button" data-testid="accent-lift" onClick={() => adopt(ensureUsableAccent(hex), false)} className={cn(btn, "text-xs")}>
            Too dark on the background: lighten
          </button>
        )}
        <button type="button" data-testid="accent-reset" onClick={doReset} className={btn}>
          <RotateCcw className="size-4" /> Reset
        </button>
      </div>
    </div>
  );
}
