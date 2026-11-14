# JogoManager — Release integration design

## Intent

Deliver a safe, reviewable release candidate that consolidates PRs #127–#131, fixes the confirmed production and public-route defects, and establishes measurable gates for Match 3D, multiplayer, chat, data quality, and commercial readiness. The handoff must be usable from another ChatGPT account without repeating completed work or assuming unverified production changes.

## Why this release is needed

The product already has a substantial React/TanStack/R3F/Three/Rapier application, Rust/WASM simulation kernels, Supabase/PostgreSQL services, Cloudflare delivery, and a working public quick-match path. Its risk is no longer lack of features; it is release integrity: overlapping PRs, non-green CI attempts, incomplete auth validation, an unresolved collation mismatch, a failed injury covering index, and missing physical-device proof for 60 FPS.

## Goals

1. Produce one traceable integration branch and one reviewable release PR targeting `main`, preserving the work already merged or inherited.
2. Reconcile #127–#131 without losing code, migrations, generated assets, or tests.
3. Fix OAuth and public route regressions, verify quick-match never selects a generic club identity, and resolve Prettier/build/bundle baseline failures.
4. Stabilize API-Football import windows so Edge executions do not hit 546/503 resource failures.
5. Correct PostgreSQL operational defects with safe forward-only procedures and evidence.
6. Establish authoritative multiplayer and auditable chat safety boundaries.
7. Improve Match 3D visual fidelity and frame pacing using real render measurements, with a 60 FPS high-quality target on explicitly homologated hardware.
8. Add product telemetry, persistent competition/ranking foundations, beta process, and release notes.
9. Leave a portable progress record and exact resume instructions.

## Non-goals and anti-goals

- No replatforming or wholesale replacement of React/R3F/Three/Rapier/Rust/WASM.
- No direct merge to `main`, production deploy, DNS/Tunnel activation, or production pentest as part of branch preparation.
- No weakening CI thresholds, replacing real tests with mocks, changing RNG fixtures to make benchmarks pass, or claiming FPS from SwiftShader/headless screenshots.
- No force-push, destructive migration replay, blind database-wide REINDEX, or VPS activation before host integrity is proven.
- No fabricated before/after metrics or claims of zero vulnerabilities / zero bugs.

## Approaches considered

1. **Blindly merge all five PRs:** rejected. PRs overlap, some are based on old heads, and #127 is already merged while #128 is an ancestor of the integration branch. This risks duplicate migrations and overwritten fixes.
2. **Rebuild the stack or create a fresh product branch:** rejected. It discards working architecture, expands regression surface, and delays the critical fixes.
3. **Incremental reconciliation on the existing integration branch (chosen):** retain the branch, preserve PR #127's merge and PR #128's inherited history, port only missing changes from #129–#131, resolve migration and file conflicts explicitly, and gate each subsystem with tests before creating a final PR. This minimizes history churn and keeps a portable handoff.

## Architecture and implementation decisions

- Keep the existing stack and boundaries: simulation state outside React render components; R3F owns scene composition; DOM owns HUD and menus; high-frequency work stays outside broad React state.
- Match 3D instrumentation must report mean FPS, p50/p95/p99 frame time, 1% and 0.1% lows, stalls >33/50/100/250 ms, draw calls, triangles, texture/geometry/program counts, renderer/backend, DPR, resolution, quality, camera, scene phase, and hardware/browser metadata.
- Separate match and cutscene campaigns. Count visible stalls; exclude hidden-tab suspension; invalidate samples when quality, DPR, camera, rules revision, scene, or device context changes.
- High-quality acceptance target on Tier A hardware: mean ≥60 FPS, 1% low ≥50 FPS, p95 frame time ≤20 ms, p99 ≤33.3 ms, and no unexplained visible freeze >250 ms. Tier B/C results must be reported separately; do not claim every low-end device can run the high preset at 60 FPS.
- Multiplayer authority belongs to server/DB: signed room tickets, room/user/seat binding, server-controlled seed/tick/result, monotonic command sequence, bounded queues, replay hash, idempotent finalization, and reconnect leases.
- Chat messages need durable client idempotency, per-user/per-room quotas, Unicode normalization/confusable detection, automated moderation, block/report records, and human review for uncertain/high-impact decisions.
- Importer workers must use short bounded windows, global transactional quota/lease admission, idempotent retries, explicit provider 429 handling, and resumable cursors.
- PostgreSQL changes are forward-only. Collation repair and concurrent index repair are operator-run maintenance actions with backup/PITR, storage/WAL/replica headroom, lock/latency monitoring, and postflight verification.
- Cloudflare deployment remains gated to a successful Quality Gates run on `main`; a PR or integration branch must never publish.
- VPS gateway remains disabled until a clean rebuild, verified external backup, key rotation, canary and security review are evidenced.

