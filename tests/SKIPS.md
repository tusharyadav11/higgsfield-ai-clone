# Skipped tests: inventory and reasons

There are no `test.fixme`, `it.skip`, `describe.skip` or unconditional skips in the repo. Every skip is conditional and has a stated reason.

## Environment-conditional (run by default in this repo)

| Where | Skips when | Why it can run here |
|---|---|---|
| `tests/e2e/auth.spec.ts` (all), `tests/e2e/usage.spec.ts` (signed-in block) | `/api/auth/me` reports `db: false` (no `DATABASE_URL`) | `.env.local` points at the local Postgres (`postgres://localhost:5432/kinetic`), so `next start` has accounts enabled and they run. Without a database the app is in demo mode and these flows do not exist. |
| `tests/unit/usage-db.test.ts`, `tests/unit/db/*.test.ts` | Postgres at `TEST_DATABASE_URL` (default `postgres://localhost:5432/kinetic_test`) is unreachable | They run against the local `kinetic_test` database. Set `REQUIRE_TEST_DB=1` (or `CI`) to turn an unreachable database into a hard failure instead of a skip. |

## Device-conditional (legitimate, always skipped on the listed projects)

| Spec | Skipped on | Reason |
|---|---|---|
| `tests/e2e/color.spec.ts` (phone picker) | desktop, tablet | The bottom-sheet colour picker exists only in the phone layout. |
| `tests/e2e/theme-mode.spec.ts` "light-mode screenshots" | tablet | It captures reference screenshots at two viewports only (1440x900 desktop, 390x844 phone); a tablet capture would add no coverage. |
| `tests/e2e/devices.spec.ts` focus ring | WebKit | Safari does not Tab to links and buttons by default (system setting), so a Tab-order focus check cannot work. |
| `tests/e2e/devices.spec.ts` CLS | Firefox, WebKit | `layout-shift` performance entries are Chromium-only. |
| `tests/e2e/devices.spec.ts` colour contrast | Firefox, WebKit | Canvas parsing of oklab / `color-mix` colours is verified on Chromium. |
| `tests/e2e/devices.spec.ts` user menu overlay | narrow phones | The header user menu is not rendered below its breakpoint; those devices use `logout-btn-mobile` in the More sheet. |
| `tests/e2e/devices.spec.ts` More sheet overlay | `sm` and wider | The More sheet only exists below the `sm` breakpoint. |
| `tests/e2e/leftovers.spec.ts` FAB auto-hide | desktop, tablet | The assistant FAB only auto-hides below the `sm` breakpoint. |
