# JogoManager Release Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to resume this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read the linked design spec first. Preserve the progress state below; do not repeat completed tasks.

**Goal:** Consolidate PRs #127–#131 and deliver a production-grade, evidence-backed JogoManager release candidate with secure auth, stable importer/PostgreSQL, authoritative multiplayer/chat, and measurable Match 3D performance.

**Architecture:** Continue on the existing React/TanStack/R3F/Three/Rapier + Rust/WASM + Supabase/PostgreSQL + Cloudflare stack. Reconcile history incrementally on the existing integration branch; validate each subsystem independently; only then create one final PR to `main`.

**Tech Stack:** Node/npm, TypeScript, React, TanStack, Three.js, React Three Fiber, Rapier, Rust/WASM, Vitest, ESLint, Prettier, Supabase/PostgreSQL, Cloudflare, CodSpeed, Lighthouse, Playwright/browser QA.

**Spec:** `docs/superpowers/specs/2026-11-11-jogomanager-release-integration-design.md`

## Global Constraints

- Work only in `davizeiro12345678/jogomanager`; never access another client/project.
- Work branch: `integration/release-2026-11-11`; target branch for the eventual final PR: `main`.
- Never force-push, rewrite shared history, merge to `main`, or deploy to production without explicit release approval.
- Do not cherry-pick PR #128 again: its head is already an ancestor of the integration branch.
- PR #127 is already merged into the integration branch; do not replay its commits or migrations.
- Keep migration IDs unique and append after the deployed `0066_api_football_claim_concurrency_48`; integration currently uses 0067–0070.
- No production-wide collation reindex or concurrent covering-index repair without an approved maintenance window, verified backup/PITR, storage/WAL/replica headroom and operator monitoring.
- Do not activate the VPS gateway/Tunnel while host integrity, clean rebuild, external backup and credential rotation remain unproven.
- No FPS claim without physical-device evidence and matching renderer, GPU, resolution, DPR, quality, camera, scene, seed and raw frame-time data.
- Preserve existing CI thresholds, deterministic seeds, RNG ordering, migration provenance, user career IDs, and server-side authority.
- Do not treat a successful PR check as a production deployment. Cloudflare deployment is gated to a successful Quality Gates run on a push to `main`.

## Review Focus

- PR #128 code already inherited into the branch must not be duplicated or overwritten by #127/#129/#130 overlapping files.
- OAuth callback for an existing account must return to the same Supabase user ID and preserve that user's career; fallback provider discovery must not invent providers or switch projects.
- Random quick-match must never select missing, duplicate, placeholder, or generic club identities; home and away must be distinct canonical records.
- Importer worker retries, quota contention, provider 429, Edge timeouts, and interrupted windows must not duplicate or lose work.
- Multiplayer finalization racing with queued commands, reconnect expiry, signature failure, duplicate sequences, or room ownership changes must not alter a frozen result.
- Chat Unicode confusables, duplicate delivery, reconnect, per-user/per-room floods, and moderation outages must fail closed without losing auditability.
- Visible 50–250 ms stalls count in FPS distributions; hidden-tab suspension does not; changing quality/DPR/scene/rules revision invalidates a measurement campaign.
- Collation and covering-index repairs must not run as a transactional migration or conceal an invalid index by merely refreshing metadata.

---

## Exact checkpoint at handoff

**Status:** Phase 1 — integration and CI stabilization. The work is in progress; the release PR has not been created and nothing has been merged to `main`.

