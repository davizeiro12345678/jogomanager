# JogoManager performance and correctness implementation plan

> For agentic workers: use the Superpowers debugging, implementation, and review workflows. Execute the user's authorized work continuously, with independent file ownership.

**Goal:** Correct the current TypeScript failures, reduce avoidable Supabase traffic, validate the database compute choice, and improve player and match rendering with reproducible evidence.

**Architecture:** Preserve the existing TanStack Start/React/R3F/Rapier stack and deterministic simulation worker. Treat public read caches, authenticated data, service-worker assets, and rendering as separate ownership boundaries. Compare the same source revision, fixtures, viewport, and measurement protocol before and after.

**Tech stack:** Node 24.22.0, TypeScript, React 19, TanStack Start/Query, Vite, Vitest, Supabase PostgreSQL 17, Three.js/R3F/Rapier.

**Spec:** The user's 2026-10-19 request to inspect the game deeply, fix all lint/TypeScript errors, optimize Supabase/indexes/cache/3D/players, use subagents, and provide an evidence-backed before/after table. Repository baseline: `5abde06de8eed679307bb318c96eb29f40dad93d`.

## Global constraints

- Do not rewrite published git history. Work on `codex/jogomanager-performance-20261019` in the task's separate checkout.
- Preserve deterministic saves, server-attested progress, and the sequential simulation Web Worker.
- Reuse the existing R3F, Rapier, post-processing, BVH, GPU detection, and motion stack.
- Validate athlete rendering in the isolated career portrait before match squads.
- Cache only explicitly public projections; never cache private saves, tokens, purchases, authenticated responses, or failed loads.
- Do not purchase compute or create paid database branches. Recommend a size from measured load and current official prices.
- Record earlier migrations separately from changes in this session. Historical slow-query averages must not be presented as current load.
- Keep screenshots, videos, logs, and diagnostic scripts outside the source tree. No synthetic images as evidence.
- A browser running through software WebGL is diagnostic evidence, not native-device FPS evidence. Android emulation is not a physical Android test.

## Review focus

- Concurrent cache misses must share work; errors and late evicted results must not poison the cache.
- A server-imposed page cap smaller than the requested page size must not silently truncate catalogs or squads.
- Service-worker navigation and MIME mismatches must not persist private HTML or an access page as a JS asset.
- Appearance updates must reach the portrait and player buffers without breaking identity or allocating repeatedly per frame.
- Preserve SQL's explicit nullable import-completion arguments; do not substitute zero/empty strings or unchecked casts to silence TypeScript.

## Task 1: Baseline and generated database contract (root)

**Files:** `src/integrations/supabase/types.ts`, the narrow `database.ts` RPC contract, `client.server.ts`; `eslint.config.js` only for accurate framework-specific routing.

- [x] Record HEAD, tools, lint JSON, TypeScript log, and production dependency advisory output.
- [x] Reproduce 77 TypeScript errors; lint baseline is 0 errors and 178 warnings.
- [x] Generate database types using the connected production schema, including the new bounded digest RPC.
- [x] Model nullable completion arguments in a narrow type override: SQL uses NULL offset for completion and NULL error for success.
- [x] Re-run `tsc --noEmit`, ESLint and relevant tests. Do not disable lint/type checks to make them pass.

## Task 2: Public read caching and pagination (backend agent)

**Files:** `src/lib/public-read-cache.server.ts`, its test, `football.functions.ts`, `real-football.functions.ts`, `realSquads.ts`, `db-catalog.ts`, `officialAssets.ts`, and focused behavioral tests.

**Interface:** `createPublicReadCache<T>({ttlMs,maxEntries,now?}).get(key, loader)` shares the in-flight promise, starts TTL on successful completion, limits entries with LRU eviction, and removes rejected results.

- [x] Prove concurrent misses, TTL expiry, LRU, failed-load retry, synchronous throws, and pending-entry eviction in executable tests.
- [x] Cache only public projections: league/digest/club 300 s, public assets 1 h, squads 600 s, and player market 30 s; bound each cache.
- [x] Validate and bound market inputs, escape literal ILIKE wildcards, and reject reversed numeric ranges before querying.
- [x] Page catalogs/assets/squads with stable ordering until actual completion; detect errors and avoid caching partial results.
- [x] Respect fresh client caches and deduplicate in-flight loads including empty squads.
- [x] Compare query counts with controlled fixtures and label them as controlled tests rather than production traffic measurements.

## Task 3: Database diagnosis and compute recommendation (database agent + root integration)

**Files:** SQL migration only if a measured opportunity requires it; evidence under the external `supabase-audit` directory.

- [x] Capture lightweight read-only project, index, planner, cache, connection, and query-stat snapshots and aggregate logs.
- [x] Distinguish the pre-session queue lookup migration from current changes using passive statistic deltas.
- [x] Check existing indexes before adding any. Never drop an index solely because short-window usage is zero.
- [x] Evaluate a bounded read RPC to collapse league-digest roundtrips, preserving exact results and restricting execution to the existing server role.
- [x] For any new SQL, inspect the actual plan, compare results, create a migration with the CLI, and verify after application.
- [x] Recommend compute with current pricing, explicit measurement gaps, and upgrade criteria. Do not change billing.

## Task 4: Offline cache correctness (root)

**Files:** `public/sw.js`, `src/lib/service-worker-cache.test.ts`.

- [x] Reproduce private-navigation caching and HTML-as-JS poisoning using the real worker script in a controlled service-worker event harness.
- [x] Read the existing related PR before integrating overlapping behavior.
- [x] Respect `private`/`no-store`, status, origin, redirects and MIME; cache the offline shell only from its actual public path.
- [x] Preserve offline assets and public sports images, keep cache writes alive, and bump the cache version to remove contaminated old entries.
- [x] Verify positive caching/offline paths and negative private/error/redirect/MIME paths.

