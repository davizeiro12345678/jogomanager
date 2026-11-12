# Multiplayer Cloudflare → VPS → Supabase rollout

Status: **canary / disabled for public matchmaking** until Cloudflare Tunnel, secret parity, replay tests, and performance gates pass.

## Existing architecture

The TanStack Start frontend keeps its existing multiplayer interface and server functions. Room creation, joining, starting, settlement leases, authenticated permissions, and final authoritative result writes remain the responsibility of the trusted server and Supabase production.

The optional `src/lib/match-aux-client.server.ts` delegates only **deterministic match simulation** to the VPS after `finishMatchRoom` authenticates the host and claims the room in Supabase. The browser does not choose seeds, outcomes, or settlement records. Realtime presentation and lobby state continue on Supabase Realtime until a separately tested server-authoritative transport is available.

VPS processes:
- `jm-supabase-api.service`, loopback `127.0.0.1:3218`, public-key-only Supabase gateway, isolated service account.
- `jm-match-aux.service`, loopback `127.0.0.1:3219`, canonical `MatchSim` replay with a private HMAC key, idempotent SQLite records, and bounded concurrency.
- `jm-cloudflared-multiplayer.service`, prepared, requires an actual Cloudflare Tunnel token and a verified running connector.

Cloudflare canary hostnames:
- `matches-vps.jogomanager.com` → `POST /v1/simulate` only → local port 3219.
- `vps-multiplayer.jogomanager.com` → `GET /health/live` or `/health/ready` → local port 3218.
- All other paths return 404 at the tunnel boundary.

Do not publish the origin IP, expose local ports, or change the main `jogomanager.com` route to enable this canary.

## Server-only rollout settings

Configure these as **private server environment bindings** for the trusted TanStack runtime. Do not prefix secrets with `VITE_`.

```env
MATCH_AUX_ENABLED=0
MATCH_AUX_URL=https://matches-vps.jogomanager.com
MATCH_AUX_SIGNING_KEY=<same secret stored privately on the VPS>
```

Keep `MATCH_AUX_ENABLED=0` until all readiness and security checks pass. To activate, set `MATCH_AUX_ENABLED=1` on the trusted server only and deploy through the normal production quality-gate workflow. The URL allowlist prevents canary traffic being redirected to arbitrary HTTPS origins. Existing optional integrations without this explicit canary flag keep legacy behavior for compatibility.

**Never** put the signing key in the browser bundle, repository, CI output, public environment, or GitHub issue. The VPS key is stored in `/etc/jogomanager/match-aux.env`. Because this VPS previously experienced a root compromise, complete a clean host rebuild and rotate all server-side secrets before relying on it for production player sessions.

## Required checks before promoting traffic

1. Verify `systemctl is-active jm-supabase-api jm-match-aux jm-cloudflared-multiplayer` all return `active`. Tunnel status should be `healthy` with live connectors.
2. Verify HTTPS from outside the VPS: `GET https://vps-multiplayer.jogomanager.com/health/ready` returns 200. Other paths must be 404.
3. Verify a bare or incorrectly signed `POST https://matches-vps.jogomanager.com/v1/simulate` returns 401. Verify a valid server-side signed request returns the same deterministic result as the local canonical replay.
4. Verify duplicate room ID + identical payload returns the same result; duplicate ID + different payload returns 409.
5. Verify malformed payloads, wrong timestamps, tampered HMAC, nonparticipant JWT, unauthorized finalization, concurrent settlement, lease loss, and RLS boundary tests.
6. Test from Brazil and from Cloudflare Worker, not just from localhost. Record p50/p95/p99, error percentages, throughput, CPU steal, RSS and Supabase latency under expected concurrent sessions.
7. Gate production cutover on reliable backpressure/retry behavior. The staging service currently admits one active match. Add a durable queue and scale workers before claiming support for large concurrent workloads.
8. Release behind a small progressive rollout and observe errors before increasing traffic. Keep the original trusted TanStack replay ready as the rollback path.

## Rollback

Set `MATCH_AUX_ENABLED=0` in the trusted server configuration and redeploy. This disables the new canary without deleting player data or affecting Supabase room state. Keep Cloudflare DNS and Tunnel separate from the main production origin. Investigate any room in `settling` state before attempting retries; the existing lease/CAS logic is the authority.

## Verification already run (2026-11-12 UTC)

- Canonical match engine: six tests passed, including parity with the original `MatchSim`.
- VPS HMAC: invalid and stale signatures rejected with HTTP 401; duplicate signed request returned identical result in about 1.5 ms.
- Eight local serial matches completed, median about 474 ms.
- Sixteen simultaneous new room requests: one completed, 15 rejected with HTTP 429; this is intentional backpressure, **not full production-scale capacity**.
- 128 concurrent localhost health checks completed, p95 about 11.8 ms.
- Added Vitest test coverage for HMAC request shape, optional rollout gating, hostname allowlisting, bounded busy retries, invalid responses, and no upstream calls with invalid origin.

The Cloudflare tunnel connector credential and matching private Worker signing secret must be provisioned securely. **DNS and remote tunnel ingress configuration do not establish a live tunnel by themselves.**
