"use client";
import { useCallback, useSyncExternalStore } from "react";
import { ACCENTS, ACCENT_SWATCH, DEFAULT_ACCENT, applyAccent, isAccent, type Accent } from "@/lib/theme";
import { applyCustomAccent, clearCustomAccent, normalizeHex, previewCustomAccent } from "@/lib/color";

const SERVER = "lime|";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent", "style"] });
  return () => mo.disconnect();
}
function snapshot() {
  const el = document.documentElement;
  return `${el.dataset.accent ?? ""}|${el.style.getPropertyValue("--accent").trim()}`;
}

function endLiveTransition() {
  document.documentElement.style.removeProperty("transition");
}

export type AccentState = {
  /** current accent as #rrggbb */
  hex: string;
  /** named palette, or "custom" */
  name: Accent | "custom";
  isCustom: boolean;
  /** live preview (commit:false: paint only) or commit (persist; snaps to a named palette when equal) */
  setHex: (hex: string, meta?: { commit?: boolean }) => void;
  setNamed: (name: Accent) => void;
  reset: () => void;
};

/** Current accent + setters, keeping the 4 legacy named palettes and the custom colour in sync. */
export function useAccent(): AccentState {
  const snap = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const [attr, inline] = snap.split("|");
  const isCustom = attr === "custom" && !!normalizeHex(inline);
  const name: Accent | "custom" = isCustom ? "custom" : isAccent(attr) ? attr : DEFAULT_ACCENT;
  const hex = isCustom ? normalizeHex(inline)! : ACCENT_SWATCH[name as Accent];

  const setNamed = useCallback((n: Accent) => {
    clearCustomAccent();
    endLiveTransition();
    applyAccent(n);
  }, []);

  const setHex = useCallback(
    (h: string, meta?: { commit?: boolean }) => {
      const n = normalizeHex(h);
      if (!n) return;
      if (!meta?.commit) {
        // no 0.5s crossfade while dragging: the preview must track the pointer
        document.documentElement.style.setProperty("transition", "none");
        previewCustomAccent(n);
        return;
      }
      const named = ACCENTS.find((a) => ACCENT_SWATCH[a] === n);
      if (named) setNamed(named);
      else {
        applyCustomAccent(n);
        endLiveTransition();
      }
    },
    [setNamed],
  );

  const reset = useCallback(() => setNamed(DEFAULT_ACCENT), [setNamed]);
  return { hex, name, isCustom, setHex, setNamed, reset };
}
