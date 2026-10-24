"use client";
import { useEffect, useSyncExternalStore } from "react";

type ToastItem = { id: number; text: string; undo?: () => void; onExpire?: () => void; ms: number };
let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function drop(id: number, expired: boolean) {
  const t = items.find((x) => x.id === id);
  if (!t) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((x) => x.id !== id);
  emit();
  if (expired) t.onExpire?.();
}

/** Show a toast. With `undo`, it shows an Undo button for `ms` (default 5s); `onExpire` fires if it was NOT undone. */
export function showToast(text: string, opts: { undo?: () => void; onExpire?: () => void; ms?: number } = {}) {
  const id = ++seq;
  const ms = opts.ms ?? 5000;
  items = [...items, { id, text, undo: opts.undo, onExpire: opts.onExpire, ms }];
  timers.set(id, setTimeout(() => drop(id, true), ms));
  emit();
  return id;
}
/** Expire every pending toast immediately (commits their deferred actions). */
export function flushToasts() {
  items.map((x) => x.id).forEach((id) => drop(id, true));
}

const sub = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const snap = () => items;
const server: ToastItem[] = [];

export function ToastHost() {
  const list = useSyncExternalStore(sub, snap, () => server);
  useEffect(() => () => flushToasts(), []);
  if (!list.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[120] flex flex-col items-center gap-2 sm:bottom-6 sm:items-start sm:pl-3">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          data-testid={t.undo ? "undo-toast" : "toast"}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 text-sm text-fg shadow-xl shadow-[var(--shadow-c)]"
        >
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          {t.undo && (
            <button
              type="button"
              data-testid="undo-btn"
              onClick={() => {
                const u = t.undo;
                drop(t.id, false);
                u?.();
              }}
              className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-accent-fg"
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
