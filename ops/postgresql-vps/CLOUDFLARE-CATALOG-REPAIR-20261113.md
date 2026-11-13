# Cloudflare public catalog tunnel repair — 13 November 2026

The public catalog hostname **catalog-vps.jogomanager.com** previously resolved to the `jogomanager-vps-fra-01` tunnel (`340f8cf2-48fd-4457-b3c1-eb8afa048154`), which reported `down` and 0 active Cloudflare connections. A public GET to the catalog hostname returned Cloudflare HTTP 530 even though Nginx port 8088 was running on the VPS loopback interface.

## Production repair performed

1. Added one narrowly scoped ingress rule to the existing *healthy* Cloudflare Tunnel `jogomanager-vps-multiplayer-canary-20261112` (`b6316dea-8293-479d-b757-2bb77960e09e`):
   - Hostname: `catalog-vps.jogomanager.com`
   - Path: `^/v1/public/clubs$`
   - Origin: `http://127.0.0.1:8088`
   - Request Host: `catalog-vps.jogomanager.com`
2. Preserved existing match simulation route `matches-vps.jogomanager.com ^/v1/simulate$` -> `127.0.0.1:3219`, multiplayer health `vps-multiplayer.jogomanager.com ^/health/(live|ready)$` -> `127.0.0.1:3218`, and the default HTTP 404.
3. Updated only the proxied Cloudflare CNAME `catalog-vps.jogomanager.com` to the healthy tunnel target. The main `jogomanager.com/*` Worker (`jogomanager-web`) and the site's DNS remained unchanged.
4. Confirmed Nginx `/etc/nginx/conf.d/jm-catalog-nginx.conf` allows **GET only** to `/v1/public/clubs`; other paths return 404, POST returns 403; the generated static-cache mapping accepts `limit=100|1000&page=0..999`. Its dynamic fallback strips `Authorization`, `Cookie`, `X-Forwarded-Authorization`, and `X-Api-Key` before proxying to the local catalog origin.

## Verified HTTPS results

- `GET https://catalog-vps.jogomanager.com/v1/public/clubs?limit=100&page=0`: HTTP **200**, 8307 bytes, ~105 ms.
- Same request with `page=1`: HTTP **200**, 8379 bytes, ~66 ms.
- `GET /v1/private/careers` on the catalog hostname: HTTP **404**.
- `POST /v1/public/clubs?limit=100&page=0`: HTTP **403**.
- `GET https://jogomanager.com/`: HTTP **200**.
- `GET https://vps-multiplayer.jogomanager.com/health/live`: HTTP **200**.

The status codes verify transport and access control only. They do **not** establish that all browser gameplay requests have been migrated to VPS services. The main public site still runs on Cloudflare Workers; the hosted Supabase project remains authoritative for authentication, private careers and saved games.

## PostgreSQL mirror and full-replication boundary

The VPS PostgreSQL 18.7 configuration was rechecked: `shared_buffers=14GB`, `effective_cache_size=24GB`, `max_connections=550`, `work_mem=4MB`, `max_wal_size=4GB`, and loopback-only database port 5432. The local mirror contains 353,614 RLS-public catalog records and occupies about 133 MB. It is **not a copy of the 18.12 GiB Supabase database**.

A complete controlled replica requires host integrity assurance, encrypted direct connection to the upstream PostgreSQL 17 instance, separately provisioned limited replication credentials, publication/table selection, schema compatibility, WAL retention/lag monitoring, protected read access and verified backups. Auth/Storage/Realtime/Edge Functions are independent managed services; a PostgreSQL database dump alone does not reproduce them. Never import secrets into GitHub or public Cloudflare Worker bindings.

## Operational caution

The old catalog tunnel is still down in Cloudflare despite its local systemd process reporting `active`. Do not revert the catalog CNAME to that tunnel unless it is healthy again. The current shared tunnel now carries a public catalog endpoint alongside staging match routes, so monitor connector health and traffic separately and consider a dedicated replacement tunnel once the old token/connection issue is resolved.
