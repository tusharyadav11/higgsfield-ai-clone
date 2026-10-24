# Kinetic

An AI creative studio in the spirit of Higgsfield: see something, remix its prompt in one click, generate an image or video, save it, and come back for the daily streak. Includes accounts, credits, referrals, an MCP server for agents, and an enterprise quote form.

**Stack:** Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, zustand, Postgres via drizzle-orm + postgres-js, vitest, Playwright.

## Two modes

| | no `DATABASE_URL` (demo) | with `DATABASE_URL` |
|---|---|---|
| Guests | local only (localStorage) | local only, zero friction |
| Accounts | browser-only demo accounts | real accounts in Postgres (scrypt, httpOnly session cookie) |
| Credits / streak / library / likes | localStorage | server ledger; guests' local data is merged in at signup |
| Referrals | local demo ledger | DB, both sides credited instantly |
| MCP keys | demo keys, any `kn_...` accepted | keys stored as sha256, revocable, billed to the owner |
| Enterprise quotes | logged to console | `quotes` table |

The UI says which mode it is in. The whole app works in either.

## Environment

See `.env.example`. `DATABASE_URL` (optional), `FAL_KEY` (optional real image provider; otherwise a deterministic mock), `MCP_REQUIRE_REAL_KEYS=1` (optional, refuse unknown MCP keys).

## Run

```bash
npm install
cp .env.example .env.local     # or delete DATABASE_URL for demo mode
createdb kinetic && npm run db:migrate
npm run dev                    # http://localhost:3000
```

## Database

- Schema: `src/db/schema.ts`; migrations: `drizzle/`.
- `npm run db:migrate` applies migrations (drizzle-kit reads `DATABASE_URL` from `.env.local`). `npm run db:push` syncs the schema directly (dev only). `npm run db:generate` creates a migration after a schema change.
- Balance is `SUM(credit_ledger.delta)`; the ledger is append-only and `unique(user_id, reason, ref)` makes every grant idempotent (signup bonus, daily claim per UTC date, referral grants, refunds). Charges lock the user row, so concurrent generates can never overspend.
- `next build` does not touch the database, with or without `DATABASE_URL`.

## Tests

```bash
npm run test:unit   # vitest; tests/unit/db/** use a separate database `kinetic_test`
npm run test:e2e    # Playwright (builds and starts the app; auth specs need DATABASE_URL)
```

Create the test DB once with `createdb kinetic_test`; migrations are applied automatically and tables are truncated between tests. If Postgres is unreachable the DB tests are skipped with a message. Never point `TEST_DATABASE_URL` at a database you care about.

## Deploy (Vercel + Neon)

1. Create a Neon project and copy the **pooled** connection string.
2. In Vercel add `DATABASE_URL` (and optionally `FAL_KEY`).
3. Run `DATABASE_URL=<neon url> npm run db:migrate` once (locally or in CI) before the first deploy and after schema changes.
4. Deploy. Session cookies are `Secure` automatically on https.

## Demo limits (be honest)

- No email verification or password reset; lockout is per account (5 failures, 60 s), not per IP. Add rate limiting at the edge before real traffic.
- Payments are not implemented; plans and promo codes are display-only (WELCOME20 redemption is recorded).
- Guest credits imported at signup are client-reported, so they are capped (50) and imported once per account. Creating many accounts is not prevented.
- Without `FAL_KEY` generation is a deterministic mock; videos always come from the bundled library.
- The MCP rate limit is in-memory per instance.