- Repository: `davizeiro12345678/jogomanager`
- Main SHA last read: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`
- Integration branch: `integration/release-2026-11-11`
- Integration SHA immediately before this plan was saved: `1496e779fdf4d3deb2b462eba54429a68722f5a1`; after the plan and progress ledger commits, draft PR #132 points at `ec499d621de33ee148184b7411a7197054eedbef`. Refresh the branch head before continuing.
- PR #127: **merged** into the integration branch; merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`.
- PR #128: **open/draft against main**, but its head `32ac4219bf5dc4a357593a381f5e918876a741d0` is an ancestor of the integration branch. Its implementation is already present in the branch history; do not merge/cherry-pick it again.
- PR #129: **open/draft, non-mergeable** against integration. Selected importer, Custom450 migration, SQL contract, worker-window and bundle-baseline changes have been ported; compare and reconcile remaining diff before superseding the original PR.
- PR #130: **open/draft, non-mergeable** against integration. Direct Supabase OAuth, provider fallback, auth tests and career-country module are present; account continuity, callback, recovery and visual flow remain unverified.
- PR #131: **open/draft, non-mergeable** against integration. Read-only gateway files and catalog pagination changes are present; do not activate VPS/Tunnel/DNS.
- `main.protected=false` was returned by the branch endpoint. Reading branch-protection details returns 403 to the connected GitHub integration; an account/repository admin must configure protection and required checks.
- Latest workflow runs at the last inspection were still running/queued on the exact integration head: Quality Gates, CodSpeed, Match 3D visual evidence, startup CPU diagnostic, mobile draw inventory, lifecycle/context recovery, auxiliary worker and public environment/MCP safety. A prior auxiliary-worker attempt failed on a Prettier formatting error in `src/game/quick-match-catalog.test.ts`; a later commit formatted it. Do not assume the latest attempt is green—inspect the newest run for the current branch SHA.
- Production autovacuum tuning is applied and verified: `api_football_data` now uses 0.5% + 20,000 thresholds; a production autovacuum and autoanalyze ran, leaving `n_dead_tup=0` and `n_mod_since_analyze=0`.
- PostgreSQL injury refresh is **not fixed**: `api_football_injury_league_cover_idx` was found invalid/not-ready and zero bytes. The concurrent repair is documented but not executed. Refresh samples remained about 30–36 seconds.
- PostgreSQL collation mismatch is **not fixed**: recorded `153.120`, actual `153.121`. The documented inventory is 251 ordinary collation-dependent indexes (~2.17 GB) plus a partitioned Realtime index. Rebuild all affected indexes before refreshing the database collation version.
- The generic quick-match club fallback is filtered through the canonical club catalog and regression tests were added; current exact-head CI must prove them.
- The importer implementation and migrations 0067–0070 are in the integration branch; 546/503 elimination is not yet proven by a representative staged run or post-release production telemetry.
- The Cloudflare workflow is intentionally restricted to a successful `push` Quality Gates run on `main`; PR CI does not publish.

## Progress board

Legend: **[x]** evidence complete; **[~]** implementation partly present / verification outstanding; **[ ]** not started or blocked.

| Workstream | State | Exact status |
|---|---|---|
| Baseline and PR ancestry | [x] | #127 merged; #128 inherited; #129–#131 triaged |
| PR reconciliation | [~] | #129–#131 overlap/conflicts remain; final superseding PR absent |
| Lint / TypeScript / build | [~] | fixes committed; exact-head Quality Gates still pending |
| Bundle baseline comparator | [~] | separate lockfiles, historical resolver contract and cleanup fixes committed; comparison artifact not yet confirmed |
| OAuth / public routes | [~] | direct Supabase OAuth and fallback present; real existing-account flow not verified |
| API-Football importer | [~] | bounded worker implementation and migrations present; staged 546/503 acceptance outstanding |
| PostgreSQL autovacuum | [x] | settings applied; autovacuum/autoanalyze verified |
| PostgreSQL injury refresh | [~] | invalid covering index identified; safe repair documented, not executed |
| PostgreSQL collation | [ ] | 153.120 vs 153.121; 251 indexes + partitioned index require maintenance window |
| Match 3D telemetry | [~] | frame campaigns and frame-time metrics implemented; exact CI and physical device evidence pending |
| Match 3D visual/perf optimization | [~] | inherited #127/#128 optimizations exist; no final high-quality physical 60 FPS proof |
| Multiplayer authority | [~] | queue/finalization protections and regression tests present; end-to-end server/DB authority and multi-room proof pending |
| Chat/moderation | [~] | #127 admission/moderation changes present; verify duplicate retries, Unicode abuse, audit trail and escalation end-to-end |
| Catalog gateway | [~] | code and paging changes present; host integrity blocks activation |
| Product/market | [ ] | persistent competitions/rankings, DAU/retention instrumentation, beta cohort and release notes incomplete |
| Main branch protection | [ ] | blocked by GitHub admin permission; repository admin action required |
| Final independent review and PR | [~] | Draft PR #132 exists; final review, all checks and readiness conversion remain |

