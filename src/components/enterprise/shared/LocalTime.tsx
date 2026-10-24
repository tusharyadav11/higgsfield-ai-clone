"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** False during SSR/prerender and the first client render; true after mount (cacheComponents-safe). */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/** The live origin, available only after mount ('' during prerender). */
export const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** Renders a timestamp only after mount, so server and client markup never disagree on locale/timezone. */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const mounted = useMounted();
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {mounted ? fmt(iso) : " "}
    </time>
  );
}
