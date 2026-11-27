# Public club crest gateway for JogoManager

This is a **read-only canary implementation**, not a production DNS cutover.

## Supported contract

- Only `GET /v1/public/clubs?limit=1000&page=<nonnegative integer>` is exposed by the public reverse proxy. Other routes return 404 or 405.
- The gateway binds to `127.0.0.1:3093`; the Nginx canary binds to `127.0.0.1:8080`.
- It reads only `public.clubs(id,crest_url)` from Supabase PostgREST, with explicit `id.asc` ordering.
- It requires a **Supabase publishable/anon key**. Never use `service_role`, secret keys, user JWTs, cookies, profiles, saves, payments or other private data.
- There is a memory-bounded 32 MiB cache, 900 s fresh TTL and 3600 s stale grace, with background refresh and startup warming. The client remains fail-closed with the direct Supabase fallback.
- Server-side feature flag remains off: `VPS_CATALOG_ENABLED=0`. It must not be exposed as a browser `VITE_*` variable.

## Verified 2026-11-10

Initial local end-to-end read: 38,854 unique clubs, 39 1,000-record pages, 4.91 s cold, 0.047 s warm. These numbers are specific to that historical snapshot; future imports change the count. The test proves local gateway behavior, **not** Cloudflare Tunnel production readiness.

## Critical release gates

1. The source VPS suffered a confirmed prior **root-level compromise**. Do not put Cloudflare Tunnel tokens or additional production secrets on it before a fresh provider-side image, independently verified clean rebuild, access-key rotation, and external backup verification.
2. A different `jm-catalog.service` was installed by another operation on 2026-11-10 at around 19:12 UTC while tests were in progress. Its process used `catalog_gateway.py`, hardcoded `limit=100` and read 8,000 records into a 7,200-record bound; it returned 400/503 to tested calls. Do not overwrite concurrent deployment blindly. Reconcile service ownership and select one implementation before launch.
3. Confirm Cloudflare tunnel `jogomanager-vps-fra-01` has active connectors and a fixed exact ingress only for `catalog.jogomanager.com/v1/public/clubs`, falling back to 404. The tunnel was down with zero connections during tests; its remote ingress route was staged, but no connector secret was installed here.
4. `catalog.jogomanager.com` still pointed to the old public IP `194.163.188.190` at the time of staging. Do not change this DNS until a new tunnel is connected, reachable, and verified with TLS, route restrictions and suitable response timings.
5. Run the smoke test, TypeScript tests `vitest run src/lib/vps-public-catalog.server.test.ts`, typecheck and CI on the exact branch. Compare live Supabase compute CPU, memory, IOPS and query volume for matching windows before/after canary, and measure cache misses, p95 and fallbacks.
6. Switch the server-only flag for a limited canary, never the whole audience at once. Roll back instantly with `VPS_CATALOG_ENABLED=0`.

## Deployment on a clean host

Install `gateway.py` and `jm-catalog.service` from this directory. Set `SUPABASE_PUBLISHABLE_KEY` securely in an `EnvironmentFile` restricted to the service account, using only the public key. Install the Nginx `jm-catalog.conf`, test with `nginx -t`, then reload. Verify with:
```sh
curl -fsS 'http://127.0.0.1:8080/v1/public/clubs?limit=1000&page=0'
python3 infra/vps/catalog/smoke_test.py
```
The host may need to copy `smoke_test.py` to a local test path. Never deploy a tunnel credential through repository files, chat messages, application logs or command history.
