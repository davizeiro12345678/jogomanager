# JogoManager Production Readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the dependency and integration continuation with reproducible release evidence.

**Execution status (2026-10-29):** Implementation and available validation are recorded in [PR #98](https://github.com/davizeiro12345678/jogomanager/pull/98). Production remains blocked by the mobile Lighthouse budgets and mandatory final-commit CI. Incoming private-notification changes were preserved, with real PostgreSQL tests for permissions, owned leases and deduplication after content deletion.

**Architecture:** Preserve the existing server authority and client lazy-loading boundaries. Extend server health through a bounded HMAC readiness adapter; migrate email rendering independently of browser code.

**Tech Stack:** React 19, TanStack Start, Vite, Supabase, Cloudflare Workers, Node 24, MongoDB auxiliary service, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-production-readiness.md`

## Global Constraints

- Preserve the 24-hour release-age policy and npm/Bun lockfile consistency.
- No relaxed performance budgets or skipped mandatory checks.
- No history rewriting, account/access changes, purchases, or other-project access.
- Production requires passing Quality gates and exact compiled release SHA.

## Review Focus

- Email action URLs survive HTML-to-text conversion and unusual characters remain intact.
- Optional auxiliary configuration never blocks an unconfigured installation.
- Invalid credentials, redirect responses, malformed payloads and upstream failures cannot produce a false ready result or disclose secrets.
- Comparison baselines must start successfully with the documented dependency graph; compatibility edits must be explicit.
- A local green suite does not attest live database, payment, multiplayer or deployment state.

### Task 1: Dependencies and existing CI blockers

**Files:** `package.json`, `package-lock.json`, `bun.lock`, `src/lib/email-templates/*`, `scripts/edge-production-parity.test.mjs`, `supabase/functions/_shared/read-webhook-body.mjs`.

**Interfaces:** Retain `sendTemplateEmail()` and registered email templates; consume audited release metadata.

- [x] Reproduce existing lint failures and baseline email assertions.
- [x] Extend template coverage for HTML, plain-text action URLs and escaped characters; run tests.
- [x] Apply eligible, compatible dependency updates and email migration; synchronize lockfiles.
- [x] Run email tests, lint, TypeScript and full dependency audit. Commit the verified task.

### Task 2: Authenticated auxiliary readiness integration

**Files:** `src/lib/match-aux-readiness.server.ts`, its test, `src/lib/backend-health.server.ts`, its test, `docs/architecture/match-aux-static-egress-rollout.md`.

**Interfaces:** `checkMatchAuxReadiness(env, fetcher): Promise<boolean>`; existing `checkBackendHealth(env, fetcher)` includes the optional check only when configured.

- [x] Add failing cases for HMAC, optional configuration, invalid URL/key, redirects, provider errors and malformed replies.
- [x] Implement a bounded HTTPS-only readiness request with generic boolean output; busy remains ready.
- [x] Integrate the result into server readiness without altering unconfigured output. Run targeted tests, lint and types; commit.

### Task 3: Validation and release evidence

**Files:** comparative startup workflow/helper if root-cause evidence requires correction; validation artifacts outside tracked application code.

**Interfaces:** Existing mandatory CI commands and exact expected release SHA.

- [x] Diagnose and fix comparative-startup API incompatibility with a regression check and explicit baseline provenance.
- [x] Run full unit/contracts, service tests, stress report verification, build, bundle and pinned-runtime CPU comparisons.
- [x] Run available Lighthouse/browser, database and WASM checks; distinguish unavailable environments from passes.
- [ ] Review the whole branch, publish the reviewable continuation and inspect exact-commit CI. Deploy only if all mandatory checks pass; otherwise report the concrete remaining blockers.
