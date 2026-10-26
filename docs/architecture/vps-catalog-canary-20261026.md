# VPS public-catalog canary

Status: **off by default**. This change does not switch production traffic,
user accounts, matches, purchases or saves.

## Topology

```
TanStack Start server --(GET public catalog over HTTPS)--> Cloudflare Tunnel
         |                                                |
         |                                                v
         |                                  restricted /v1/public/clubs
         |                                                |
         |                                                v
         |                                  VPS localhost 127.0.0.1:3092
         |                                                |
         |                                                v
         |                                   Supabase public REST API
         |
         +-- on any failure/timeout/incomplete response --> Supabase public API
```

The existing VPS gateway (`pfm-public-cache-gateway`) exposes **only loopback
127.0.0.1:3092**. Its internal cache is bounded to 32 MiB, with 300 seconds
TTL, and currently serves public `clubs(id,name,crest_url)` projections.
It must not cache JWT-dependent content, permissions, balances, saves,
payments, or user-specific responses.

## Environment switches (server only)

- `VPS_CATALOG_ENABLED=0`: default, always query the Supabase public client.
- `VPS_CATALOG_ENABLED=1`: optional canary, only for public crest projections
  when the LOGO_DEV_API_KEY fallback is not in use.
- `VPS_CATALOG_URL=https://catalog.jogomanager.com`: exact allowlisted origin.
  Other hosts, IPs, ports, credentials, protocols, and paths are rejected.

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
- 4.5 second request budget, bounded pages and page-size validation.
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
