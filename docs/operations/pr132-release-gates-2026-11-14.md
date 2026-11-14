# PR #132 | Release blockers and evidence contract (14 Nov 2026)

> **Scope:** `davizeiro12345678/jogomanager`, branch `integration/release-2026-11-11` into `main`. This file is a factual release checklist, **not** a deployment instruction or an approval. The PR remains Draft until every blocking gate is independently evidenced at the same final commit.
>
> Evidence snapshot: 14 Nov 2026 UTC. Refresh SHA, logs, account state, and measurements when executing any action. Previous runs do not authorize a later SHA.

## P0: Isolate and diagnose the public HTTP 403

- [x] Read Cloudflare configuration: the zone `jogomanager.com` is active; `jogomanager.com/*` routes to `jogomanager-web`. Existing custom WAF rules are scoped to malicious/legacy paths and selected login POSTs; this check did **not** identify a homepage-wide blocking expression.
- [x] Run anonymous HTTP observations against the public site. At ~20:05 UTC on 14 Nov, a remote client reached `https://jogomanager.com/` (HTTP 200), `/robots.txt` (HTTP 200), and `www` (302 followed by 200). This **does not** disprove an intermittent or context-specific 403.
- [x] Extend `scripts/verify-public-deployment.mjs` with sanitized `CF-Ray`/challenge diagnostics for a 403 and add negative tests for log redaction. Commits `decde3ee` and `aeb73b6` on this branch. **The code is not deployed until release gates and deployment succeed.**
- [ ] Reproduce the **exact** failing endpoint, method, timestamp (UTC), zone, client region, and Ray ID. Correlate against Cloudflare Security Events, Worker logs, upstream/origin logs, and the matching request/response.
- [ ] Distinguish: edge WAF/bot challenge, Cloudflare Access, route miss, Worker application `403`, origin `403`, or deliberately rejected WebSocket Origin. Do not weaken the WebSocket same-origin admission, turn off the WAF globally, or create blanket allow rules.
- [ ] Verify unauthenticated home, `robots.txt`, `/api/health`, canonical redirect and authenticated endpoints without leaking session/cache state. Preserve CSP and other security headers; compare HIT/MISS and p50/p95/p99.

## P0: Supabase staging separate from production

- [x] Confirmed production project is `lguqnwvsfeefxamzeyos` (us-west-2). No new, independent PR132 staging database is present in the connected account.
- [ ] Obtain the provider's **actual quoted hourly/monthly cost** for the organization, and specific acceptance for billable staging resources. The staging-branch creation attempt returned `confirm_cost_id required`; **no branch/project was created**.
- [ ] Create a distinct project or isolated branch with its own project reference, server-only secrets, users and fixture data. Never clone production PII or reuse production service-role credentials in the staging Worker.
- [ ] Apply schema dependencies and migration replay through `0082` as appropriate for the isolated environment, including `0079` tournament checkpoints and `0080` moderation. Verify migration journal, indexes, SQL contracts, RLS, functions, grants, and rollback. Test negative `anon`/`authenticated` access and positive minimal server-role behavior.
- [x] Limited read-only production ACL sampling on seven private multiplayer/performance/chat tables found RLS enabled, with no `anon` or `authenticated` SELECT/write grants. **Not a staging replay or whole-database permission approval.**
- [ ] Investigate Supabase advisor warnings for any *unintended* GraphQL exposure; 37 no-policy RLS advisories include intentional server-only tables and require table-specific review rather than blanket SELECT policies.

## P0: Authoritative Cloudflare Worker with isolated database

- [x] Cloudflare account contains a staging Durable Object binding `MATCH_ROOMS` and a disabled bootstrap script; `MATCH_AUTHORITY_ENABLED=false`, queue cron disabled, no public Worker route and no workers.dev exposure.
- [x] Repository `services/match-authority/worker.ts` contains the full authoritative game Worker; CI has compiled and smoke-tested its fail-closed state. **This is not proof of a remotely deployed, functioning multiplayer engine.**
- [ ] Configure independent staging Supabase ref and secrets, isolated ticket/receipt signing keys, Access-protected private route, and update the **full engine** as a disabled deployment. Verify the deployed version, Durable Object migrations, no queue cron, no public domain, and fail-closed HTTP 404 prior to controlled activation.
- [ ] Test real signed ticket, room/seat, READY, seq/ack, cross-room, nonce replay, invalid Origin, oversized messages, persistence, DO eviction, checkpoint restore, exact idempotent settlement and rollback on that private route.
- [ ] Only enable staging match authority after successful isolated database and credentials checks. No production activation, secrets copying, or unreviewed rollout.

## P0: Independent complete review and protection of main

- [x] An automated full-diff inventory workflow exists and runs across the PR. That is **not** an independent signed code review.
- [ ] Review all changed paths, including binary/oversized files, with specialist attention to authentication, payments, SQL/RLS, WebSockets/DO, CDN cache/CSP, imports, third-party dependencies and CI deployment; document findings by file/line and resolve them.
- [ ] Obtain at least one qualified independent GitHub review. Zero submitted PR reviews were observed on 14 Nov.
- [ ] Enable a `main` ruleset/branch protection with required PR and independent approvals, blocking force-push/deletion, and **verified actual critical status check names**. The GitHub connector's branch administration was previously HTTP 403; a browser test was signed out. **No protection was installed by this operation.**
- [ ] Verify protection via a readback of effective rules on `refs/heads/main`, including administrators where supported.

