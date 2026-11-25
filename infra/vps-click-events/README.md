# Contabo VPS: click events persisted in Redis Streams

This Docker Compose stack is deployed on the private Contabo VPS under `/srv/jogomanager/click-events`. It is separate from the main multiplayer Redis instance.

## Components

- `pfm-click-events-redis`: persistent Redis 8 with AOF, no host port, Docker internal network.
- `pfm-click-events-ingest`: signed private HTTP event collector, listening on the VPS loopback `127.0.0.1:3095`.

The collector validates a fixed allowlist of five event names, explicit analytics consent, a server-private 64-character hex token, body length, and rate limiting. It writes a bounded Redis Stream `pfm:events:clicks` via XADD and acknowledges only after the write succeeds. No user identifier, browser cookie, email, or IP is stored in the event payload.

## Existing gateway integration

Three existing catalog gateways use `/srv/jogomanager/public-gateway/gateway.mjs`. The private POST `/v1/events/click` route was updated in production to forward validated, consented events to `http://pfm-click-events-ingest:3095/v1/events/click` using `CACHE_EVENTS_TOKEN`, with a 950-ms timeout and an explicit 503 failure response. This draft includes the two new service files only; **the existing production gateway modification must also be reviewed and committed separately** before treating this as complete infrastructure-as-code.

Do **not** expose the private ingestion endpoint or Redis to the internet. Do not put the token in client-side `VITE_*` variables. The public catalog hostname only exposes the approved public-club route. Authenticated browser and multiplayer traffic must keep using their verified server endpoints and RLS, never use the public cache gateway for private saves or purchases.

Production environment file (already present, not committed): `/etc/jogomanager/cache-gateway.env`. No keys or database URIs in this PR.

## Verification performed 2026-10-27

- Both services were healthy after deployment. Redis survived restart with stream length preserved.
- Bad token: HTTP 401; missing consent: HTTP 400; unknown event: HTTP 400; allowed signed event: HTTP 202.
- Production gateway canary and all three gateway replicas independently produced HTTP 202 and increased Redis Stream length from 2 to 5.
- Public HTTPS catalog returned HTTP 200; public `/metrics` returned HTTP 404.
- Redis is isolated on an internal Docker network. Node service runs as a non-root UID and with a read-only filesystem.

## Rollback

Revert `/srv/jogomanager/public-gateway/gateway.mjs` to `gateway.pre-persistent-events-20261027.bak`, validate `node --check`, and roll the three gateway Compose services one by one, verifying health and GET catalog after each. Only after gateways no longer depend on it, stop this isolated events stack. Preserve `pfm-click-events-data` volume for audit; never use `docker compose down -v`.

## Limitations

The browser has not yet been connected to this private ingestion route, so it is not a complete end-user click telemetry rollout. Production service CPU/ram limits are for safety; CPU benchmark workloads are run separately and without explicit CPU caps. Continuous monitoring, integration tests, and deployment Git synchronization should be reviewed before merging.