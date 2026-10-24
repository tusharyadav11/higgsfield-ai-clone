# Device QA Report

Run against production builds (`next build` + `next start`, port 3711). Nothing is committed.

Run it: `npx playwright test -c playwright.devices.config.ts`
Env: `QA_PORT` (default 3711), `DEVQA_ONLY="iPhone SE,Pixel 7"` (substring filter), `DEVQA_BROWSERS=chromium,firefox,webkit` (default chromium), `DEVQA_SHOTS=<dir>` (full-page PNG per route and overlay), `DEVQA_WORKERS`.

Files added: `playwright.devices.config.ts`, `tests/e2e/devices.spec.ts`.

## Result of the final run (after fixes)

| Engine | Projects | Passed | Failed | Skipped |
|---|---|---|---|---|
| Chromium (device descriptors + custom viewports) | 25 | 775 | 0 | 25 |
| Firefox 1440x900 | 1 | 21 | 0 | 11 |
| WebKit (desktop 1440x900, iPhone SE, iPad Pro 11, real engine) | 3 | 54 | 0 | 42 |
| **Total** | 29 | **850** | **0** | 78 |

Skips are intentional:
- CLS and colour-contrast checks run on Chromium only (layout-shift entries and oklab/color-mix canvas parsing).
- The focus-ring check is skipped on WebKit, which does not Tab to links and buttons by default.
- The user-menu overlay is skipped when the menu is not rendered at that width (the 12 narrow phone projects use the `logout-btn-mobile` item in the More sheet).
- The More sheet exists only below the `sm` breakpoint, so it is skipped on the other 17 projects.

Other suites after the fixes:
- `npx tsc --noEmit` clean.
- `npx eslint src` clean.
- `npx vitest run`: 110/110 pass (9 files).
- `npm run test:e2e` (QA_PORT=3721): 394 pass, 2 failed, 6 skipped. Both failures passed when re-run alone: `auth.spec` referral link flow (a 1.2 min timeout while the shared DB was busy) and `engage.spec` "reset helper" (the first-visit tour toast raced the popup). Neither touches code I changed. Another agent was editing engage and theme files in the same tree while I ran.

### Matrix (every project: 12 routes, search palette, help menu, shortcuts dialog, tour steps, tour-offer toast, assistant, job tray, job toast, user menu, colour picker, More sheet, focus ring, CLS, contrast with lime and dark-blue #0b1f5c)

| Device | Result |
|---|---|
| iPhone SE 320x568 | PASS (31/31) |
| iPhone 13 Mini | PASS |
| iPhone 14 | PASS |
| iPhone 15 Pro Max | PASS |
| iPhone 14 dark / light / reduced-motion | PASS / PASS / PASS |
| Pixel 5 | PASS |
| Pixel 7 | PASS |
| Galaxy S9+ | PASS |
| Galaxy S8 landscape | PASS |
| Galaxy Fold folded 280x653 | PASS |
| Phone landscape 844x390 | PASS |
| iPad Mini | PASS |
| iPad (gen 7) | PASS |
| iPad Pro 11 | PASS |
| Galaxy Tab S4 | PASS |
| Laptop 1024x768 | PASS |
| 1280x720 | PASS |
| Windows laptop 1366x768 | PASS |
| MacBook Air 1440x900 (DPR 2) | PASS |
| MacBook Pro 14 1512x982 (DPR 2) | PASS |
| MacBook Pro 16 1728x1117 (DPR 2) | PASS |
| 1920x1080 | PASS |
| 2560x1440 | PASS |
| Firefox 1440x900 | PASS (21 run) |
| WebKit 1440x900 | PASS (18 run) |
| WebKit iPhone SE | PASS (18 run) |
| WebKit iPad Pro 11 | PASS (18 run) |

All 12 requested Playwright registry names exist in 1.64.1 and were used; none were skipped. Registry device descriptors (viewport, DPR, UA, touch) run on the Chromium engine, so Safari-only behaviour is covered by the three WebKit projects.

