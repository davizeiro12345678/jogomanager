# Auxiliary MongoDB bridge (production function deployed; network not yet proven)

## Verified infrastructure snapshot, 2026-10-24

- Existing cluster: Atlas `Cluster0` on AWS `SA_EAST_1`, instance type `FREE`, MongoDB `8.0.34`; it was **not** necessary to create or pay for another cluster.
- Auxiliary database: `jogomanager_aux`, with three **empty** collections (`game_jobs`, `request_metrics`, `purchase_audit`), and four secondary indexes.
- The existing Atlas IP access list permits one IPv4 /32 entry only. Supabase Edge outbound traffic has no static source IP, so direct Atlas connectivity remains **unverified / likely blocked**. **The bridge is not connected end-to-end.**
- Public purchase, Auth and career endpoints remain unchanged. Mongo does not replace Supabase Postgres Auth/RLS, Stripe verification, or the authoritative game state.

## Deployment, secrets and network

The `supabase/functions/mongodb-aux/index.ts` handler exposes only authenticated `GET /health`.
**Supabase production Edge Function `mongodb-aux` version 1 was deployed with gateway JWT verification enabled** and performs a second user verification with Supabase Auth.
An Atlas database user `jogomanager_aux_prod_rw` was created with `readWrite` access **only** to `jogomanager_aux` on `Cluster0`.
The generated MongoDB URI was stored encrypted in Supabase Vault as `mongodb_aux_uri_production` (not in Git). At runtime, the Edge Function queries the Vault via backend-only `SUPABASE_DB_URL` and a single PostgreSQL pool connection. This prevents a new exposed RPC/secret environment variable.
The Vault entry's URI shape was checked without revealing its contents. No authentication tokens or DB credentials are shipped to browsers.

Atlas Free requires IP-based access control. **Supabase Edge Functions do not have static egress IPs.** Do **not** open `0.0.0.0/0` just to allow unknown serverless egress addresses. The network requires a safe outbound proxy with a static IP or another explicitly approved architecture within R$ 39/month. Until then, an authenticated `GET /health` may return HTTP 503. No broad Atlas allowlist changes were made and no user-visible payment/auth/game path was rerouted.

## Domain responsibilities

| Capability | Authority | Possible auxiliary use |
| --- | --- | --- |
| Auth and sessions | Supabase Auth + RLS | Aggregated operational counters, no tokens |
| Stripe purchases | Verified webhook, Postgres ledger | Redacted audit identifiers, best effort, never checkout source-of-truth |
| Match outcomes and saves | Authoritative simulation and Postgres | Optional non-authoritative job status |
| Read-heavy requests | Cloudflare cache and existing API | Time-limited request observations |

A MongoDB Free cluster is a **database**, not a CPU server that can execute a persistent game loop. A separate compute worker must implement simulations and rate limiting if required.

## CSS and build migration

The homepage retains Tailwind v4 and the global theme. Two content blocks were moved into a feature folder; the interactive tactical board has its own scoped **CSS Module** and is loaded with React `lazy` below the fold. Its dynamic SVG positions use React inline CSS styles (zero added CSS-in-JS runtime). Avoid installing a runtime CSS-in-JS framework simply to rewrite static CSS, since it can increase JS/hydration work.

**Turbopack is not an interchangeable Vite plugin.** This repository uses TanStack Start, Vite and custom Rolldown/WebGPU/Rapier plugins. Migrating to Next.js to gain Turbopack would be a separate framework migration with larger blast radius; the existing code splitting should be measured first.

## Acceptance gates, no fabricated speedups

1. `npm ci && npm run lint && npm exec -- tsc --noEmit --pretty false && npm test`
2. `PFM_LOCAL_VERIFY=1 npm run build && npm run bundle:report && npm run bundle:check`
3. Compare baseline and candidate **compressed route-level JS/CSS**, initial LCP, TBT/INP, CLS, worker startup, and source maps on identical environments.
4. Test accessibility of the formation buttons, SSR/hydration, motion preferences and navigation with JS disabled.
5. Run controlled Atlas write/read/delete smoke test and authenticated Bridge health test from a network that is **explicitly** allowlisted.
6. Load-test with k6/Artillery on an isolated preview, ramping until p95 or error-budget fail; do not translate 500 DB connections into 500 concurrent players.

Do not merge/deploy the homepage optimization until all required quality gates and budget checks pass. The production **MongoDB diagnostic Edge Function is deployed**, but the homepage optimization, purchase/auth redirect, and gameplay processing are **not deployed** through it. End-to-end connectivity, load-tested player capacity and real traffic metrics are still unverified.
