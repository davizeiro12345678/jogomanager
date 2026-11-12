# VPS authoritative multiplayer via Cloudflare Tunnel

Status: staged canary, no automatic production cutover.

## Service boundaries

- Browser/TanStack: logged-in room actions through server functions. Never sends the private match seed or HMAC secret to the browser.
- Supabase: authenticates players, stores rooms, private server seeds, CAS settlement lease, authoritative results and Realtime presentation events. Preserve the existing RLS policies and server-side membership checks.
- 0Ping VPS: runs the canonical deterministic `services/match-aux` simulation on loopback port 3219, with signed HMAC-SHA256 POST requests and anti-replay timestamp checks. Its MongoDB job record is for idempotent replay only; the final room result remains in Supabase.
- Cloudflare Tunnel: `matches-vps.jogomanager.com/v1/simulate` -> `127.0.0.1:3219`. `vps-multiplayer.jogomanager.com/health/live|ready` -> `127.0.0.1:3218`; all other paths return 404.
- Cloudflare Workers: existing wildcard route `*/*` must not intercept the two dedicated tunnel hostnames. Add explicit no-script routes for those hosts if missing. Never expose the Supabase secret key or VPS SSH.

## Canary controls (server-only)

| Variable | Required value |
| --- | --- |
| `MATCH_AUX_ENABLED` | `1` only after all gates pass; otherwise `0` |
| `MATCH_AUX_ROLLOUT_PERCENT` | Initially `0`, then `1`, `5`, `25`, `100` in controlled stages |
| `MATCH_AUX_URL` | `https://matches-vps.jogomanager.com` (exact hostname) |
| `MATCH_AUX_SIGNING_KEY` | Same 32+ character secret on the trusted TanStack server and VPS; use Cloudflare secret binding, never source control |

Any missing, malformed or disabled setting returns to the existing local authoritative replay. A stable per-room bucket prevents mid-match routing changes when percentage stays constant. Do not store these values in Vite client-facing `VITE_*` variables.

## Security and operational gates

1. Verify the tunnel ID and DNS record; confirm Cloudflare connector shows healthy connections and a real HTTPS path to `/v1/simulate`.
2. Test GET `/health/live`, GET `/health/ready`, POST `/v1/simulate` without HMAC (must return 401), invalid body (400) and signed canary simulation with a non-production room ID. Never load-test real settlements or reward writes in production.
3. Re-run deterministic engine, signature replay, modified HMAC, expired timestamp, and unauthorized player tests.
4. Verify a real authenticated canary room flows from TanStack -> VPS engine -> Supabase CAS lease -> done state and Realtime resync, with idempotent repeat.
5. Compare p50/p95/p99, HTTP 4xx/5xx, CPU steal, RAM high watermark, match simulation time, network jitter, Supabase latency, RLS audit, reconnect and settlement correctness.
6. Confirm a working VPS backup, verified TLS tunnel and host integrity (this VPS has a prior root-compromise history). Only then increase rollout.
7. Disable immediately with `MATCH_AUX_ENABLED=0` or percentage `0`, then roll back the Cloudflare binding if health degrades. Do not revoke JWT signing keys as a rollback mechanism.

## Measured pre-rollout baselines (2026-11-12)

Localhost-only wrk tests, 8 seconds each:
- Match health 1 connection: 9,385 requests/s; p99 23.20 ms.
- Match health 32 connections: 21,659 requests/s; p99 7.39 ms.
- Match health 128 connections: 21,066 requests/s; p99 144.32 ms.
- Supabase API liveness 32 connections: 2,637 requests/s; p99 158.28 ms.

These numbers represent cheap health endpoints, not authoritative simulations per second or remote Internet throughput. Eight isolated deterministic matches: mean 597 ms, p95 830 ms, ~29,998 simulation ticks per match. Six existing engine/signature tests passed.

## Release and rollback

No direct edits to the production Cloudflare Worker script are made by this PR. Merge only after TypeScript, lint, test, security and Cloudflare preview checks pass; keep rollout 0% until the external transport and signed match canary are verified. Keep signing keys in a secret manager; rotate on exposure or confirmed compromise.
