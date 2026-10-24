# Product spec — "Kinetic" (Higgsfield-style AI creative studio)

Stack: Next.js (App Router, TS) + Tailwind v4 + lucide-react + motion + zustand. **Read `node_modules/next/dist/docs/` before using Next APIs — this Next version differs from older docs.**

## Product judgement
Higgsfield = model aggregator + opinionated one-click tools + community inspiration. Core loop we ship first:
**see something → remix its prompt in one click → generate → save/share → come back for streak/credits.**
Left out on purpose: enterprise, academy, team, real auth/payments, the agent. State is local (zustand + localStorage) so there is zero signup friction.

## Retention / curiosity hooks (the differentiator)
- **Accent palette switcher** (Lime, Violet, Ember, Ocean) in the header; instant, persisted (localStorage + cookie to avoid flash). Colours are CSS variables only.
- **Daily streak + credit claim** card (Home, header chip). Claim once per UTC day, +credits, streak counter, flame animation.
- **Remix on every card** (one click → /create prefilled and focused). Like button with optimistic count.
- **Surprise me** button: random curated prompt + random model.
- **Trending now** rail with remix counts; "x people remixed this today" social proof.
- Generation wait screen shows rotating tips and a progress shimmer (never a blank spinner).
- First-visit nudge: pre-filled prompt in /create so the first generation is one click.

## Routes
| route | purpose |
|---|---|
| `/` | hero, streak card, Trending rail, tools/apps grid, models strip |
| `/create` | studio: kind (image/video), model, prompt, aspect, reference upload, Generate, result panel. Query: `?prompt=&model=&remix=<postId>` |
| `/explore` | community masonry feed, tag filter chips, infinite scroll, like, remix |
| `/library` | the user's generations (local), delete, re-run, empty state |
| `/pricing` | 3 plans (Free / Pro / Studio), monthly/yearly toggle, credit costs table |

## API (route handlers)
- `GET /api/models` → `[{id,name,kind:'image'|'video',credits,speed}]` (static, cached `s-maxage=3600, stale-while-revalidate`)
- `GET /api/feed?tag=&cursor=&limit=` → `{items:Post[], nextCursor:string|null}`; server-cached (`s-maxage=60, stale-while-revalidate=600`); limit clamped 1..48; unknown tag → empty list not 500; bad cursor → 400
- `POST /api/generate` body `{kind,model,prompt,aspect}` → `{id,url,kind,prompt,model,aspect,createdAt}`.
  Validation: prompt 1..500 chars after trim, model must exist and match kind, aspect ∈ `1:1|16:9|9:16|4:3` else 400 `{error}`.
  Provider: if `FAL_KEY` set use fal, otherwise **mock** (deterministic seeded art from prompt hash; 1.2–2.5 s delay). The mock must be the default and must never crash the demo.
- Post: `{id,kind,title,prompt,model,aspect,author,likes,remixes,tags[],src,poster,createdAt}`; ~48 seeded posts in `src/lib/seed.ts`.

## Credits
Free users start with 50 credits. Image 2–4, video 10–20 per model. Insufficient credits → inline upsell to /pricing, never a dead end. Store: `src/lib/store.ts` (zustand persist): `credits, streak, lastClaim, likes, library[]`.

## Performance rules (no lag)
- Media via `next/image` with explicit width/height or aspect-ratio boxes (zero layout shift), `loading=lazy`, `priority` only for hero. Seed media must render without any network (generated SVG/gradient data URIs or `/public` files); blurred placeholder while loading.
- Videos: `preload="none"`, poster first, play on hover/in-view only (IntersectionObserver), muted, `playsInline`.
- Prefetch `/create` on hover of Remix; in-memory client cache for `/api/feed` pages; skeletons everywhere data loads.
- Respect `prefers-reduced-motion`.

## Responsive
Phone (<640): bottom tab bar (Home, Explore, Create (centre, accent), Library, More), single-column feed, 44px touch targets. Tablet (640–1024): left icon rail, 2–3 col masonry. Desktop (>1024): full left sidebar, 4 col masonry, sticky studio controls. No horizontal scroll at 320px.

## Design tokens (Tailwind classes available everywhere — defined in `src/app/globals.css` `@theme`)
`bg-bg` `bg-surface` `bg-surface-2` `border-line` `text-fg` `text-muted` `bg-accent` `text-accent` `text-accent-fg` `ring-accent`. Dark by default. Accent is driven by `--accent` / `--accent-fg` on `:root[data-accent="lime|violet|ember|ocean"]`.

## data-testid contract (QA relies on this — do not rename)
`nav-home nav-explore nav-create nav-library nav-pricing` · `accent-switcher` · `accent-option-<name>` · `credits-chip` · `streak-claim` · `streak-count` · `prompt-input` · `model-select` · `kind-image kind-video` · `aspect-<ratio>` (e.g. `aspect-16:9`) · `generate-btn` · `result-card` · `gen-error` · `credits-upsell` · `surprise-btn` · `feed-card` · `like-btn` · `remix-btn` · `tag-chip-<tag>` · `library-item` · `library-empty` · `plan-card-<free|pro|studio>` · `billing-toggle`