## P1: Physical and end-to-end game acceptance

- [ ] Two independent physical devices, authenticated users, separate networks: create/allocate room, connect via private WSS, test latency/jitter, reconnection with new tickets, command fencing, suspended clients, forfeit and persistence across DO restarts.
- [ ] Four physical players (co-op 2×2) with four *separate authenticated seats*, seat/role ownership, tickets, readiness and commands, correct outcome and admission behavior. **CURRENT ARCHITECTURE BLOCKER:** `MatchSeatSchema = z.enum(["home", "away"])` and `MatchRoomDO` signs only a home and away ticket. This protocol is a **two-seat match protocol**, not a proven four-seat 2×2 implementation. Design a versioned four-seat contract, server persistence, admission and tests *before* physical homologation. Keep legacy two-seat replays compatible.
- [ ] Prove anticheat server validation, rate limits, blocked replays, disconnect/recovery, false positive moderation checks, complaint/review/mute/appeal with human governance and audit trails. UI is not evidence of a fully operational moderator.
- [ ] Full tournament lifecycle, transactional rankings, spectator read-only access, anti-spoiler/privacy policy, refunds/retries where relevant, and role-level authorization/abuse scenarios.
- [ ] Physics/AI/Match 3D on real GPU/browser devices: frame p50/p95/p99, FPS 1%/0.1% lows, crashes, WebGL/WebGPU fallback, first frame, LCP/INP, contact/tackle teleport regressions and 1,000 deterministic seeds. Name device/GPU/driver/browser in the report; do not infer 60 FPS from headless CI.

## P1: Benchmarks and quality

- [x] CodSpeed executes on the PR; runs available at app.codspeed.io. Comparisons between consecutive 14 Nov runs used *different hardware and linked libraries*, e.g. Intel Xeon versus AMD EPYC. **Therefore observed changed percentages are not trustworthy code regressions or speedups.**
- [ ] Upgrade `@codspeed/tinybench-plugin` only with compatible dependency + lockfile, current toolchain and an actual passing CI; verify supported API changes. Re-run baseline and head on equivalent CPU/runner and toolchain, include walltime for system-call-heavy benchmarks, and save comparison URLs.
- [ ] Obtain every critical GitHub quality gate green on the **same final SHA**. Earlier `1dec01a` failed mobile Lighthouse because the homepage yielded 0.88/0.99/0.98 performance with one TBT 385ms (limit 200ms), and `/guia-de-scouting` scored 0.96 on one run (limit 0.97). Do not lower Lighthouse budgets to manufacture success.
- [ ] Inspect the raw 15 mobile audit reports, isolate outlier long tasks, resource preload, fonts/JS and CI variance, apply targeted fixes and rerun all three samples on five pages.
- [ ] Keep TypeScript, lint zero-warning, unit/integration tests, migrations, dependency audit, bundle impact, nine-axis visual QA and SEO checks green on the last SHA.
- [ ] Re-crawl published SEO canonical URLs, sitemap, broken links, headers and noindex; record current Semrush crawl before claiming third-party warnings resolved.

## P2: Release decisions, runbook and stop conditions

- [ ] Document tested build SHA, human reviewers, database migration inventory, staging/prod refs, deployed Worker version, two/four-device sessions, security/access results, graphics and CodSpeed before/after benchmarks.
- [ ] Prepare **read-only** baseline metrics and a deploy/revert plan. A canary requires private staging approval, progressive routing/flags, monitoring and defined rollback thresholds. Rolling code back does **not** roll Durable Object storage or Postgres schema back; checkpoints and migrations must remain forward/backward compatible.
- [ ] Final release requires an explicit go/no-go decision, verified `main` protection, exact-head green CI, independent approval, staging/physical tests and confirmed ability to revert.
- [ ] Keep PR #132 Draft, the Cloudflare staging Worker disabled, and production unmodified while critical gates are unsatisfied.

## Evidence index and operator commands

- PR: https://github.com/davizeiro12345678/jogomanager/pull/132
- Existing isolated Worker documentation: `docs/operations/match-authority-staging-2026-11-12.md`
- Existing versioned rollout: `docs/operations/multiplayer-physics-rollout-2026-11-11.md`
- Existing progress ledger: `docs/superpowers/plans/2026-11-11-jogomanager-release-integration.progress.md`
- Read-only HTTP probe (no credentials): `curl -i -sS --max-time 15 https://jogomanager.com/robots.txt`; capture safe `CF-Ray`, status and timestamp. Do not paste cookies, JWTs, auth headers or Cloudflare secret tokens in issues.
- On exact 403: check Cloudflare **Security > Events** filtered to the Ray ID/time; inspect Worker request logs and any VPS origin logs for the **same** request; do not guess an origin problem from `Server: cloudflare`.
- Endpoints for authorization tests must be private, isolated and within documented owned infrastructure, never adversarial probes against live strangers.
