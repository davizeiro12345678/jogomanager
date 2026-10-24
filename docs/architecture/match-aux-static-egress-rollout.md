# Auxiliary Match Server / Fixed Atlas Egress

## Current status (2026-10-24)

**Code staged, not promoted:** The main app currently finishes verified multiplayer rooms on the trusted TanStack server, using the secret seed held in Supabase, never a client-submitted score. The optional remote adapter added here is **disabled unless MATCH_AUX_URL is configured**.

No VM has been provisioned. The SentinelX account currently has **0 saved compute integrations and 0 connected hosts**. The Atlas IP allowlist still contains a single *pre-existing home-client IP*, not a newly assigned cloud egress IP. Do not add a fake IP or open `0.0.0.0/0`.

The Atlas project already has a least-privileged user `jogomanager_aux_prod_rw` whose URI is encrypted in Supabase Vault under `mongodb_aux_uri_production`. The new auxiliary process needs the same URI **as a server-only environment variable**, copied by a credential-authorized operator, never committed to GitHub.

## Proposed VM (subject to availability, currency and taxes)

**Updated strict ceiling: R$ 74/month, including taxes, exchange fees, public IPv4, backups, storage, and any ancillary services.** Candidate: AWS Lightsail Linux `Small-2GB` with **2 GB RAM, 2 shared vCPU, 60 GB SSD, and 3 TB bundled data transfer** at **US$ 12/month** with public IPv4. The Amazon Lightsail São Paulo region `sa-east-1` is available (launched June 2026). The associated static IPv4 costs no extra when attached to the instance. At the last available USD/BRL reference of approximately R$ 5.0371 on 23 October 2026, the **base-only** conversion is approximately **R$ 60.45/month**, leaving **R$ 13.55 for taxes, card spread, and ancillary costs**. This amount is an estimate, not a final AWS bill. **Do not provision until the provider confirms the all-in total stays under R$74.** Safer fallback if total cost does not fit: Lightsail `Micro-1GB` with 1 GB RAM, 2 shared vCPU and 40 GB SSD at **US$ 7/month** (R$ 35.26 base-only). The machine is intended for **serial/background deterministic replay, never a live 3D simulation farm**. No AWS account with billing and Lightsail IAM privileges is connected here; the GitHub repository cannot authorize or provision the server by itself. Pricing: https://aws.amazon.com/lightsail/pricing/ ; regions: https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-lightsail-aws-regions/ .

## Architecture

```text
Browser --JWT--> TanStack Server (checks host/room/secret from Supabase)
                       |
                       | HTTPS POST /v1/simulate
                       | x-pfm-timestamp + x-pfm-signature (HMAC SHA-256)
                       v
          DNS match-aux.jogomanager.com -> Caddy TLS -> 127.0.0.1:3090
                                                        |
                           canonical MatchSim only (bounded 60k ticks)
                                                        |
                           Atlas Free (TLS, game_jobs, status/receipt cache)
                            ^ 
                            | dedicated static VM outbound IPv4 /32 only
                        MongoDB Atlas allowlist
```

The optional adapter changes only *where verified deterministic simulation runs*, not who authorizes or writes the final scores. Money, item grants, account identity, matchmaking and verified career progress remain in Supabase/Stripe. This service does not accept arbitrary client rosters, rewards, identities or scores.

## Provisioning sequence (NOT YET EXECUTED)

1. Provision the selected 2 GB Lightsail machine within R$74 all-in (or 1 GB fallback) **only after** verifying total R$ billing. Attach a stable public IPv4; note the provider-confirmed assigned address. Install Node 24, Caddy and source/build artifacts. SSH access must use keys and firewall restrictions. Limit inbound TCP to 443/80 and SSH from a trusted management IP.
2. Add only the **actual assigned IP/32** in MongoDB Atlas Project 0 -> Network Access. Do not use `0.0.0.0/0`. Remove the pre-existing home IP entry only after verifying it is no longer needed for administrative access.
3. Configure Cloudflare DNS for `match-aux.jogomanager.com` to the **actual** static IPv4. Use HTTPS with valid TLS (Caddy) and restrict Caddy / firewall to the required ports. Keep `MATCH_AUX_BIND=127.0.0.1`.
4. Install production-only MongoDB dependency in `services/match-aux`, and the main project modules required by `tsx` for the game engine (the deploy artifact/build should bundle game modules to avoid installing dev assets on tiny VM). Use a non-root systemd user and memory limit; see `services/match-aux/ops/match-aux.systemd.service` and `services/match-aux/ops/match-aux.Caddyfile`.
5. Set `MONGODB_URI` with the restricted Atlas user, and generate a **fresh 256-bit HMAC key** into `/etc/match-aux.env` (chmod 600); configure **same** secret in trusted TanStack server settings. Never put these in frontend `VITE_*` variables or Git. Rotate on compromise. Set `MATCH_AUX_URL=https://match-aux.jogomanager.com` only once the worker passes tests.
6. Confirm VM egress with an external trusted echo endpoint, verify Atlas allowlist includes that /32, and perform Atlas authenticated TLS ping **from the VM**. Run Node service signature, auth rejection, replay parity, simulation idempotency and failure-path smoke tests.
7. Validate verified Supabase multiplayer match finalization end-to-end and two concurrent finish attempts. Confirm no duplicate grants, no client-supplied scores, no long-running settling locks, and stable p95 latency and error budgets. Then enable `MATCH_AUX_URL` for a low-traffic canary. If errors rise, unset URL to revert instantly to the **existing server-side** authoritative simulation.

### Production secrets

```bash
# /etc/match-aux.env, owned by root, chmod 600; EXAMPLE KEYS ONLY
MATCH_AUX_BIND=127.0.0.1
MATCH_AUX_PORT=3090
MATCH_AUX_SIGNING_KEY=<min-32-character-random-secret>
MONGODB_URI=<mongodb-srv-URI-read-from-Supabase-Vault-by-authorized-operator>
```

## Runtime and limits

- One active simulation per Node process; other signed requests receive HTTP 429.
- Unique index `roomId` and 7-day TTL for auxiliary `game_jobs`, with deterministic digest binding to canonical server-supplied seed and club IDs.
- MongoDB Free shared CPU/RAM has no guaranteed dedicated compute; approximately 100 read/write operations/sec is an account-service bound, not a players-online capacity guarantee.
- Current capacity in matches/s, concurrent users, memory p95, API p95 and monthly egress cost: **not yet benchmarked**.
- A failed Atlas connection must never change balances or declare a match result as settled.
- Static IP cannot be assigned through MongoDB Atlas API alone; it must be assigned by the VM/cloud provider before adding to the Atlas network allowlist.

## Rollback

Unsetting `MATCH_AUX_URL` on the trusted TanStack backend reverts `finishMatchRoom` to the already-existing in-process deterministic replay. Do not disable database auth or bypass room's server-seeded status. Do not deploy until CI passes.

## Tracking

- Main PR remains separate from frontend CSS refactor PR #66, whose strict bundle gate has not been satisfied.
- Relevant code: `src/lib/match-aux-client.server.ts`, `src/lib/multiplayer.functions.ts`, `services/match-aux/*`.