## Confirmed baseline facts at handoff

- Repository: `davizeiro12345678/jogomanager`.
- Main SHA observed: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`.
- Integration branch: `integration/release-2026-11-11`; head moves as CI fixes and operational notes are committed. Refresh the branch SHA before resuming.
- PR #127: closed and merged into the integration branch (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- PR #128: still open/draft against `main`; its head `32ac4219bf5dc4a357593a381f5e918876a741d0` is an ancestor of the integration branch, so do not cherry-pick it again.
- PR #129: open/draft, non-mergeable against integration; selected importer, migration, and bundle work has been ported, but the branch diff still needs reconciliation.
- PR #130: open/draft, non-mergeable against integration; direct Supabase OAuth/fallback and career-country files are present, but auth and same-account career continuity need verification.
- PR #131: open/draft, non-mergeable against integration; gateway assets and pagination changes are present; VPS/Tunnel/DNS activation is explicitly blocked.
- An active repository ruleset exists, but it does not include `required_status_checks`. The connected GitHub integration receives HTTP 403 on the branch-protection endpoint and exposes no ruleset write action; a repository administrator must require the release checks on `refs/heads/main`.
- Production Postgres collation mismatch remains: recorded `153.120`, actual `153.121`. A read-only inventory documented 251 ordinary collation-dependent indexes (~2.17 GB) plus a partitioned Realtime index. This is a planned maintenance-window operation, not a casual migration.
- The API-Football table's autovacuum thresholds were changed and verified: 0.5% + 20,000 rows; production then recorded autovacuum and autoanalyze, zero estimated dead tuples and zero modifications since analyze.
- The injury materialized-view refresh is not yet fixed. The covering partial index is currently absent; a concurrent replacement attempt exceeded the SQL API's 120-second timeout and the incomplete index was removed. The planner uses the valid but non-covering `api_football_injury_league_time_idx`; the latest refresh was 36.024 seconds. A staging plan comparison and operator-controlled concurrent build with a longer timeout remain.
- A previous auxiliary-engine CI attempt failed only on Prettier in the quick-match regression test; formatting was corrected in a later commit. The latest exact-head workflow set is still running/queued; read its result before asserting green.
- The Cloudflare workflow deploys only after a successful push-triggered Quality Gates run on `main`. PR checks do not deploy.

## Constraints

- Preserve existing PR history; no force-push.
- Keep migration identifiers unique and append after deployed history. Production has already applied migrations through the existing `0066_api_football_claim_concurrency_48`; the Custom450 migration was renumbered to `0067`, followed by the integration's chat/email/autovacuum migrations.
- Do not run a database-wide collation rebuild or concurrent index repair without explicit maintenance authorization.
- Do not activate the gateway or trust the prior VPS host until clean rebuild, backup, and credential rotation are proven.
- No 60 FPS claim without device, renderer, resolution, DPR, quality, camera, scene phase, and raw timing evidence.
- A passing unit test does not prove OAuth account continuity, multiplayer authority in production, or GPU performance.

## Acceptance criteria

- PR integration graph is conflict-free and every original PR is either merged, explicitly superseded by the final PR, or closed with a traceable reason.
- Exact integration SHA passes lint, TypeScript, unit/integration tests, Rust/WASM parity, 200-seed replay stress, SQL migration replay, build, startup bundle comparison, Lighthouse, graphics contracts, and CodSpeed.
- OAuth: Google and configured providers complete callback to the same existing Supabase user ID; existing career remains accessible; email recovery and MFA are verified.
- Quick-match: no placeholder/generic club identity is selectable; home/away are distinct canonical clubs.
- Importer: bounded workers, no repeated 546/503 under a representative staged batch, no duplicated or lost cursor work, and provider quota remains within configured limits.
- PostgreSQL: collation versions match only after every affected index is rebuilt; covering injury index is valid/ready/non-zero; ten consecutive refreshes are recorded with p50/p95 and heap fetches; target p95 <5 s is a goal to validate, not an assumption.
- Multiplayer: signed ticket/seat ownership, server-authoritative outcomes, replay hash verification, bounded concurrent rooms, idempotent commands, reconnect and finalization tests pass.
- Chat: spam/Unicode abuse, duplicate retries, per-room/user rate limits, block/report audit trail and moderator escalation pass.
- Match 3D: Tier A meets 60 FPS criteria in high quality across match and cutscene scenes on physical devices; Tier B/C are documented separately with stable adaptive fallback.
- Product: catalog provenance/freshness, mobile UX, persistent competitions/rankings, DAU/retention events, beta cohort and release notes have tests and ownership.
- Branch protection and required checks are configured by a repository admin before the final merge to main.
- Final PR has a complete evidence report; deployment remains a separate gated event.
