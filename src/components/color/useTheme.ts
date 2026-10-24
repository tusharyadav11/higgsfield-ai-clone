"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { applyTheme, isThemeMode, paintTheme, readThemeMode, type ResolvedTheme, type ThemeMode } from "@/lib/theme";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode"] });
  return () => mo.disconnect();
}
const snapshot = () => `${document.documentElement.dataset.themeMode ?? "dark"}|${document.documentElement.dataset.theme ?? "dark"}`;

export type ThemeState = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
};

export function useTheme(): ThemeState {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "dark|dark");
  const [m, r] = snap.split("|");
  const setMode = useCallback((next: ThemeMode) => applyTheme(next), []);
  return { mode: isThemeMode(m) ? m : "dark", resolved: r === "light" ? "light" : "dark", setMode };
}

/** Mounted once in the Shell: keeps `system` mode live and syncs other tabs. */
export function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onMq = () => {
      if (document.documentElement.dataset.themeMode === "system") paintTheme("system", true);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") paintTheme(readThemeMode(), true);
    };
    // make sure the DOM matches storage (e.g. boot script blocked)
    const stored = readThemeMode();
    if (document.documentElement.dataset.themeMode !== stored) paintTheme(stored);
    mq.addEventListener("change", onMq);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
