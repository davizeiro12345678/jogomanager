# Public catalog bridge deployment (VPS)

This module is deployed into `/opt/jm-supabase-server/local-catalog.mjs` as part of the VPS-only bridge. It is deliberately not bundled into the browser or the Cloudflare Worker. The Supabase production database remains the authoritative store.

## Production verification on 2026-11-12

- Local PostgreSQL: 18.7, `shared_buffers=4GB`, `effective_cache_size=24GB`, loopback-only TCP/Unix socket.
- Read-only OS/database role: `jmsbapi` over local peer-authenticated Unix domain socket. Role has SELECT on `jm_cache` and no INSERT/UPDATE/DELETE.
- Synchronization: 2,033 competitions; 38,854 clubs; 196,235 RLS-visible athletes. Other 5,442 player records were not copied.
- `jm-catalog-mirror.timer`: enabled, hourly. `jm-player-mirror.timer`: enabled, twice daily.
- `pg@8.23.1` installed via pinned npm dependency (audit: 0 vulnerabilities) in `/opt/jm-supabase-server`.
- The VPS-only `server.mjs` route `GET /v1/competitions` now reads `cachedCompetitions(limit)` first when `JM_LOCAL_CATALOG_ENABLED=1` and the snapshot is less than three hours old. If unavailable or stale, it transparently uses the existing Supabase API request.
- Validated with the unprivileged API user: 30/30 cache queries succeeded, p50 0.753 ms and p95 1.052 ms; initial synthetic HTTP smoke test returned HTTP 200 and `x-jm-catalog-source: local`. The actual bridge remained online after restart.
- The original VPS `server.mjs` was saved to `/var/backups/jm-postgresql/server.mjs-pre-local-cache-20261112` with restricted permissions.

## Clean installation

1. Install the `jm_cache` schema **only** into the VPS database `jogomanager_local` and perform the validated public-only snapshot synchronization before enabling timers.
2. Add `pg@8.23.1` to the private Node bridge using `npm install --save-exact --ignore-scripts pg@8.23.1` and run `npm audit --omit=dev`.
3. Copy `local-catalog.mjs` beside the existing private `server.mjs`. Keep `pg` import and cache logic server-side only.
4. In the private bridge, import `cachedCompetitions` and use the guarded read before the remote Supabase read in the public competitions route. Return the same `{competitions: [...]}` response shape. Do not alter authenticated career endpoints.
5. Set `JM_LOCAL_CATALOG_ENABLED=1` only in the `jm-supabase-api.service` systemd environment, then restart **only** this service.
6. Verify HTTP 200 and the `x-jm-catalog-source: local` response header; also confirm auth endpoints still require a JWT and the match engine remains healthy.
7. For emergency rollback, set `JM_LOCAL_CATALOG_ENABLED=0`, reload the unit and restart the private bridge. To undo the code patch, restore the restricted `server.mjs` backup and restart the service. Never roll back or change the hosted Supabase database during this step.

## Limits and security

Only the public competitions route currently uses the local cache at runtime. Clubs and public players are mirrored and indexed locally but have not been wired to additional public endpoints. Do not expose private room results, access tokens, financial data or service-role keys through this cache. The 30-request local latency sample is *not* a throughput benchmark. The ClamAV scan is independent and must not be interpreted as clean before its final report.
