# VPS public-catalog canary

Status: **off by default**. This change does not switch production traffic,
user accounts, matches, purchases or saves.


## Frankfurt canary status (2026-11-10)

- Live VPS gateway: `jm-catalog.service` on loopback `127.0.0.1:3093`, with Nginx allowlisting `GET /v1/public/clubs` on `127.0.0.1:8088`; deny all other public routes and methods.
- Cloudflare DNS: proxied CNAME `catalog-vps.jogomanager.com` targets the dedicated `jogomanager-vps-fra-01` tunnel. The existing `catalog.jogomanager.com` DNS was NOT changed.
- Cloudflare ingress: only `catalog-vps.jogomanager.com -> http://127.0.0.1:8088`, followed by a 404 fallback.
- **Tunnel connector currently disconnected (0 connections).** No production client traffic has been switched. Connector activation requires a trusted clean OS and securely installed tunnel credentials; never commit the token.
- Supabase has 38,854 public clubs (Nov 10). An actual loopback smoke test returned page 0 (1,000), page 38 (854), page 39 (0). Cold rebuild ~3.27 s and cached response ~5 ms, both local measurements only.
- The frontend canary remains **off by default**. It now supports 1,000-row pages up to 80 pages, an explicit staging-host allowlist and a 10-second request budget, with Supabase fallback on errors or truncated snapshots.
- The anonymous gateway uses only the Supabase publishable key, never a service-role credential; 32 MiB maximum in-memory cache, 300-second TTL. 
- Preserve the existing production hostname and fallback until end-to-end HTTPS, JWT/cookie stripping, rate limits and Supabase load comparison are verified on a clean connector host.

## Topology

```
TanStack Start server --(GET public catalog over HTTPS)--> Cloudflare Tunnel
         |                                                |
         |                                                v
         |                                  restricted /v1/public/clubs
         |                                                |
         |                                                v
         |                                  Nginx 127.0.0.1:8088 => gateway 127.0.0.1:3093
         |                                                |
         |                                                v
         |                                   Supabase public REST API
         |
         +-- on any failure/timeout/incomplete response --> Supabase public API
```

The Frankfurt VPS canary uses a dedicated `jm-catalog.service` listening on
`127.0.0.1:3093`, with Nginx at `127.0.0.1:8088`. Its cache is bounded to
32 MiB with a 300-second TTL and serves only public `clubs(id,crest_url)` projections.
The prior `127.0.0.1:3092` diagnostic service is not the catalog gateway.
It must not cache JWT-dependent content, permissions, balances, saves,
payments, or user-specific responses.

## Environment switches (server only)

- `VPS_CATALOG_ENABLED=0`: default, always query the Supabase public client.
- `VPS_CATALOG_ENABLED=1`: optional canary, only for public crest projections
  when the LOGO_DEV_API_KEY fallback is not in use.
- `VPS_CATALOG_URL=https://catalog-vps.jogomanager.com`: dedicated canary origin.
  The existing `https://catalog.jogomanager.com` is also explicitly allowlisted
  for compatibility. All other hosts, IPs, ports, credentials, protocols and
  extra paths are rejected.

Never expose this server-only setting as a `VITE_*` or browser variable.
Never send a Supabase service role key to the VPS public catalog.

## Rollout guardrails

1. **Restore and verify the SSH control plane**. In the 2026-10-26 diagnostic,
   SSH on 194.163.188.190:22 timed out from 104.28.210.215 even though
   ICMP ping worked. Check Fail2ban, host firewall, Contabo firewall, and
   SSH logs from the provider console. Do not remove protections blindly.
2. Provision a **dedicated Cloudflare Tunnel** from the VPS, not a public
   firewall port. Terminate at a local reverse proxy that **only** permits
   `GET /v1/public/clubs`. Deny `/metrics`, `/v1/events/click`,
   `/healthz` and other routes on the public hostname.
3. Configure `catalog.jogomanager.com` in Cloudflare and test TLS, the
   restricted route, request limits, cache TTL, HTTP 200 and failure cases.
   Confirm that no cookies/Authorization are forwarded.
4. Run `vitest run src/lib/vps-public-catalog.server.test.ts`, typecheck,
   lint and an integration smoke test. Verify logo/crest counts against
   direct Supabase without changing production data.
5. Enable `VPS_CATALOG_ENABLED=1` on a **single server-side canary**.
   Compare p50/p95 latency, total Supabase queries, 5xx, fallback rate,
   request cost and cache hit ratio before scaling. If the VPS makes the
   end-to-end request slower, keep it disabled.
6. **Rollback instantly** by setting `VPS_CATALOG_ENABLED=0`.
   Do not affect Supabase Auth, Stripe, or authoritative match processing.

## Safety properties implemented in the client

- Exact HTTPS host allowlist; no dynamic upstream paths (SSRF mitigation).
- No browser auth, cookies or private headers sent.
- Only public club crest projections; never authenticated or private data.
- 10-second request budget, at most 80 pages of 1,000 rows, and page-size validation.
- Rejects invalid/duplicate responses and truncation.
- Falls back to original read-only Supabase path instead of breaking pages.
- Remote results do not override the existing `LOGO_DEV_API_KEY` mechanism.

## Capacity vs. the database

The VPS cache and CPU are **not added to the Supabase Small compute instance**.
They reduce queries only after canary route is deployed and selected by the
server-side feature flag. No SQL or database hardware change is made here.

## Measured baseline (2026-10-26, before this canary)

- VPS: 8 vCPU, ~23.47 GiB RAM, 290 GB disk.
- Supabase PostgreSQL: 14 GB database, max_connections 90,
  shared_buffers 512 MB, effective_cache_size 1536 MB.
- An initial localhost test of 11 public catalog calls saw 10 cached hits,
  1 origin miss; the response stored was 5,318 bytes.
- That is a synthetic in-VPS test, **not** site production cache hit rate.