## Task 5: Athlete and match rendering (graphics agent)

**Files:** `src/components/game/players/**`, related render helpers and tests, with exact ownership communicated before edits.

- [x] Capture the unmodified portrait and seeded squad, measurements and environmental limitations.
- [x] Reproduce stale appearance dependencies and profile object/draw-call/frame work.
- [x] Implement only improvements supported by the observed rendering/code evidence; preserve body proportions, deterministic identity, and LOD budgets.
- [x] Validate portrait first, then squad; compare fixed seeds, camera, viewport and quality.
- [x] Save actual screenshots/videos when available, inspect them, and report all unmeasured/device-specific limits.

## Additional correctness findings resolved during review

- [x] Reproduce career read/write races using the real Supabase HTTP request builder and controlled transport.
- [x] Replace unguarded upserts with bounded compare-and-swap updates and insert-race retries; preserve newer career progress.
- [x] Require the captured owner ID for authenticated saves/deletion so a delayed token lookup cannot apply an old account's intention to the next account.
- [x] Queue each upload before sending and acknowledge only its exact IndexedDB revision in one transaction.
- [x] Cancel stale career reconciliation before an optimistic update, and avoid re-enqueuing an older failed upload.
- [x] Bound service-worker resources by decoded bytes, including compressed responses with a misleading Content-Length.
- [x] Seed the public offline homepage anonymously during worker installation so the first controlled session can work offline.
- [x] Promote the existing instanced high-quality stadium tiers after tracing an intermittent legacy StaticBatch rebuild to 748 visible meshes; preserve cinema and explicit benchmark overrides.
- [x] Compare an isolated build of the unchanged base commit to prove the editor's oversized static dependency tree was preexisting.
- [x] Keep the public ReactDOM API in an independent chunk so Radix components do not depend on the application's hydration entry; preserve the 500 KB editor budget and verify all four editor tabs in the compiled application.

- [x] Defer the Supabase SDK until authentication middleware or OAuth consent actually needs it, while preserving fresh session lookup, authorization checks, errors and redirects.
- [x] Extract pure effective-player and match-attribute projections so the simulation worker does not import the full club catalogue or deferred career economy; preserve the existing public exports and exact seeded results.
- [x] Emit the existing Rapier WASM as an external binary in both worker and browser client builds, preserving the server build and testing the compiled API plus 180 physics steps.
- [x] Cache public immutable WASM with explicit MIME validation and the same decoded-size ceiling as other service-worker assets.
- [x] Exercise the final local Cloudflare Worker build: home, all four editor tabs and a running quick-match worker with the Rapier/WASM execution contract.

**Bundle measurement note:** The final clean build reduced emitted JavaScript from 11,258,169 to 7,128,399 bytes. The editor's static closure decreased from 1,227,783 to 450,861 bytes, and its startup total including the shared application shell decreased to 1,008,458 bytes. The simulation worker decreased from 469,693 to 86,726 bytes; quick-match selection startup decreased from 1,230,351 to 1,011,410 bytes. Ten of the eleven unchanged budget conditions pass. Rapier bindings decreased from 222,338 to 210,463 bytes but remain above the original 180,000-byte ceiling; the exact additional bundle gate therefore still fails. Raw emitted byte counts are not compressed transfer sizes or frame-rate measurements.

**Determinism measurement note:** Fourteen complete player/readiness projections and twenty-one checkpoints across three seeds match the unchanged base byte for byte after excluding only the non-seeded `sentAt` transport timestamp. These checkpoints use the synchronous `compat/compat` backend at ticks 0 through 1,800, step 1/30 and time scale 6; they are not a complete match or a Rapier equivalence test. The compiled Rapier API/physics tests and the final browser worker smoke provide separate coverage of the production execution backend.

**Graphics measurement note:** The software-WebGL capture showed fewer actual renderer calls and fewer stadium objects, but worse FPS and p95 frame times. No native-GPU or Android performance gain is established. The before/after videos visually verify idle and run only; their 25 FPS encoding is not the game's frame rate.

The after graphics were captured after the visual fixes and before the final import/WASM loading changes. Those later changes received deterministic and compiled-application verification, not a second FPS measurement. The final local smoke had zero page/worker errors, with external font/catalogue certificate failures and the public catalogue fallback recorded explicitly.

**Deployment note:** Existing open clients must reload to send the required save/delete owner field. The new digest SQL migration is additive and has already been applied to the connected database; application and worker changes remain on the isolated branch until the PR is deployed.

## Task 6: Integration and delivery (root + independent review)

- [x] Run the full repository test command, lint, TypeScript, production build, and relevant render checks on the final combined changes: 248 files / 1,352 tests pass; TypeScript and lint have zero errors; 169 existing Fast Refresh warnings remain. The unchanged additional Rapier bundle ceiling still fails as detailed above.
- [x] Review all changes independently across agent ownership boundaries and resolve material findings.

Publication and delivery follow this source freeze. The draft PR body and the accompanying `evidence/final-validation.json` record the resulting commit, PR URL, final report, actual media and remaining risks. This work does not merge or deploy the application.

## Execution decisions

- The user explicitly requested implementation and subagents, so discovery and independent analysis run in parallel without an additional plan-approval pause.
- The repository is a fresh task-specific checkout. A new local branch provides isolation without moving the user's existing branches.
- The production database already contains the queue optimization from before this session; its improvement will be credited as preexisting, not as a result of this patch.