---

## Task 0: Baseline, ancestry and release guardrails — COMPLETE

**Files:** existing GitHub history, PR metadata, CI workflow files, Supabase read-only catalog/log evidence.

- [x] Confirm repository, main SHA, integration branch and current PR states.
- [x] Confirm #127 merged and #128 head is already an ancestor of integration.
- [x] Identify #129–#131 as open/draft and non-mergeable.
- [x] Record branch-protection permission failure.
- [x] Record production autovacuum verification, injury index defect and collation scope.
- [x] Save this design and plan for cross-account handoff.

## Task 1: Reconcile PR #129 — API-Football importer and bundle baseline

**Files:**
- Modify: `supabase/functions/api-football-import/index.ts`
- Modify: `supabase/functions/_shared/football-window.mjs`
- Create: `drizzle/migrations/0067_api_football_full_custom450_quota.sql`
- Modify: `drizzle/migrations/meta/_journal.json`
- Create: `tests/sql/api-football-custom450-contract.sql`
- Modify: `scripts/edge-production-parity.test.mjs`
- Modify: `.github/workflows/quality.yml`
- Modify: `.github/workflows/bundle-impact.yml`
- Test: `scripts/bundle-baseline-resolver.test.mjs`

**Interfaces:**
- Preserve the existing `football_queue_settings`, `football_queue_claim`, `football_queue_window` RPC contracts and durable cursor semantics.
- Preserve deployed migration 0066; Custom450 migration is 0067, never a duplicate 0066.
- Scheduled worker lanes must be bounded (1–16 per request); manual admin pilot remains separately bounded.

- [x] Selected worker-window, importer, migration, SQL contract and baseline resolver changes are present.
- [ ] Compare PR #129's full diff against integration; port only missing behavior and tests.
- [ ] Add/verify tests for worker lane bounds, provider 429, Edge deadline, lease contention, idempotent resume and summary aggregation.
- [ ] Run RED→GREEN regression tests for the original 546/503/resource-limit path.
- [ ] Run `node --test scripts/edge-production-parity.test.mjs`.
- [ ] Run local Supabase migration replay and `tests/sql/api-football-custom450-contract.sql`.
- [ ] Run `npm run lint`, TypeScript, build and bundle comparator on the exact branch SHA.
- [ ] In staging, execute a representative import window; require no 546/503, no duplicate rows, no lost cursor/lease, and quotas within the configured Custom450 limits.
- [ ] Only after staging and CI pass, prepare a separate production rollout and monitor Edge logs.

## Task 2: Reconcile PR #130 — OAuth, auth routes and career countries

**Files:**
- Modify: `src/pages/auth.tsx`
- Modify: `src/hooks/useAuthMethods.ts`
- Modify: `src/integrations/supabase/social-auth.ts`
- Test: `src/integrations/supabase/social-auth.test.ts`
- Create/retain: `src/game/career-countries.ts`
- Test: `src/game/career-countries.test.ts`
- Modify: `src/pages/new.tsx`
- Modify: `src/routeTree.gen.ts` only when route generation requires it.

**Interfaces:**
- Continue using the same configured Supabase client/project; `signInWithOAuth(provider, { options: socialOAuthOptions(provider, callback()) })`.
- `fallbackAuthMethods(): AuthMethods` may expose only providers explicitly present in `VITE_AUTH_PROVIDER_ALLOWLIST`; never guess a provider.
- Preserve user UUIDs, career IDs, saves and MFA checks.

- [x] Direct Supabase OAuth and provider-discovery fallback are present.
- [x] Career-country canonicalization module is present.
- [ ] Compare full PR #130 diff; resolve overlaps with #127/#128 and remove obsolete broker-only remnants only after reference search.
- [ ] Write/verify tests for configured provider allowlist, empty/invalid allowlist, settings endpoint outage, callback error, recovery, MFA and cancellation.
- [ ] Run `npm exec -- vitest run src/integrations/supabase/social-auth.test.ts src/game/career-countries.test.ts --pool=forks --maxWorkers=1`.
- [ ] Run route tests for `/auth` and `/new`.
- [ ] Browser-verify narrow and desktop layouts, direct provider redirects, callback success and failure states.
- [ ] With an authorized existing test account, confirm same Supabase user ID and same career after Google OAuth; do not create a second identity or switch Supabase projects.
- [ ] Re-run full lint, TypeScript, build and Quality Gates.

