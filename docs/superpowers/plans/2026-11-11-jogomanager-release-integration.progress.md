# SDD ledger — plan: docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md

## Checkpoint 2026-11-11 — refreshed after production and CI inspection

- Integration branch: `integration/release-2026-11-11`
- Exact branch SHA at this checkpoint: `9ac3af9f7338b15d83530df6ee61a3a88bedf1e7`
- Main SHA last read: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`
- PR #132: open, Draft, base `main`, head `integration/release-2026-11-11`; not merged and not deployed.
- Design: `docs/superpowers/specs/2026-11-11-jogomanager-release-integration-design.md`
- Plan: `docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md`
- This ledger is the portable continuation record. Refresh branch SHA and CI run IDs before resuming.

### PR ancestry

- PR #127: closed and merged into the integration branch (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- PR #128: open/draft against `main`; head `32ac4219bf5dc4a357593a381f5e918876a741d0` is an ancestor of integration. Do not cherry-pick it again.
- PR #129: open/draft, retargeted to integration; selected importer, Custom450 migration 0067, SQL contract, bounded worker changes and bundle baseline work are ported. Exact-head validation and staged importer acceptance remain.
- PR #130: open/draft, retargeted to integration; direct Supabase OAuth, allowlist-only fallback, tests and career-country module are present. Existing-account continuity, callback, recovery/MFA and browser validation remain.
- PR #131: open/draft, retargeted to integration; read-only gateway and paginated catalog changes are present. VPS/Tunnel/DNS activation remains blocked pending host integrity and clean rebuild evidence.

### Repository governance

- One active repository ruleset exists, but it does not include `required_status_checks`.
- The branch-protection administration endpoint returns HTTP 403 to this GitHub integration; no ruleset write action is available. A repository administrator must add required checks and scope enforcement to `refs/heads/main`.
- Do not merge PR #132 until the administrator requirement is satisfied and exact-head checks pass.

### Latest exact-head CI set observed

| Workflow | Run ID | State at observation |
|---|---:|---|
| Auxiliary match worker | 43089449464 | queued |
| Match 3D lifecycle/context recovery | 43089449441 | in progress |
| Match 3D mobile draw inventory | 43089449348 | in progress |
| Match 3D visual evidence | 43089449332 | pending |
| Match 3D startup CPU diagnostic | 43089449462 | pending |
| CodSpeed | 43089449360 | pending |
| Quality gates | 43089449768 | pending |
| Public environment/MCP safety | 43089449304 | success |

A previous exact-head run set was canceled when the branch advanced. A prior auxiliary-worker run failed on a Prettier assertion in `src/game/quick-match-catalog.test.ts`; that formatting has since been corrected. Do not assume the current run set is green—inspect the latest runs for the current SHA before reporting results.

### Production evidence

- `public.api_football_data` autovacuum thresholds are applied and read back: vacuum/analyze scale factor 0.5%, threshold 20,000. Autovacuum completed at 2026-11-11 19:26:01 UTC and autoanalyze at 19:25:51 UTC; latest sample showed zero estimated dead tuples and zero modifications since analyze.
- The injury-count materialized-view refresh is **not fixed**. The latest observed run took 36.024 seconds at 2026-11-11 19:00 UTC. No `api_football_injury_league_cover_idx` or replacement currently exists. A concurrent covering-index build exceeded the SQL API's 120-second timeout and the incomplete index was removed. The planner still uses the valid but non-covering `api_football_injury_league_time_idx`. Staging plan comparison and an operator session with a longer timeout are required.
- PostgreSQL collation mismatch remains: recorded `153.120`, actual `153.121`. Exact inventory: 251 ordinary indexes (2,172.20 MiB) plus the partitioned `realtime.messages_replay_index` parent and six child indexes. No REINDEX or collation refresh has been run; this is a maintenance-window operation.
- API-Football importer changes and migrations 0067–0070 are in the branch. Elimination of production 546/503 errors is not proven until a representative staged batch and post-deploy telemetry pass.
- No physical-device high-quality 60 FPS evidence exists. CI/headless screenshots are not accepted as physical GPU proof.
- Cloudflare production deployment has not been triggered. VPS gateway/Tunnel remains disabled. No active attack test was run against production.

## Completed in this workflow

- [x] Read Superpowers using-superpowers, brainstorming, writing-plans, executing-plans, TDD, systematic-debugging and verification-before-completion skills.
- [x] Reviewed current repository branch, main, PR #127–#131, Quality workflow, bundle workflow, Supabase production telemetry and Postgres maintenance evidence.
- [x] Confirmed #127 merged to integration (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- [x] Confirmed #128 head is already an ancestor of integration; no duplicate cherry-pick required.
- [x] Saved release design spec.
- [x] Saved Superpowers implementation plan with task-by-task checkboxes, exact files, interfaces, tests and acceptance criteria.
- [x] Saved this cross-account progress ledger.

## In progress / not complete

- [~] PR #129 reconciliation: selected importer, Custom450 migration 0067, SQL contract, bounded worker changes and bundle baseline resolver changes exist. Full diff reconciliation, exact-head tests and staged importer acceptance remain.
- [~] PR #130 reconciliation: direct Supabase OAuth, fallback provider discovery and career-country module exist. Real existing-account continuity, callback, recovery/MFA and browser tests remain.
- [~] PR #131 reconciliation: read-only gateway assets and client pagination exist. Full tests and clean-host staging remain; VPS/Tunnel/DNS activation is prohibited until host integrity is proven.
- [~] Quick-match generic club filter/tests exist; exact-head focused and full CI results still needed.
- [~] Bundle baseline workflow has been repaired in several commits; exact-head baseline/candidate artifact comparison remains pending.
- [~] Frame campaign instrumentation and rendered-frame bridge exist; physical-device high-quality 60 FPS evidence is absent.
- [~] Multiplayer queue/finalization hardening and tests exist; operational authoritative transport, durable result writes and multi-room stress remain.
- [~] Chat admission/moderation groundwork from #127 is present; end-to-end idempotency, Unicode abuse and moderation audit tests remain.
- [x] Production API-Football autovacuum thresholds are applied and verified; this does not yet fix the materialized-view refresh.
- [ ] Repair invalid injury covering index in an approved maintenance window.
- [ ] Rebuild collation-dependent indexes in an approved maintenance window, then refresh the database collation version.
- [ ] Configure main branch protection and required checks through a repository admin; current GitHub integration receives HTTP 403 for branch-protection administration.
- [ ] Implement/verify persistent competitions, rankings, DAU/retention instrumentation, beta cohort and public changelog.
- [~] Draft PR #132 exists against main; complete independent review, exact-head CI and evidence before marking ready.
- [ ] No main merge or production deploy has occurred in this workflow.

## Draft PR checkpoint

- PR #132: https://github.com/davizeiro12345678/jogomanager/pull/132
- State: open, draft, base `main`, head `integration/release-2026-11-11`.
- Head SHA: `ec499d621de33ee148184b7411a7197054eedbef`.
- PR #132 is a staging/review container only; not approved for merge or deployment.

## Latest CI checkpoint

Latest PR #132 run set observed on SHA `ec499d621de33ee148184b7411a7197054eedbef`:

| Workflow | Run ID | State |
|---|---:|---|
| Match 3D lifecycle and context recovery | 43088763738 | in progress |
| CodSpeed | 43088763694 | in progress |
| Public environment and MCP safety | 43088763902 | success |
| Match 3D startup CPU diagnostic | 43088763706 | in progress |
| Auxiliary match worker | 43088763652 | in progress |
| Match 3D mobile draw inventory | 43088763656 | in progress |
| Quality gates | 43088763599 | pending |
| Match 3D visual evidence | 43088763788 | in progress |

A prior run set on parent SHA `1496e779fdf4d3deb2b462eba54429a68722f5a1` was canceled after the branch advanced; its successful safety job is not a substitute for current Quality Gates. Inspect the newest runs for the latest branch head. Do not claim tests pass until the exact-head runs finish successfully.

## Production evidence checkpoint

- Autovacuum options on `public.api_football_data`: `autovacuum_vacuum_scale_factor=0.005`, `autovacuum_vacuum_threshold=20000`, `autovacuum_analyze_scale_factor=0.005`, `autovacuum_analyze_threshold=20000`.
- Latest read-only stats after autovacuum: approximately 10.3M live tuples, 0 estimated dead tuples, 0 modifications since analyze; last autovacuum and autoanalyze completed.
- Injury view refresh remained approximately 30–36 seconds before the covering-index repair; `api_football_injury_league_cover_idx` was invalid, not ready and zero bytes.
- Collation recorded version `153.120`; actual version `153.121`.
- Collation inventory: 251 ordinary indexes, approximately 2.17 GB, plus partitioned Realtime index. Do not run without maintenance approval and provider coordination.

## Next action when resuming

1. Refresh the integration branch head SHA and list the latest workflow runs.
2. Inspect the current auxiliary-worker and Quality Gates logs; fix the first real failure with Superpowers systematic-debugging and TDD.
3. Continue Task 1 in the plan: compare PR #129 full diff against integration and port only missing changes; do not cherry-pick whole PRs.
4. Then Task 2: reconcile PR #130 auth/career-country changes and prove same-user/same-career OAuth continuity.
5. Keep Tasks 6–7 (production index/collation operations), VPS activation, branch protection admin, main merge and Cloudflare deploy behind their explicit gates.

## Rulings

- Ruling: use the existing integration branch and preserve its ancestry — PR #127 is merged and PR #128 is already an ancestor; replaying either would duplicate changes and risk migrations.
- Ruling: keep VPS gateway disabled — the previous host has an unresolved root-compromise history and no current proof of clean rebuild, backup restore and credential rotation; cost if wrong is exposing the production catalog host.
- Ruling: do not automatically repair collation or the injury index — the operations affect a multi-GB index footprint and need backup, storage/WAL/replica capacity and maintenance monitoring; cost if wrong is production query degradation or index inconsistency.
- Ruling: do not declare 60 FPS from CI/headless evidence — GPU/browser emulation does not represent physical devices; cost if wrong is a false performance claim and regressions on actual player hardware.

## Handoff update — PR #132

- Draft PR #132 was created/confirmed at `https://github.com/davizeiro12345678/jogomanager/pull/132`.
- It targets `main`, remains Draft, and has no merge or deploy authorization.
- The PR description records the Custom450 worker budget (8 default lanes, max 12, 120 requests/window and 9 fetches/s) and documents the remaining PostgreSQL repair constraints. Verify those values against the exact importer code and tests before release.
- The exact-head PR checks are still running; the only completed latest job observed was Public environment and MCP safety (success). No full Quality Gates result yet.
