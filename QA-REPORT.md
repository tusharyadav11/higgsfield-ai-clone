# QA Report

Run against production build (`next build` + `next start`, port 3217).

| Suite | Pass | Fail |
|---|---|---|
| Vitest (tests/unit: API handlers + store) | 25 | 0 |
| Playwright (desktop/tablet/phone, 47 specs x 3) | 132 | 9 (3 distinct bugs x 3 viewports) |

Run: `npm run test:unit`, `npm run test:e2e`, `npm test`.
(First e2e run needs `npx playwright install chromium`.)

## Open bugs

### 1. Cmd/Ctrl+Enter in the prompt does not submit — Medium — owner: implementer
- Test: create.spec.ts "keyboard: Ctrl/Cmd+Enter submits"
- Repro: /create, focus `prompt-input`, press Ctrl/Cmd+Enter.
- Expected: generation starts, `result-card` appears. Actual: nothing happens. `src/components/features/create-studio.tsx` has no onKeyDown handler on the textarea.

### 2. Plain Enter in the prompt does not submit — Low (arguably by design for a textarea) — owner: implementer
- Test: "keyboard: Enter in prompt submits". Same repro with Enter. If Enter is meant to insert a newline, drop this test; Cmd/Ctrl+Enter (bug 1) is still required.

### 3. Saved accent is not in server-rendered HTML — Low/Medium — owner: design (layout/shell)
- Test: theme.spec.ts "accent switch ... SSR has no flash"
- Repro: set accent=violet (cookie `accent=violet` is written), request `/` or `/explore` with that cookie.
- Expected (SPEC: "localStorage + cookie to avoid flash"): `<html data-accent="violet">`. Actual: always `data-accent="lime"`; pages are prerendered static, so `cookies()` in layout.tsx has no effect.
- Impact: no visible flash today because an inline script applies localStorage before paint (the before-first-paint test passes). With JS disabled/delayed, or if localStorage is blocked, the default shows. The cookie is effectively dead code.

## Notes (not failures)
- Earlier in the session `next build` failed on `/_not-found` ("uncached data ... outside Suspense", root layout `await cookies()`). It built cleanly on a later attempt after the other agents' edits; watch for it recurring.
- Test fixes made for test errors (not app bugs): likes of counts >=1000 render as "3.1k" so the +1 check uses a card with an exact count; decorative `alt=""` allowed except for the primary card image; setCredits seeds the `kinetic-store` key because zustand persist writes lazily.
- Passing coverage includes: all routes 200, no console errors/hydration warnings (prod build), nav at all 3 viewports, no horizontal scroll at 320px, image dimensions/alt, CLS < 0.1, video attrs, claim-once streak, generate -> library, credits deduction, upsell, gen-error on 500/400/abort with no charge, double-click single charge, tab order to generate-btn, remix prefill, like, tag filter, infinite scroll, pricing toggle, empty library.