## Task 3: Reconcile PR #131 — read-only catalog gateway

**Files:**
- `infra/vps/catalog/README.md`
- `infra/vps/catalog/gateway.py`
- `infra/vps/catalog/jm-catalog.conf`
- `infra/vps/catalog/jm-catalog.service`
- `infra/vps/catalog/smoke_test.py`
- `src/lib/vps-public-catalog.server.ts`
- `src/lib/vps-public-catalog.server.test.ts`

**Interfaces:**
- Only anonymous, read-only GET for public club catalogue; no service-role key, JWT forwarding, personal data, write routes or admin endpoints.
- Client pagination remains bounded and validates cursor/page size; cache has a hard memory ceiling.

- [x] Gateway assets and client page limit are present.
- [ ] Compare PR #131 diff and tests against current branch; verify 38,854 clubs, unique IDs, complete pagination and stale-while-revalidate semantics.
- [ ] Test malformed cursors, oversized pages, upstream timeout, partial pages, cache saturation and stale cache.
- [ ] Run gateway smoke test on an isolated clean staging host, not the compromised production VPS.
- [ ] Require clean host rebuild, verified external backup, credential/Tunnel token rotation, non-root service, loopback-only binding, Nginx allowlist, DNS canary and rollback.
- [ ] Keep `VPS_CATALOG_ENABLED=false` until all host-integrity gates pass. No Tunnel or DNS activation in this task.

## Task 4: Fix the generic club identity in quick-match

**Files:**
- Create: `src/game/quick-match-selection.ts`
- Modify: `src/components/game/QuickMatchPage.tsx`
- Test: `src/game/quick-match-catalog.test.ts`

**Interfaces:**
- `selectableQuickMatchClubs(leagueClubs: readonly Club[], canonicalClubs: Readonly<Record<string, Club>>): Club[]`.
- `randomQuickMatchPair(clubs: readonly Club[], random?: () => number): { home: Club; away: Club } | null`.

- [x] Canonical identity filter and distinct-pair selection are present.
- [x] Regression tests cover generic labels, missing canonical IDs, duplicate entries and default league.
- [ ] Run the focused Vitest test and Prettier/ESLint on exact files.
- [ ] Verify browser random selection across all catalog leagues; no generic name, duplicate team or same home/away ID.
- [ ] Verify fallback UI reports no valid league instead of inventing a club.

## Task 5: Fix public routes and responsive regressions

**Files:** `src/pages/auth.tsx`, `src/pages/new.tsx`, `src/pages/visual.tsx`, `src/pages/multiplayer.tsx`, route tests and affected UI components.

- [ ] Reproduce every known public-route error with exact URL, viewport and browser.
- [ ] Verify auth methods discovery outage has a usable, truthful fallback and no dead-end.
- [ ] Verify /visual WebGL unavailable message distinguishes unsupported/disabled GPU from an application crash.
- [ ] Fix mobile side-panel overlap and preserve safe-area, keyboard and focus behavior.
- [ ] Verify multiplayer unauthenticated states are intentional, not broken route transitions.
- [ ] Add regression tests for each confirmed bug before production code changes (TDD RED→GREEN).
- [ ] Run browser smoke tests desktop 1440px, tablet 768px and mobile 390px; capture screenshots.

## Task 6: PostgreSQL injury materialized-view refresh

**Files:**
- Modify: `docs/operations/featured-injury-refresh-performance.md`
- Modify only after verified DDL approval: operational SQL/runbook or a forward migration if the provider supports it safely.

**Confirmed defect:** `api_football_injury_league_cover_idx` exists with `indisvalid=false`, `indisready=false`, physical size 0 bytes. The refresh falls back to `api_football_injury_league_time_idx` and takes about 30–36 seconds. Autovacuum tuning is already applied and verified; it did not by itself prove the refresh fix.

