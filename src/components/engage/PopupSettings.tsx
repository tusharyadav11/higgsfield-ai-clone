"use client";
import { useEffect } from "react";
import { POPUP_IDS, POPUP_META } from "@/lib/engage/rules";
import { useEngage } from "@/lib/engage/state";
import { useMounted } from "@/components/growth/hooks";

/** Drop-in settings block: pause all tips, re-enable muted tip types. Safe to render anywhere (client). */
export function PopupSettings() {
  const mounted = useMounted();
  const s = useEngage((x) => x.s);
  const load = useEngage((x) => x.load);
  const update = useEngage((x) => x.update);
  useEffect(() => load(), [load]);
  const muted = POPUP_IDS.filter((id) => s.muted[id]);
  if (!mounted) return null;
  return (
    <section aria-labelledby="popup-settings-h" data-testid="popup-settings" className="space-y-3">
      <h3 id="popup-settings-h" className="text-sm font-semibold text-fg">
        Contextual tips
      </h3>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-fg">
        <span>
          Pause tips
          <span className="block text-xs text-muted">No pop-up cards about credits, streaks or ideas.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          data-testid="popup-pause-toggle"
          checked={s.paused}
          onChange={(e) => update((x) => ({ ...x, paused: e.target.checked }))}
          className="size-5 accent-[var(--accent)]"
        />
      </label>
      {muted.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Hidden tip types</p>
          <ul className="space-y-1">
            {muted.map((id) => (
              <li key={id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 text-sm text-fg">
                {POPUP_META[id].label}
                <button
                  type="button"
                  onClick={() =>
                    update((x) => {
                      const m = { ...x.muted };
                      delete m[id];
                      return { ...x, muted: m };
                    })
                  }
                  className="min-h-11 text-xs text-accent-text underline underline-offset-2"
                >
                  Show again
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