What each check asserts (all `expect.soft`, so every offender is listed):
- No horizontal overflow (`documentElement` and `body` scrollWidth).
- No visible element crossing the left or right edge, excluding clipped scroll or marquee ancestors.
- Interactive elements are at least 44x44 on touch and 24x24 on desktop (inline text links are exempt, per WCAG 2.5.8).
- No clipped text (overflow hidden with scrollWidth > clientWidth; ellipsis and line-clamp are exempt).
- `elementFromPoint` at CTA centres, and at the Generate label corners.
- Header pinned after scrolling to the bottom.
- The last content element is not hidden behind the bottom bar, after infinite scroll settles.
- Images and video are not distorted: rendered aspect within 2% of intrinsic, or `object-fit`.
- Focus indicator on the first 10 Tab stops.
- Text contrast (4.5:1, or 3:1 for large text) in lime and dark-blue accent.
- Overlays fit the viewport, including a half-height "keyboard open" viewport.
- Console errors and hydration warnings.
- CLS < 0.1 on `/` and `/explore`.

## Bugs found and fixed

Evidence is from the first matrix run on iPhone SE and the full device run, unless noted.

| # | Route or overlay | Devices | Evidence | Fix (files) |
|---|---|---|---|---|
| 1 | All routes with `text-accent` | all, custom dark accent | `#0b1f5c` accent gave 1.2-1.3:1 for the active tab label, "See Enterprise", "50 credits to start...", aspect chips, links | New `--accent-text` token (`globals.css`, `--color-accent-text`), computed in `lib/color.ts` (`accentTextColour`, lifted to 5.5:1 on the app bg), also set by `ACCENT_BOOT_SNIPPET` and cleared by `clearCustomAccent`. All 62 `text-accent` uses across 26 files became `text-accent-text`. `bg-accent`, rings and borders are unchanged. |
| 2 | Help menu inside the phone More sheet | phones | The popup rect was -167..73 x 445..675 on 320x568, off-screen left and bottom | `HelpMenu` gets `placement="up-start"`, used by `Nav.tsx`: opens above, left aligned. Menu gets `max-w-[calc(100vw-1rem)]` (`guide/index.tsx`). |
| 3 | `/create` while generating | 280px Fold | The grid column was min-content wide, so the form and result card were 315px in a 280px viewport (job tray screenshot shows clipped panels) | `create-studio.tsx`: `grid grid-cols-1` (the default `1fr` column is `minmax(auto,1fr)`). |
| 4 | Colour picker | 320x568 | Hue slider only 28px tall. Theme toggle (another agent's, in the popover) was `size-9` | `ColorPicker.tsx`: slider hit area `h-11` (visual track unchanged via transparent `border-y-8` + `bg-clip-padding`). `ThemeToggle.tsx` compact `size-11`. |
| 5 | Assistant panel | 844x390 and Galaxy S8 landscape, keyboard open | Input off-screen: the panel max-height was `100dvh-10rem`, about 35px at 195px viewport height | `Assistant.tsx`: `sm:max-h-[calc(100dvh-6rem)]` and a `max-height:500px` variant that docks beside the FAB with `max-h-[calc(100dvh-1rem)]`. FAB is 44px on phones (`size-11 sm:size-12`). |
| 6 | Touch targets below 44px | phones, tablets | Billing toggle 56x36; usage range chips 36px; budget input 40px; notification switches 48x28; enterprise preset "5" 43px; "or email us" 20px; home ticker pills 38px; assistant buttons and chips 36-40px; shortcuts dialog close 40px; job toast and welcome dismiss 36px; search palette chips 36px; Palette "Esc" on touch tablets; WebKit `<select>` ignored `min-h` | `PricingView` and `SettingsView` switches wrapped in a 44px hit area with the same visual track; `UsageView` chips, input and CTAs to `min-h-11`; `QuoteForm` link `inline-flex min-h-11`; `EnterpriseView` `min-w-11`; `home-extras` ticker `min-h-11`; `Assistant`, `guide/index` (dialog close), `jobs/index`, `WelcomeBanner` to 44px; `Palette` Esc `pointer-coarse:sm:min-h-11`; model select `h-11 min-h-11`; unused `AccentSwitcher` `size-9` removed. |
| 7 | Settings Theme card | 280px | `ThemeToggle` "Light Dark System" overflowed: 3 labels with `px-3` | `ThemeToggle.tsx`: labels become `sr-only` and padding 0 below 360px (icons stay 44px). |
| 8 | Ultrawide 1920 / 2560 | 1920x1080, 2560x1440 | A 1230px column floats in about 2400px: tiny type, large empty gutters (2560 screenshots) | `globals.css`: root font-size 112.5% at 1920px and 125% at 2400px, so rem type, spacing and `max-w-*` containers scale. `/usage` container aligned to `max-w-7xl` like the other pages. `/connect` desktop padding aligned to `sm:px-6`. |
| 9 | Home "Result" badge and compare slider | desktop, Pixel 7 (observed mid-run) | `.cmp` computed `transform: translateX(57..299px)` and the Result pill clipped at the right. A stale chunk defined a second `@keyframes sweep{to{transform:translate(120%)}}` that collided with the slider's `sweep`. Another agent has since renamed it to `mv-sweep` in `motion.css`. | No change by me. Re-verified: `.cmp` transform is `none` on a fresh build. **Watch for animation-name collisions between `globals.css` and `motion.css`.** |

Test-harness corrections made during the run (not app bugs): the colour picker panel is measured by its `role=dialog` (not the inner `accent-picker` content); infinite scroll is allowed to settle before the "last content reachable" check; contrast sampling understands absolutely positioned pill backgrounds (explore tag chip) and `sr-only` spans; the assistant-FAB check asserts that the Generate label is not covered, via `elementFromPoint` as the brief specified, instead of any bounding-box intersection.

## Unfixed or accepted

- The assistant FAB, a fixed floating button at the bottom right, can sit over the right end of full-width content (login "Continue as guest", Generate, usage text) on phones while scrolling. It never covers a CTA centre or label (asserted), and I only shrank it to 44px. Hiding it per route would break `assistant-toggle` users in other specs. Possible follow-up: auto-hide while scrolling down.
- Explore tag chips wrap to two rows on iPad Pro 11, but scroll horizontally on phones. Cosmetic.
- The header theme menu is hidden below 360px by design. Theme remains available in Settings.
- Full-page screenshots show fixed bars (tab bar, FAB) mid-image. That is a Playwright full-page artefact, not an app bug. Visual review used viewport-sized shots.
- A Safari-specific `:focus-visible` check is not possible with Playwright WebKit, which does not Tab to buttons.
- Firefox and WebKit installed fine (`npx playwright install firefox webkit`). Real iOS Safari, Samsung Internet and a physical on-screen keyboard cannot be tested here, so the keyboard-open states are simulated by halving the viewport height.

## Screenshots

`/private/tmp/claude-502/-Users-tusharyadav-Desktop-higgsfield-ai-/43fc4e18-1c97-4e20-a043-5698e55ab4f7/scratchpad/shots/<device>/<route>.png` (12 routes plus overlay shots, 29 projects). Viewport shots reviewed by eye for iPhone SE, Pixel 7, iPad Pro 11, 1366x768, 1440x900 and 2560x1440 are in `.../scratchpad/vp/`.

## Commit-ready diff summary

- `src/lib/color.ts`: `accentTextColour()`; `--accent-text` set in preview, boot snippet and clear.
- `src/app/globals.css`: `--accent-text`, `--color-accent-text`, ultrawide root font-size.
- 26 `.tsx` files: `text-accent` to `text-accent-text`.
- `src/components/shell/Nav.tsx` and `src/components/guide/index.tsx`: HelpMenu placement and sizing, 44px dialog close.
- `src/components/guide/Assistant.tsx`: 44px controls, short-viewport layout, FAB size.
- `src/components/guide/Palette.tsx`: coarse-pointer 44px Esc and chips.
- `src/components/features/create-studio.tsx`: `grid-cols-1`, select `h-11`.
- `src/components/features/home-extras.tsx`: ticker `min-h-11`.
- `src/components/growth/{PricingView,SettingsView,QuoteForm,EnterpriseView,WelcomeBanner}.tsx`: 44px hit areas.
- `src/components/usage/UsageView.tsx`: 44px chips, input and CTAs.
- `src/components/jobs/index.tsx`: 44px toast dismiss.
- `src/components/color/ColorPicker.tsx`: hue slider 44px hit area.
- `src/components/ui/ThemeToggle.tsx`: compact 44px, narrow label collapse.
- `src/components/shell/AccentSwitcher.tsx`: `size-9` removed.
- `src/app/usage/page.tsx` and `src/app/connect/page.tsx`: container alignment.
- Added: `playwright.devices.config.ts`, `tests/e2e/devices.spec.ts`, `DEVICE-QA-REPORT.md`.