- [x] Autovacuum thresholds applied and verified in production.
- [x] Invalid covering index identified; exact intended index definition is documented.
- [ ] Confirm current index state, database size, free storage, WAL/replica headroom and backup/PITR.
- [ ] Obtain an explicit maintenance window.
- [ ] Run `DROP INDEX CONCURRENTLY IF EXISTS public.api_football_injury_league_cover_idx;` outside a transaction.
- [ ] Run `CREATE INDEX CONCURRENTLY api_football_injury_league_cover_idx ON public.api_football_data USING btree (((payload -> 'league' ->> 'id')), (((payload -> 'league' ->> 'id')::integer))) WHERE kind = 'injury';` outside a transaction.
- [ ] Run `ANALYZE public.api_football_data;` and ordinary `VACUUM (ANALYZE) public.api_football_data;` in the approved window; never use VACUUM FULL.
- [ ] Verify `indisvalid=true`, `indisready=true`, non-zero index size and an index-only plan where visibility permits.
- [ ] Measure ten consecutive refreshes; record p50/p95, heap fetches and read buffers. Do not claim fixed until results support it.

## Task 7: PostgreSQL collation maintenance

**Files:** `docs/operations/postgres-collation-repair.md` and captured maintenance evidence.

- [x] Mismatch confirmed: recorded 153.120, actual 153.121.
- [x] Inventory documented: 251 ordinary indexes (~2.17 GB) and a partitioned Realtime index requiring provider-supported handling.
- [ ] Confirm current mismatch and regenerate the exact index list, including child indexes of partitioned parents.
- [ ] Obtain explicit maintenance window, recoverable backup/PITR, ≥3 GB free storage headroom, WAL/replica capacity, provider approval and rollback/stop thresholds.
- [ ] Rebuild each affected ordinary index with `REINDEX INDEX CONCURRENTLY schema.index;` one at a time, outside transactions.
- [ ] Coordinate provider-managed schemas and partitioned Realtime index with Supabase; do not assume the ordinary-index list covers them.
- [ ] Only after all indexes are rebuilt and valid, run `ALTER DATABASE postgres REFRESH COLLATION VERSION;` with supported database-owner privileges.
- [ ] Verify recorded/actual collation match, no invalid indexes, and query/error metrics return to baseline.

## Task 8: Match 3D instrumentation and benchmark evidence

**Files:**
- `src/game/frame-metrics.ts`
- `src/game/frame-campaign.ts`
- `src/game/fps-meter.ts`
- `src/game/native-performance-contract.ts`
- `src/components/game/FrameProbe.tsx`
- `src/components/game/Stadium3D.tsx`
- `src/components/game/stadium/StadiumScene.tsx`
- `src/components/game/stadium/RenderedFrameBridge.tsx`
- `src/game/match-measurement.ts`
- tests under `src/game/*frame*`, `src/game/*fps*`, `src/game/*graphics*`.

**Interfaces:**
- Preserve existing `fpsMeter.start/stop/reset/subscribe/sample` and `fpsReport` fields.
- Measurement identity includes seed, clubs, quality, camera, speed, phase, rules revision, viewport and DPR.
- Match and cutscene are separate campaigns; visible stalls are retained; hidden-tab time is excluded.

- [x] Frame campaign and percentile/low/stall instrumentation added.
- [x] Rendered-frame bridge and scene suspension props connected to the match page and quick match.
- [ ] Verify exact current branch tests and CI graphics contracts.
- [ ] Add regression tests for pause/resume, hidden tab, quality/DPR change, rules revision change, renderer/context loss and sample-capacity overflow.
- [ ] Run deterministic browser benchmark with fixed seed/fixture, 30 s warmup and ≥90 s measured window per scene.
- [ ] Capture baseline/candidate mean FPS, p50/p95/p99, 1%/0.1% lows, stalls >33/50/100/250 ms, draws, triangles, geometries, textures, programs, heap, GPU/backend and resolution.
- [ ] Upload raw samples, JSON, screenshots and video artifacts with hardware metadata.

## Task 9: Match 3D visual and GPU optimization

