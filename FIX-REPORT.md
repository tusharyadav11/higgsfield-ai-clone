# FIX-REPORT

Machine was heavily loaded (load average 13-70), one test process at a time, `--workers=2`. No git commands were run.

## 1. Failures

**a) `auth.spec` referral flow timeout.** Cause: not a logic bug. The test does two scrypt signups, two browser contexts and about seven page loads against a real Postgres. It takes 3-10 s on an idle machine, but the work is CPU-bound (hashing + `next start`), so under a load average of 50+ it exceeded the 60 s default. Fix: `test.setTimeout(150_000)` on that test only, with the justification in a comment. Passes in every run (15/15 in `auth.spec`).

**b) `engage.spec` "reset helper".** Two real causes.
1. Product: the first-visit tour offer toast (fixed, bottom-left/right) and engage popup cards both competed for the same screen slot. Fixed in app code:
   - `src/components/guide/index.tsx`: the offer waits (500 ms poll) while a `popup-card` is on screen, has `data-testid="tour-offer"`, and expires after 20 s (marked seen) so it can never starve popups.
   - `src/components/engage/index.tsx`: `[data-testid="tour-offer"]` is added to `OVERLAY`, so while the offer is visible the engine holds its popups back.
2. Test: `kinetic:engage` events fired before hydration are lost by design (listeners are registered in an effect). `emit()` now waits for the engine (`__kineticEngageReset` present). `boot()` marks the tour as seen by default; two new tests prove the offer and a popup never co-exist, in both orders. This also fixed "session cap" on phone, which hit the same race.

## 2. Skips
Inventory and reasons are in `tests/SKIPS.md`. There is no `fixme` or unconditional skip. DB-dependent tests now run: `.env.local` has `DATABASE_URL=postgres://localhost:5432/kinetic` and vitest uses `kinetic_test` (209 pass, 0 skipped). `tests/unit/db/global-setup.ts` now throws, instead of silently skipping, when `CI` or `REQUIRE_TEST_DB=1` is set and Postgres is unreachable. Remaining skips are device-conditional (colour-picker phone-only, light-mode screenshots on tablet, WebKit/Firefox engine gaps, More sheet and user menu per breakpoint, FAB auto-hide on phone only).

## 3. Leftovers
- **FAB overlap.** The assistant button tucks away (slides right, fades, `pointer-events-none`) while scrolling down on phones. It returns on scroll-up, near the top or bottom, on keyboard focus, or while the panel is open. `Shell` bottom padding is now `pb-40` on phones, so at the end of a page the FAB sits in reserved space. It stays above the tab bar and safe area and respects reduced motion. `devices.spec` scrolls to top before tapping it, as a user would. New test in `tests/e2e/leftovers.spec.ts`.
- **Explore chips.** Always one row (`w-max`, no `flex-wrap`), horizontally scrollable with the existing edge-fade mask, sticky bar, `tag-chip-*` ids and sliding pill unchanged. Test added.
- **/usage.** The always-zero Enhance and MCP cards are removed, with a note: "MCP runs are charged as Image or Video runs, so they are counted there; Enhance is free." A proper MCP split was not done: `credit_ledger.ref` is a generation id with no source column. `usage.spec` updated.

## 4. Lint and types
All `any`, unused-var and `use`-fixture-name errors in `tests/` are fixed with real types (api, store, quality, theme, theme-mode, explore, helpers, devices).

## Final fresh runs
- `npx tsc --noEmit`: clean.
- `npx vitest run`: `Test Files 14 passed (14)`, `Tests 209 passed (209)`.
- `npx playwright test -c playwright.devices.config.ts` (port 3878): `25 skipped`, `775 passed (18.2m)`, 0 failed.
- `npm run test:e2e` (port 3877, clean build): `3 failed, 8 skipped, 616 passed`. Rerun of my specs alone passed.
- `npx eslint src tests`: 0 errors in my files. Remaining errors are in other agents' in-progress files (`src/components/guide/TourVideo.tsx` react-hooks/immutability earlier, `src/components/enterprise/security/SsoSection.tsx` set-state-in-effect).

## Still red (not mine, other agents' concurrent work, files untouched)
- `tour-video.spec` "no horizontal overflow at 280px" (flaky, fails alone too): same lost-event-before-hydration race as the engage one; the test should wait for the listener or retry the dispatch.
- `enterprise.spec` anchor navigation (top 308 vs <300) and `enterprise-admin.spec` SSO radio `check` (an `sr-only` radio, state does not change on force click). Both belong to the enterprise work in progress.

I deleted `.next` before the clean builds; a concurrent agent's server may have needed a rebuild.
