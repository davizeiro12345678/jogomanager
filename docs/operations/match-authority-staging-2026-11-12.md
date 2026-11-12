# Match authority: isolated Cloudflare staging, 12 November 2026

## Infrastructure actually provisioned

The Cloudflare API authenticated to account `31b4ec9dfe5281c893ccfaaaefcfc88d` successfully uploaded the **disabled bootstrap** at `2026-11-12T22:42:26.800565Z`:

| Item | Verified value |
|---|---|
| Script | `jogomanager-match-authority-staging` |
| Deployment | `b70fe3ab-5c99-47b8-8339-1b0ab6888d59` |
| Current version | `18f8b49c-8b02-4623-9911-7841b7f273f4` (2026-11-12T23:02:16.689795Z) |
| SQLite namespace | `jogomanager-match-authority-staging_MatchRoomDO` |
| DO namespace ID | `bdbb41fa3f1046d3b12c20c9ff87d1ea` |
| Binding | `MATCH_ROOMS` → `MatchRoomDO` |
| `MATCH_AUTHORITY_ENABLED` | `false` |
| `MATCH_AUTHORITY_ENV` | `staging` |
| `MATCH_QUEUE_CRON_ENABLED` | `false` |
| `workers.dev` routing | **disabled** |
| `workers.dev` previews | **disabled** |
| Custom Worker domains | **zero** |

Verified using authenticated `GET /accounts/{account_id}/workers/scripts/{name}/settings`, `/subdomain`, `/deployments`, `/workers/durable_objects/namespaces`, and `/workers/domains`.

**Important: this is infrastructure-only.** The deployed script is the standalone fail-closed `services/match-authority/staging-bootstrap.mjs` equivalent. Its default handler, scheduled handler, and DO request handler never run game simulation, accept match tickets, or issue credentials. All HTTP/DO fetch requests return 404. Its SQLite table is only an initialization marker. The real `services/match-authority/worker.ts` is **not yet deployed**. Do not mark gameplay or client integration production-ready because the namespace exists.

## Separation of production and staging

- `wrangler.match-authority.jsonc` keeps `workers_dev: false`, no routes, `MATCH_AUTHORITY_ENABLED: false`, `MATCH_QUEUE_CRON_ENABLED: false`, and **no cron schedules**. A build or API upload is not permission to enable active games.
- `MATCH_AUTHORITY_ENV: staging` is a required runtime database trust boundary; `services/match-authority/supabase.ts` rejects staging connections to the production Supabase project `lguqnwvsfeefxamzeyos`. The separate production configuration declares `MATCH_AUTHORITY_ENV: production` and only trusts the intended production project.
- Do not populate the staging Worker with a production `SUPABASE_SERVICE_ROLE_KEY`. Create a separate staging Supabase project or use an isolated disposable local database for end-to-end validation, with its own secret and explicitly approved access.
- No SQL migration 0072–0079 was applied to Supabase production while provisioning the Cloudflare DO. No production route, Worker, or DNS record was updated.

The initial REST upload applied `match-room-sqlite-v1` with `new_sqlite_classes: [\"MatchRoomDO\"]`. A subsequent attempt to resend the same migration failed with Cloudflare error **10074**, because the Durable Object class already exists. Re-uploading the **source-controlled** disabled bootstrap without repeating `migrations` succeeded and preserved the same SQLite namespace. For manual REST updates to an existing class, include the binding but **omit creation migrations**. Wrangler itself manages migration history from the checked-in configuration.

## Deploy the actual game Worker safely

The PR includes `.github/workflows/match-authority-staging.yml`. On push it checks TypeScript, lint, dedicated network and deterministic tests, config assertions, then runs `wrangler deploy --dry-run --outdir .staging-match-authority` and archives the disabled bundle. The full game engine is sourced from `services/match-authority/worker.ts`, NOT `staging-bootstrap.mjs`. This gives reviewers the exact compiled artifact without shipping it blindly.

The GitHub Actions deploy job requires an account-scoped `CLOUDFLARE_API_TOKEN` secret with only the Workers script permissions needed for **this staging account**, installed through GitHub Actions Secrets or a protected environment. The Cloudflare account connector can deploy the bootstrap, but cannot transfer its own OAuth credentials into GitHub Secrets. If the secret is missing, the job emits an explicit warning and **skips the full deploy**. A successful dry run alone does not mean the code was published.

The browser-based credential provisioning attempt was also blocked: GitHub and Cloudflare token pages redirected to login. No token was copied, exposed, or committed. Never paste secrets into the repository, terminal output, public frontend vars, logs, or this document.

Once a full disabled bundle is published by the authorized deployment mechanism:

1. Re-query Cloudflare script settings. Confirm `MATCH_ROOMS` is still bound and `workers.dev`, previews, routes, cron and all multiplayer flags are disabled.
2. Replay SQL migrations, fixtures, and access contracts against a **dedicated staging database**, not production; assign server secrets to the staging Worker by a protected secret-management flow.
3. Only with a private staging route protected by Access or equivalent, test two authenticated clients: signed first frames, room/seat checks, READY/commands, ACK/NACK, reconnect with fresh tickets, and cross-room and replay rejection.
4. Test deliberate DO eviction/restart, interrupted match, persisted session/engine tick, settlement failure and exact idempotent receipt retry. Verify no duplicate MMR/credits, no unsigned score and no lost critical command.
5. Run bounded adversarial tests in staging (invalid tickets, oversized frames, spectator read-only access, concurrent joins, TBT/FPS/p95 networking) and record evidence before any activation.
6. Roll back Worker deployment or disable the flags immediately upon mismatch. Recheck that **storage is not rolled back with code**, so migrate checkpoint formats with compatibility gates.

## Gates still open

The staging DO namespace exists but no full-engine staging runtime, no spectator/tournament/coop live integration, no two-device physical test, and no production release approval. PR #132 stays Draft. Runbook progress is evidence of partial implementation rather than an all-done claim.