**Files:** inspect before changing; likely `src/components/game/stadium/**`, `src/components/game/players/**`, `src/components/game/cinematic/**`, asset pipeline and graphics contracts.

- [ ] Profile the highest-cost subsystems before optimizing: player rigs/skin/morphs, shadows/lighting, pitch/grass, stands/crowd, weather/particles, post-processing, cinematic environments and texture streaming.
- [ ] Keep simulation outside React render state; avoid per-frame React updates and object/array allocations.
- [ ] Use instancing/merged static geometry where compatible; preserve player animation and independent ownership of mutable rigs.
- [ ] Implement measured LOD, texture compression/mipmaps, shadow budgets, DPR/framebuffer budgets and adaptive postFX; do not reduce the quality contract silently.
- [ ] Optimize cutscenes separately from live match; avoid IBL recapture and asset stalls when scene parameters are unchanged.
- [ ] Add visual regression captures for day/night, rain/clear, goal/replay, broadcast/close cameras and low/mid/high presets.
- [ ] Physical Tier A acceptance: high preset mean ≥60 FPS, 1% low ≥50 FPS, p95 ≤20 ms, p99 ≤33.3 ms, no unexplained visible freeze >250 ms.
- [ ] Tier B/C: document actual achievable preset and stable adaptive fallback; never label synthetic browser output as physical-device evidence.

## Task 10: Multiplayer authority and anti-exploit

**Files:**
- `src/game/online/authoritative-match-session.ts`
- `src/game/online/authoritative-match-session.test.ts`
- `src/game/match-protocol.ts` and related validators
- server/Edge/RPC functions and SQL contracts identified by trace.
- `src/game/match.worker.ts`, `src/game/live-match.ts` only where protocol changes require it.

- [x] Queue serialization, bounded pending commands, ticket binding and immutable finalization code/tests are present in integration.
- [ ] Verify ticket signature, room/seat/user binding, issuedAt/expiry, monotonic sequence, rules revision, seed, tick and replay hash at server/DB boundary.
- [ ] Add tests for forged score/events, client-supplied winner, stale/replayed ticket, duplicate sequence, hash failure, signature retry, simultaneous finalize/forfeit and reconnect expiry.
- [ ] Implement durable result/idempotency write so retries cannot double-advance career, wallet, ranking or achievements.
- [ ] Test 2, 10, 50 and 100 concurrent rooms in staging; include disconnect/reconnect, duplicate packets, latency and worker restart.
- [ ] Run authorized exploit tests against isolated staging with synthetic accounts only; no production attack/load test.

## Task 11: Chat, moderation and community safety

**Files:** `src/pages/multiplayer.tsx`, `src/lib/chat.functions.ts`, room chat access/moderation modules, migrations and SQL contracts.

- [x] PR #127's admission/moderation groundwork is merged into integration.
- [x] Client send path includes a stable retry id and duplicate display suppression changes.
- [ ] Verify the client idempotency ID is persisted and enforced server-side (same ID + same payload returns original receipt; same ID + different payload rejects).
- [ ] Test NFKC/NFKD normalization, zero-width/bidi/control characters, homoglyphs, repeated spam, invite scams, harassment and rate-limit evasion.
- [ ] Enforce per-user/per-room limits on server/DB; do not rely on disabled buttons or client checks.
- [ ] Verify block, report, moderator action and immutable audit trail; human-review escalation for ambiguous/serious reports.
- [ ] Test Realtime room isolation, reconnect, duplicate delivery and moderation outage/fail-closed behavior.

## Task 12: Product quality, telemetry and beta readiness

**Files:** catalog sync provenance, mobile routes, competition/ranking modules, telemetry client/schema, beta and changelog docs.

- [ ] Canonicalize data provenance: provider/source ID, updated_at, last_synced_at, sync status, season, confidence and stale-data flags.
- [ ] Distinguish catalog records from selectable clubs with valid squads, logos, league membership and fresh data.
- [ ] Complete mobile UX QA for onboarding, career, match, multiplayer, chat and visual settings.
- [ ] Design persistent competitions and rankings with server-owned standings, idempotent fixture settlement and anti-abuse.
- [ ] Define and instrument DAU/WAU, D1/D7/D30 retention, match starts/completions, multiplayer room creation/join, crash-free sessions and frame-time percentiles; document consent/retention.
- [ ] Create closed beta cohort, feedback/reporting path, rollback criteria and public release/changelog template.

