# JogoManager Release Integration Implementation Plan

## Reconciliação 26/11/2026

- [x] Confirmar a integração do [PR #171](https://github.com/davizeiro12345678/jogomanager/pull/171) na branch do PR #132. A análise CodeQL de `7ccbd8ad` passou. As conversas de análise do transporte WebSocket ainda exigem triagem pelo SHA.
- [x] Conferir execução conjunta de build, lint, TypeScript, testes, SQL, WASM, bundles, estresse de 200 partidas e Lighthouse no [Quality gates de `7ccbd8ad`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249368). O resultado pertence a esse commit.
- [x] Confirmar que produção responde `ready` no SHA `d8465771`, com Auth, credenciais do servidor e banco operacionais depois das correções anteriores do catálogo.
- [x] Confirmar a correção da regressão no decode de replay. No [CodSpeed de `d30091f`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722693), o decoder com arrays por quadro teve mediana 15,13% e 15,59% menor em dois runners. Uma rodada melhorou 16/16 medianas. A outra melhorou 15/16 e registrou +2,18% no encoder, dentro da tolerância do gate. Repetir a comparação na revisão que for publicada.
- [x] Conferir o [Lighthouse móvel de `d30091f`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722570). O rerun passou com 15/15 notas 100, LCP máximo 1.612 ms e TBT máximo 9,5 ms. Na primeira tentativa, duas amostras de `/melhores-formacoes` ficaram abaixo de 97.
- [x] Restaurar o histórico encadeado de saves no Supabase **hospedado de homologação**. A migração 0053 passou em transação de ensaio com rollback e foi aplicada no projeto isolado. Ledger vazio com RLS, trigger ativo, sem permissão de executar a função para `anon` e `authenticated`.
- [~] Conciliar a homologação. O painel ainda indica `MIGRATIONS_FAILED`. A instância PostgreSQL do VPS possui outro histórico. O reparo do ledger permite testar esse contrato e a divergência restante ainda precisa ser conciliada.
- [x] Validar login por senha e isolamento da leitura de carreira no Supabase isolado do VPS. Quatro contas sintéticas autenticaram. A RPC criou uma carreira, a conta proprietária leu um registro e a segunda conta leu zero. As quatro contas e o registro de teste foram removidos.
- [ ] Completar teste autenticado de passkey/OAuth, checkout sandbox e concessão idempotente, persistência de carreira e multiplayer com 2 e 4 participantes, além do ensaio de recuperação.
- [ ] Liberar o merge quando os gates do SHA a publicar, a revisão independente e a homologação estiverem comprovados. Conferir o novo SHA no `/api/health` após o deploy.

Os detalhes de materiais, iluminação, animação, física, IA e QA visual estão no [adendo Match 3D](2026-11-12-match3d-major-upgrade.md).

## Adendo ativo — Match 3D e SEO, 12/11/2026

O pedido mais recente amplia as Tasks 8–9 e a expansão física/IA sem substituir os demais pendentes. Continuar em [2026-11-12-match3d-major-upgrade.md](2026-11-12-match3d-major-upgrade.md), com [spec](../specs/2026-11-12-match3d-major-upgrade-design.md) e [ledger de execução](../../../verification/pr132-upgrade-20261112/progress.md). O adendo distingue correções verificadas neste lote do programa futuro de salto visual, GPU física e correção operacional/recrawl Semrush. Os snapshots de SHA e diagnósticos abaixo são históricos: atualizar antes de retomar.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to resume this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read the linked design spec first. Preserve the progress state below; do not repeat completed tasks.

**Goal:** Consolidate PRs #127–#131 and deliver a production-grade, evidence-backed JogoManager release candidate with secure auth, stable importer/PostgreSQL, authoritative multiplayer/chat, and measurable Match 3D performance.

**Architecture:** Continue on the existing React/TanStack/R3F/Three/Rapier + Rust/WASM + Supabase/PostgreSQL + Cloudflare stack. Reconcile history incrementally on the existing integration branch; validate each subsystem independently; only then create one final PR to `main`.

**Tech Stack:** Node/npm, TypeScript, React, TanStack, Three.js, React Three Fiber, Rapier, Rust/WASM, Vitest, ESLint, Prettier, Supabase/PostgreSQL, Cloudflare, CodSpeed, Lighthouse, Playwright/browser QA.

**Spec:** `docs/superpowers/specs/2026-11-11-jogomanager-release-integration-design.md`

**Expansão solicitada em 2026-11-11 (parte do mesmo PR #132):**
`docs/superpowers/plans/2026-11-11-multiplayer-ai-graphics-contact-expansion.md`.
Esse documento contém o diagnóstico específico de teleporte na recuperação da bola,
divididas e defesas, prioridades de anticheat, moderação/chat/suporte, novos modos,
IA futebolística e renderização. **Não** confundir objetivos de expansão com entregas
concluídas. As alterações de física têm contrato opt-in para não invalidar replays.
Progresso inicial: patch da física opt-in e caso anti-exploit cross-room adicionados;
testes CI e provas físicas/online ainda pendentes.

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

## Exact checkpoint — refreshed 2026-11-11

**Status:** Phase 1 — integration and CI stabilization. Draft release PR #132 exists; it is not merged to `main` and no production deployment has been triggered.

- Repository: `davizeiro12345678/jogomanager`
- Main SHA: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`
- Integration branch: `integration/release-2026-11-11`
- **Current integration SHA:** `88bc31045b92d0a25822e8dfbec9067e805fec85` (refreshed after the previous checkpoint; refresh again before resuming).
- PR #132: open, Draft, base `main`, head integration branch. It is the single review/release container; do not merge until exact-head CI and repository governance gates pass.
- PR #127: closed/merged into integration (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- PR #128: open/draft against `main`; head `32ac4219bf5dc4a357593a381f5e918876a741d0` is an ancestor of integration. Do not cherry-pick again.
- PR #129–#131: open/draft, retargeted to integration; selected changes have been reconciled into PR #132, but full diff review and exact-head tests remain.

### Repository governance

An active repository ruleset named `wadweew` exists, but its rule list does not include `required_status_checks`. The GitHub branch-protection endpoint returns HTTP 403 to the connected integration and no ruleset write action is available. A repository administrator must require Quality Gates, CodSpeed, deterministic stress, migration replay, bundle comparison and Match 3D evidence checks on `refs/heads/main`. Do not merge until this is configured.

### Current exact-head CI run set — SHA `88bc31045b92d0a25822e8dfbec9067e805fec85`

| Workflow | Run ID | State at observation |
|---|---:|---|
| Quality gates | 43089675217 | queued |
| Match 3D startup CPU diagnostic | 43089675003 | pending |
| Match 3D visual evidence | 43089674894 | in progress |
| Public environment and MCP safety | 43089674888 | success |
| Match 3D mobile draw inventory | 43089674777 | in progress |
| Match 3D lifecycle and context recovery | 43089674727 | in progress |
| Auxiliary match worker | 43089674724 | in progress |
| CodSpeed | 43089674703 | pending |

Only the public-environment/MCP-safety workflow had completed successfully. No full Quality Gates, bundle comparison, CodSpeed or physical-device acceptance result is confirmed for this SHA. Refresh runs before acting; do not use results from an older commit.

### Production database state

- Autovacuum thresholds on `public.api_football_data` are applied and verified: scale factors 0.5%, thresholds 20,000. Autovacuum completed at 19:26:01 UTC and autoanalyze at 19:25:51 UTC; latest sample had zero estimated dead tuples and zero modifications since analyze.
- Injury-count refresh remains slow: 28 recorded calls, mean 30,666.29 ms, maximum 36,022.63 ms. No covering index currently exists. A concurrent index build exceeded the SQL API's 120-second timeout; its incomplete index was removed. The valid but non-covering `api_football_injury_league_time_idx` remains in use. A staging plan comparison and operator-controlled concurrent build with a longer timeout are still required.
- Collation mismatch remains: recorded `153.120`, actual `153.121`. Exact inventory is 251 ordinary indexes (2,172.20 MiB) plus the partitioned `realtime.messages_replay_index` parent and six child indexes. No REINDEX or collation refresh has been run.
- API-Football code defaults to 8 lanes, caps scheduled workers at 12 lanes and 120 requests/window, and enforces a shared 9 fetches/second ceiling. Production 546/503 elimination is not proven until staged batch acceptance and post-deploy telemetry.
- No physical-device high-quality 60 FPS proof exists; headless CI evidence is not sufficient.
- Cloudflare deployment has not been triggered. VPS gateway/Tunnel remains disabled. No active attack test was run against production.

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
- Scheduled workers default to 8 lanes, accept 1–12 per request, and are capped at 120 requests/window with a shared 9 fetches/second ceiling; the authenticated manual pilot remains separately bounded.

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

**Confirmed defect (read-only refresh 2026-11-11):** `api_football_injury_league_cover_idx` is currently absent; `api_football_injury_league_time_idx` remains valid/ready at about 1,976 kB. The materialized-view refresh has 28 recorded calls, mean 30,666.29 ms and maximum 36,022.63 ms. Autovacuum is healthy but has not fixed the refresh. A prior covering-index build exceeded the Supabase SQL tool's 120-second statement timeout; the incomplete index was removed. Do not retry through that same short-timeout path.

- [x] Autovacuum thresholds applied and verified in production.
- [x] Confirmed the covering index is absent and the time index remains valid; the intended covering definition is documented.
- [ ] Reconfirm current index state, database size, free storage, WAL/replica headroom, backup/PITR and provider constraints.
- [ ] Obtain an explicit maintenance window and an operator-controlled PostgreSQL session with a suitable statement timeout.
- [ ] If the covering index is absent (current state), create it with `CREATE INDEX CONCURRENTLY api_football_injury_league_cover_idx ON public.api_football_data USING btree (((payload -> 'league' ->> 'id')), (((payload -> 'league' ->> 'id')::integer))) WHERE kind = 'injury';` outside a transaction. If an invalid remnant reappears, inspect it and drop it concurrently before retrying.
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
- [x] Verify exact current branch tests and CI graphics contracts. (SHA a54090be, contratos e recuperação aprovados; campanha visual completa e hardware físico pendentes.)
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
- [x] Run `npm ci`. (SHA a54090be, CI 45830854917; repetir no head final.)
- [x] Run `npm run lint`. (SHA a54090be, CI 45830854917.)
- [x] Run `npm exec -- tsc --noEmit --pretty false`. (SHA a54090be, CI 45830854917.)
- [x] Run `npm test`. (Suíte equivalente Vitest do CI 45830854917 em a54090be; stress separado.)
- [ ] Run `npm run wasm:test` and `npm run wasm:build`; verify generated bindings/parity.
- [ ] Run `npm run test:stress -- --reporter=default --reporter=json --outputFile=stress-results.json` and the 200-seed rules-v2 stress job.
- [ ] Run `npm run build`, `npm run bundle:check`, `npm run test:performance-gates`, `npm run perf:match-setup -- .benchmark-base . match-setup-results` in the CI-equivalent environment.
- [x] Verify local Supabase migration replay and all SQL contracts. (CI 45830854917 em a54090be; staging real permanece pendente.)
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


## Addendum 25/11/2026 — sequência ampliada de execução

**Estado:** PR #132 aberto em Draft; nenhum merge ou deploy de produção autorizado. HEAD observado nesta retomada: ac2dd4065e93e48952bf2dbb4968b78ed28d3705. Revalidar o SHA antes de encerrar qualquer gate.

### Sequência prioritária
1. **Integridade do release:** concluir CodSpeed, Lighthouse Mobile, startup diagnostics e evidência visual no mesmo HEAD. CodSpeed falhou no HEAD atual; não reutilizar o PASS 16/16 do HEAD anterior.
2. **Staging exato:** reconstruir em checkout limpo e isolado, fixado no SHA atual. O staging existente está em fb07df1 e não valida o PR atual. Preservar o checkout antigo com alterações locais.
3. **Mega auditoria VPS:** concluir matriz de containers, serviços, sockets, firewall, Tailscale, SSH/CA, certificados, ACLs, sudoers, processos, logs, systemd sandbox e rotas. Aplicar mudanças somente com backup, dry-run, teste de saúde e rollback.
4. **Chrome QA:** manter perfil virtual isolado com ANGLE/SwiftShader e WebGL2/WebGPU smoke. Registrar explicitamente que SwiftShader é CPU software e não certifica FPS físico.
5. **API/authz:** repetir testes com contas sintéticas em staging; validar cron, Stripe, guest checkout, ownership, RLS, exposição de dados e cache. Não usar credenciais ou dados reais para contornar preview incompleto.
6. **Engine determinística:** auditar contratos de autoridade, fixed-step, RNG, checkpoints, replay, Worker/WASM, serialização, rollback e compatibilidade. Nenhuma alteração na ordem de RNG, autoridade ou regras sem paridade e regressão.
7. **Stack gráfica:** ampliar pipeline de assets, KTX2, shaders, LOD, crowd/stadium, sombras, câmera, pós-processamento, WebGL2/WebGPU fallback e budgets por perfil. Comparar ABBA e manter fallback compatível.
8. **Detecção de malware:** benchmark controlado EICAR/fixtures benignas e malformadas entre ClamAV, URLhaus, Maldet, Wazuh/Elastic/Tracee; revisar ELF header e falso positivo sem executar amostras.
9. **Modelo local:** comparar Qwen e alternativas por qualidade, latência, memória e segurança; manter o modelo atual até benchmark reproduzível.

### Regras de liberação
- Não reduzir limites de Lighthouse/CodSpeed para fazer o gate passar.
- Não promover resultado de software renderer a certificação de GPU física.
- Não alterar funcionalidades reservadas do Match 3D.
- Não remover sudoers, reiniciar agentes privilegiados ou alterar SSH sem preservar acesso break-glass.
- Todo item permanece pendente até evidência reproduzível no SHA exato.

### Continuação do checkpoint do PR #132

A auditoria desta retomada parte de `be8c85f6acc7b5072baa5e3bd96d6d3820ae9321`, com `main` em `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. O resultado mais recente do CodSpeed nessa base substitui o FAIL histórico de `ac2dd4`. A execução pareada `45724718106` aprovou os 16 benchmarks por mediana. O gate crítico `45724717936` reprovou em uma amostra de `/guias`, com desempenho 0,96 e LCP de 2.633 ms.

1. Repetir todos os gates no commit da continuação. Em especial, executar três amostras das cinco rotas e comparar as 16 medições do CodSpeed. Conferir medianas, caudas e hashes de estado.
2. Homologar o commit candidato em staging isolado com Chrome, contas sintéticas e pagamento em sandbox. O preview atual do VPS está em `fb07df1`. O Chrome disponível no VPS renderiza com ANGLE/SwiftShader.
3. Fechar a revisão CodeQL das threads de transporte autoritativo e a análise das superfícies GraphQL/RLS. Testar o controle de acesso esperado com dados sintéticos. Usar o ledger para rastrear cada evidência.
4. Completar o protocolo visual e térmico em hardware físico, a cobertura de partidas e os critérios versionados de física e IA. Cobertura de lógica e uma cena renderizada por software são entregas parciais.
5. Resolver as threads exigidas pela proteção de `main`, revisar a candidata de forma independente, comprovar rollback e validar a seção de release na spec antes de promover.

## Checkpoint comprovado — 26/11/2026 (PRs #132 e #179)

Este checkpoint substitui estados operacionais antigos, sem apagar o histórico. Não criar outro PR: #132 é a integração para main e #179 é a correção da auditoria destinada à integração. Ambos continuam Draft. Sem merge em main ou deploy.

### Evidências fechadas e critérios restantes

- [x] Confirmar produção: `/api/health` respondeu HTTP 200/ready com release `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. Não certifica o candidato nem resolve a intermitência histórica de 503.
- [x] Validar a política Vite em processo real, no checkout isolado de `a54090bee9fdde44aacd5c7966036ef869b16a66`, bind loopback e sem credenciais de produção: host autorizado 200, host não autorizado 403, localhost 200 (Gateway job `job_01M8C1WQ5400QT7R0K26HWGEAT`, exit 0). Preview externo autenticado ainda pendente.
- [x] CI do SHA acima: npm ci, lint, tipos, Vitest, build, bundle absoluto/comparativo, replay SQL, Rust/WASM, duas suítes de stress de 200 partidas, contrato gráfico e MatchSim passaram no [Quality Gates 45830854917](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854917). Lighthouse mobile e gate agregado ainda não concluídos no momento da observação.
- [x] CodeQL [45830854794](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854794), 43 suítes [45830854544](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854544), nove eixos [45830854594](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854594), inventário independente automatizado [45830854781](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854781) e CodSpeed [45830854573](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854573) passaram nesse SHA. Não equivale a revisão humana independente nem QA autenticado.
- [x] PR #179: remoção de skip link duplicado no GameShell, foco no conteúdo da carreira e disponibilidade 1x1/2x2 comunicada honestamente (`01fea245`); i18n em pt/en/es (`515e3c3`); comparador por grafo de imports, sem alterar orçamento de 2048 B (`eef1a388`). 35/35 testes locais de gates; [comparação real 45830207865](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207865) passou no job bundle. O PR #179 ainda reprovou Lighthouse (home 0,92; TBT 320 ms) e CodSpeed [45830207885](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207885). Não está liberado para integrar.
- [x] VPS: oito patches originais instalados (Kerberos, libpcap, libtiff, runsc); gerenciador de patches ativo, reboot automático desligado; curadoria LMD corrigida com testes e hash da base preservado; On-Access 64→128 MiB no diretório de ingestão; SSH sem senha/root, serviços críticos ativos, zero unidades failed nas amostras. EICAR do daemon aprovado, prevenção acima de 64 MiB ainda não provada.
- [x] Backup local: 5/5 checksums, 1.034 entradas de configuração, restauração isolada do dump JogoManager com duas tabelas, instância encerrada e cópia temporária removida. Timer externo habilitado; nenhum upload confirmado.
- [ ] Backup externo: OAuth do Google Drive e verificação da recuperação criptográfica ausentes; manter gate, não fabricar marcador. Wazuh 4.14.11 pendente de backup restaurável do Indexer e upgrade coordenado dos três serviços centrais antes do agente.
- [ ] Autenticação real (OAuth/passkey/MFA/recuperação), Stripe sandbox/webhook/idempotência, persistência de carreiras, multiplayer 1x1 e 2x2 com dispositivos/assentos reais; staging isolado no SHA exato.
- [ ] UI: CLS auth observado 0,876 e loja 0,162 na produção em Chrome mobile; investigar causa e repetir medidas comparáveis; Lovable removido no código, não confirmado em produção.
- [ ] Match 3D: erro GL_INVALID_VALUE observado duas vezes em campanha anterior e não reproduzido na repetição; GPU stall persiste; simulação completa, benchmark físico, materiais/anatomia, animação, clipping, cutscenes, física e IA precisam de evidência comparável. SwiftShader não certifica FPS físico.
- [ ] Fechar Lighthouse, CodSpeed e QA visual no novo HEAD, revisar threads/alertas restantes (incluindo #47 mencionado anteriormente), validar CSP estrita, backup externo, rollback e revisão independente; só então considerar aprovação. Nenhuma alteração de limites, bypass ou deploy.

**Continuidade:** atualizar estes três arquivos existentes e a descrição dos PRs com evidência, sem marcar tarefas compostas como concluídas apenas por subtarefas. Não incluir IPs, caminhos pessoais, credenciais ou localização de usuário em evidência pública. Qualquer commit de documentação gera um novo SHA; revalidar os gates no novo head.

## Continuação P0/P1 — 26/11/2026

- [x] Conferir resultados históricos do HEAD ac28fd52 (#132): 14 workflows concluídos com sucesso, incluindo [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183094), [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183163), CodeQL e evidência visual. Não transferir aprovação ao próximo SHA.
- [x] Conferir HEAD a3a85002 (#179): [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885174) e [evidência visual](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885003) aprovados. [CodSpeed pareado](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835884910) reprovado em cinco benchmarks (buildTeamSetup +18,30%, snapshotMatch +7,73%, decodeReplay +24,29%, Rust/WASM 64 +68,46%, Rust/WASM 16 +33,46%). Sem alteração de limiares. A diferença de código em relação à base inclui a estimativa de bytes de replay, mas não a implementação dos cinco kernels; causalidade ainda não demonstrada.
- [x] Corrigir três regressões do handshake WSS: ticket expirado antes do open, ready recebido após expiração e open duplicado. RED 3/3; GREEN 63/63 em cinco suítes (cliente, feed, protocolo, bridge e latência), ESLint focal, Prettier e diff check aprovados. A sessão deve renovar o ticket antes de aceitar estado oficial; não modificar autoridade de servidor.
- [ ] Reavaliar alerta CodeQL #47 e threads de revisão (11 abertas no #132 no momento da coleta). A correção acima fortalece o transporte, mas não comprova fechamento do alerta nem revisão independente.
- [ ] Homologação Supabase/Stripe: apenas projeto de produção acessível; não substituir staging independente por produção. Não foram executadas cobranças reais, migrações de produção ou testes com usuários reais.
- [ ] Backup externo: timer ativo, mas OAuth e confirmação criptográfica continuam ausentes. Sem upload comprovado; Wazuh 4.14.11 depende de backup restaurável do Indexer e upgrade coordenado.
- [ ] CodSpeed do #179, CI do próximo SHA, QA autenticado, desempenho em GPU física, materiais/animação e merge/deploy permanecem condicionados aos respectivos gates. Não criar outros PRs.


## Continuação P0/P1 — isolamento de evidências (26/11/2026)

- [x] Reproduzir e corrigir a leitura por links simbólicos no coletor graphics-source-snapshot: dois casos RED e três testes GREEN, incluindo caso normal. Restringir caminhos ao checkout, rejeitar symlinks e arquivos não regulares, usar descritor com O_NOFOLLOW e lista Git delimitada por NUL. Teste conectado ao CI cinematográfico. A corrida de troca concorrente de diretórios ancestrais por outro processo local não é certificada; executar em checkout isolado.
- [x] Conferir quatro workflows apontados por persistência de credenciais: cinematic-recovery, 43-acceptance, independent-diff-review e nine-axis já possuem persist-credentials: false no HEAD d2a6d4e. Nenhuma exceção do scanner adicionada.
- [ ] Fechamento dos alertas de scanners e revisão independente: revalidar no novo SHA; threads não resolvidas automaticamente. Alerta #47 não certificado.
- [ ] CodSpeed #179 bd77aadd: gate pareado 45841850637 reprovado em buildTeamSetup (+3,65%), decodeReplay (+17,26%) e fallback de rig 16 radial (+7,89%). Não alterar limiares nem imputar causa sem evidência. Bundle e shell Lighthouse passaram em ambos os PRs na coleta; Lighthouse mobile completo ainda em andamento.
- [ ] VPS: serviços críticos ativos, zero unidades failed, timer externo habilitado mas sem OAuth e comprovação criptográfica. Wazuh 4.14.11 aguarda backup restaurável. Gateway Free, saldo zero e contratação de backups restrita ao titular. Não publicar credenciais ou dados privados.
- [ ] Staging: apenas Supabase de produção listado; dois contextos Stripe de teste disponíveis, sem checkout real executado. Continuam pendentes autenticação, webhook, multiplayer real, GPU física e release. Não criar novos PRs, não publicar main.


## Continuação P0/P1 — inventário imutável de QA (26/11/2026)

- [x] No HEAD 46eee81e do #132, Quality Gates [45842832159](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832159), CodSpeed [45842832106](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832106), CodeQL, 43 suítes, nove eixos e diagnóstico de startup aprovados. Evidência visual ainda em execução na coleta; não transportar resultados para novo HEAD.
- [x] Remover leitura direta do checkout nos dois inventários do QA de nove eixos: apenas blobs regulares do SHA informado, com limite de bytes, sem seguir symlinks e sem ler conteúdo local alterado. RED módulo ausente, GREEN 4/4 incluindo dois testes existentes; sintaxe e diff check aprovados. Ensaio no histórico real: 576/576 fontes elegíveis lidas, zero omitidas. Adicionar testes ao CI existente. Revisão independente e confirmação do scanner ainda pendentes.
- [ ] PR #179 em b83a0d16: CodSpeed pareado [45843063830](https://github.com/davizeiro12345678/jogomanager/actions/runs/45843063830) reprovado em decodeReplay (+18,56%, 4,366291 para 5,176627 ms). Manter limites; não declarar regressão causal sem isolar a diferença de código e repetir em ambiente comparável.
- [ ] VPS: zero unidades failed, SSH efetivo RSA mínimo 2048, serviços essenciais ativos. Timer externo ativo mas OAuth e verificação criptográfica ausentes; sem transferência confirmada. Wazuh aguarda backup do Indexer. A varredura longa está executando; não interromper para alterar política de timeout.
- [ ] Gateway: plano Free e saldo zero confirmados; titular precisa contratar Pro/recarga no painel. Ops bundle incluído no Pro, não comprar redundância. Sem pagamento efetuado.
- [ ] Homologação autenticada, Stripe sandbox, multiplayer real, GPU física, revisão dos alertas, CSP efetiva e deploy continuam pendentes. Manter #132 e #179; nenhum novo PR nem alteração em main.

## Retomada da homologação de 26/11/2026

O [registro de progresso](./2026-11-11-jogomanager-release-integration.progress.md#homologação-retomada-em-26112026) reúne a campanha visual concluída, as medições de layout no Chrome, a correção da barra traseira do calção e a validação do transporte. O check nativo do CodeQL, o staging autenticado na revisão de entrega, a GPU física e a restauração externa continuam como critérios de publicação.


## Continuação P0/P1/P2 — integridade e diagnóstico das texturas (26/11/2026)

- [x] Reproduzir falha do QA de nove eixos do HEAD 7ec779c5: [run 45846818641](https://github.com/davizeiro12345678/jogomanager/actions/runs/45846818641), HTTP 403 ao baixar KTX2. Sondagem independente do VPS confirmou 302 do domínio principal para football-manager.app e 403 no destino; conector Cloudflare não lista essa zona. Não desativar WAF nem contornar controle de acesso.
- [x] Reforçar preparação de fixtures: validar OID Git, limitar manifesto a 64 KiB e textura a 16 MiB, identificar arquivo/host/status HTTP sem imprimir URL completa e remover temporário após falha. TDD isolado: 4/5 RED e 5/5 GREEN; teste conectado ao workflow existente. A primeira execução RED fez uma solicitação pública incidental; repetição corrigida usou mocks de rede.
- [ ] P0: restaurar entrega autorizada das texturas reais e executar nove eixos no SHA novo. Não substituir por imagens fictícias nem ignorar 403.
- [ ] P0: PR #179 6fa4bf09 [CodSpeed 45844733604](https://github.com/davizeiro12345678/jogomanager/actions/runs/45844733604) falhou em MatchSim (+8,96%); causa ainda não comprovada. Preservar limites e revisar novo SHA.
- [ ] P0/P1: staging autenticado, Stripe sandbox, backup externo restaurável, Wazuh coordenado, CodeQL nativo e GPU física seguem pendentes. P2: confirmar CLS, acessibilidade, textos e carregamentos em candidato publicado de homologação. Sem merge em main ou deploy.


## Continuação P0/P1 — homologação remota dos contratos SQL (26/11/2026)

- [x] Localizar branch Supabase staging-release-132, isolada e with_data=false. Consulta SQL funciona apesar do status histórico MIGRATIONS_FAILED e get_project retornar not found; não alterar ou usar produção.
- [x] Executar contratos do SHA b1619cd no preview remoto com BEGIN/ROLLBACK: atomic-match-room, cooperative-match-roster, authoritative-match-settlement, private-matchmaking-queue, match_contact_revision e room-authority-fencing. Todos passaram. 
- [x] RED atomic-ranked-match-allocation: 42501 na tentativa de UPDATE direto em sala websocket; proteção correta. GREEN: fixture usa RPC de liquidação para schema 0077+, exige rejeição do UPDATE direto, preserva verificação antiga para 0075. O contrato corrigido passou no preview remoto. Sete contratos SQL aprovados.
- [x] Verificação após rollback: 0 auth.users, salas, queue, pairs, resultados, ratings e crons ativos; 78 tabelas públicas, todas com RLS. O fencing testa permissões temporárias apenas dentro da transação descartada.
- [ ] CI do novo SHA, replay legado 0075, testes autenticados em browser, clientes reais 1x1/2x2, passkey, Stripe sandbox, deploy e recuperação externa permanecem pendentes. O sucesso SQL não certifica esses fluxos.


## Continuação P1/P2 — integridade de medições (26/11/2026)

- [x] P1: comparador de campanhas rejeita renderizadores software conhecidos (SwiftShader, llvmpipe, WARP, entre outros) e modo headless/vídeo não explicitamente falso. Adiciona p50 e 0,1% low ao resumo sem alterar limiares. Não constitui atestação de hardware físico.
- [x] P2: TTFB quente exclui a primeira tentativa por posição cronológica, mesmo se a resposta inicial falhar; contadores de cabeçalhos usam mapas sem protótipo. Não altera endpoints nem volume de requisições.
- [x] RED reproduzido para ambos; GREEN 7/7 testes de campanhas, autoteste TTFB e sintaxe Node 24.22.1 aprovados em arquivos isolados no VPS. Primeira tentativa sem Node no PATH não é evidência de falha de código. CI completo ainda pendente.
- [ ] P0: QA de nove eixos do SHA 5f12d7dc reprovou na preparação de texturas reais (HTTP 403); não contornar WAF. Staging autenticado, Stripe, GPU física, backup externo, Wazuh, revisão e release permanecem condicionados aos gates existentes. Não abrir novo PR, não publicar main.
