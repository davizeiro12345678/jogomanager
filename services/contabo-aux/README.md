# Contabo auxiliary API (draft; not deployed)

This package is a deliberately isolated backend for a Cloud VPS on Linux. The frontend currently runs via Cloudflare Workers; Supabase Auth/PostgreSQL and Stripe fulfillment remain authoritative. **Do not merge or activate before release gates and live connectivity tests pass.**

## Included capabilities

- GET /healthz: liveness; GET /readyz: checks Supabase Auth availability.
- GET /v1/auth/me: verify a Supabase access token through the Auth service.
- GET /v1/purchases/status?reference=cs_...: status only, filtered by verified owner with the forwarded user JWT and existing RLS. No checkout, fulfillment, or secret Stripe key.
- POST /v1/matches/preview: an unofficial simulation using the existing deterministic game engine inside a bounded worker. Disabled by default. Never grants purchases, achievements, or changes official results.

The server only requires a **publishable Supabase key** and never receives a service-role key. In-process per-token limits are not an alternative to WAF/network limits.

## VPS preparation requirements

1. Connect an authorized administrator to the Linux VPS and verify distribution, CPU, RAM, free disk, status and SSH key access.
2. Take a backup/snapshot, ensure automatic updates, Docker Engine and Compose plugin, non-root deployment user, SSH key-only administration, firewall default deny and explicit ports 22/80/443 only.
3. `api.jogomanager.com` já é protegido pelo Cloudflare Access e atualmente responde com HTML de login, não com a API. Não sobrescreva esse DNS, desative o Access nem use o HTTP 200 dessa página como prova de saúde. Use o candidato `aux.jogomanager.com` somente após verificar eventuais políticas globais de Access e reservar DNS/roteamento. Nenhum DNS foi alterado nesta preparação. Não permita acesso direto à origem que contorne o WAF.
4. Copy .env.example to .env on the VPS and set SUPABASE_PUBLISHABLE_KEY from a secure configuration source. Never commit actual credentials. Restrict permissions (chmod 600).
5. Para validar o Compose: `cd services/contabo-aux && cp .env.example .env`, preencher a chave publishable do Supabase obtida do cofre/painel e manter `.env` privado (chmod 600). Execute `docker compose --env-file .env config --quiet; docker compose --env-file .env up -d --build; docker compose ps`. O padrão publica APENAS `127.0.0.1:18080` (API), `127.0.0.1:18081` (HTTP Caddy) e `127.0.0.1:18443` (HTTPS Caddy), sem acesso remoto. Teste `curl -fsS http://127.0.0.1:18080/healthz` e `/readyz` em localhost antes de qualquer roteamento externo. Use Cloudflare Tunnel com credenciais privadas e sem portas 80/443 públicas, ou um projeto de firewall de origem equivalente, após verificação.
6. Run node --test services/contabo-aux/server.test.mjs, TypeScript checks, build, deterministic match replay parity and production security testing.
7. Route only explicitly opted-in auxiliary traffic through a feature flag after passing checks. No automatic traffic switching.
8. Test browser login, expired/invalid JWTs, RLS ownership, MFA requirements, purchase status and rate limits with dummy accounts. Keep signed Stripe webhooks on existing authoritative backend.

## Baseline (2026-10-24; before migration)

- Supabase Infrastructure: CPU 3%, RAM 54%, Disk 24% (individual snapshots, not averages).
- PostgreSQL: 13,943,688,339 logical bytes (~13 GB), 11 connections, max 90.
- Cache hit 92.20%; 512 MB shared buffers; cumulative temp IO approximately 62 GB.
- Supabase region us-west-2; Contabo EU. Measure network p50/p95/p99 before routing synchronous auth or DB calls over this multi-region hop.

Compare matched **before/after** intervals under the same workload: CPU%, RAM%, disk utilization and IOPS, DB connections, response p95/p99, requests/s, 4xx/5xx, match throughput and replay parity. A lower Supabase CPU number alone does not prove system-wide efficiency.

Rollback: disable the feature flag and route all traffic back to the existing Supabase/Cloudflare endpoints. Never allow the auxiliary server to write to purchase entitlements or publish official match scores until a separate transactional queue protocol is developed and certified.