## Task 13: Security, branch governance and release readiness

- [ ] Request repository-admin action to protect `main`, require pull requests, require all named Quality Gates (including bundle, 200-seed stress, Rust/WASM parity, SQL replay, Lighthouse, CodSpeed and graphics contract), dismiss stale approvals and block force pushes/deletions.
- [ ] Audit OAuth, RLS/grants/RPC, Realtime policies, Edge auth, webhooks, rate limits, headers, dependency advisories and secrets exposure.
- [ ] Verify VPS clean rebuild, external backup restore, key rotation, non-root service, firewall and no public admin ports before considering gateway canary.
- [ ] Run SAST/DAST and limited active security checks only in isolated staging with explicit scope and stop conditions.
- [ ] Verify Cloudflare deployment workflow remains main-push + Quality Gates success only.

## Task 14: Final verification, independent review and PR

- [ ] Refresh branch head SHA and run the exact-head CI to completion; no canceled or stale run counts as a pass.
- [ ] Run `npm ci`.
- [ ] Run `npm run lint`.
- [ ] Run `npm exec -- tsc --noEmit --pretty false`.
- [ ] Run `npm test`.
- [ ] Run `npm run wasm:test` and `npm run wasm:build`; verify generated bindings/parity.
- [ ] Run `npm run test:stress -- --reporter=default --reporter=json --outputFile=stress-results.json` and the 200-seed rules-v2 stress job.
- [ ] Run `npm run build`, `npm run bundle:check`, `npm run test:performance-gates`, `npm run perf:match-setup -- .benchmark-base . match-setup-results` in the CI-equivalent environment.
- [ ] Verify local Supabase migration replay and all SQL contracts.
- [ ] Review visual evidence, Lighthouse, CodSpeed, bundle before/after and physical-device reports.
- [ ] Run a fresh independent whole-branch review against the spec and Review Focus.
- [ ] Fix all Critical/Important findings with TDD RED→GREEN and a full green suite; ledger deferred minors.
- [x] Create draft integration PR #132 from `integration/release-2026-11-11` to `main`, referencing #127–#131 and preserving the non-deploy statement.
- [ ] Complete all checks/evidence and independent review; update PR #132 body, mark ready only after every release gate passes.
- [ ] Do not merge or deploy until repository protection is configured, checks are green, operator-only DB maintenance is complete/approved, and the user explicitly authorizes release.

---

## Cross-account resume instructions

1. Open this repository and checkout/continue the existing branch `integration/release-2026-11-11`. Do not create a replacement branch.
2. Read this plan and `docs/superpowers/specs/2026-11-11-jogomanager-release-integration-design.md`.
3. Refresh the current branch SHA and the newest GitHub Actions runs. The SHA recorded in this document is a historical checkpoint, not a permanent pin.
4. Re-read PR #127–#131 status. #127 is merged; #128 is already in branch ancestry; #129–#131 remain to be reconciled. Never replay completed history.
5. Start at the first unchecked task in order. For any bug/behavior change use Superpowers TDD: write test → run and observe the expected failure → implement minimal fix → run and observe pass.
6. Use Superpowers systematic-debugging for any failing test or unexpected output. Never patch only the symptom.
7. Update the checkboxes and progress board in this file after every task, with commit SHA, exact command, exit/result and artifact URL. Keep this file as the source of truth across accounts.
8. Stop before any production DDL maintenance, VPS/Tunnel/DNS activation, main merge, or Cloudflare deploy; obtain explicit operator/release authorization.
9. Final deliverable is one reviewable PR to `main`, not a claim that all requested outcomes are complete.

**Next exact action:** inspect the newest PR #132 run for SHA `ec499d621de33ee148184b7411a7197054eedbef`; then continue Task 1 (PR #129 reconciliation) and Task 2 (PR #130 OAuth/career-country verification). Do not start Task 6 or 7 production DDL until maintenance approval.
