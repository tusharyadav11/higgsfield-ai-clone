# Design rationale

- **Dark, high-contrast canvas, one loud accent.** Generated media is the hero; neutral surfaces make it pop, and a single accent (Lime/Violet/Ember/Ocean) marks the primary action everywhere. Accent text colours are chosen for WCAG AA against `--accent-fg`.
- **Accent switcher in the header.** Cheap personalisation creates ownership and a reason to poke around. It persists in a cookie (read server-side, so no flash) and localStorage.
- **Credits chip always visible.** A constant, tappable reminder of balance fuels the claim-streak loop and makes the upsell feel natural.
- **Centre Create button on phones.** The loop is see, remix, generate; the primary verb sits under the thumb.
- **Motion with purpose.** Skeleton shimmer instead of spinners keeps the wait feeling alive; the flame pulse rewards streaks. All motion collapses under `prefers-reduced-motion`.
- **Ergonomics.** 44px targets, safe-area padding, a single responsive nav (bottom bar, rail, sidebar), no horizontal scroll at 320px.
