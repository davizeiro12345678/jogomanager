# Isolated staging, authenticated synthetic ZAP, and Trivy remediation — 2026-11-21

## What is live and what is not
- Production `https://jogomanager.com/`: **unchanged**, HTTP 200.
- Public DNS `staging.jogomanager.com`: **created in Cloudflare** as proxied AAAA `100::`; it resolves and returns HTTP 200.
- Cloudflare Worker `jogomanager-security-staging`: **deployed with ZERO environment bindings**. It is a **synthetic, self-contained security test harness**, NOT the real game. The Worker fails closed if unexpected bindings are introduced; no network access to Supabase, Stripe or production.
- Cloudflare Access exception: created specifically for the synthetic staging hostname, not for production. **Before deploying real-game staging, replace this public bypass with a least-privilege tester/service-token policy.** Never attach the current production Worker `jogomanager-web` or its Supabase/Stripe secrets to the staging hostname.
- Only accessible managed Supabase project in the current account is **JogoManager - Produção**, ref `lguqnwvsfeefxamzeyos`. Thus **there is currently NO independent Supabase Auth/Storage/Realtime managed staging project**. The separate VPS Docker Postgres `jm-supabase-stage-pg` is PostgreSQL-only, not a complete Supabase stack.
- The staging harness has synthetic GET pages `/`, `/auth`, `/dashboard`, `/saves`, `/checkout`, `/multiplayer` and fake write APIs `/api/auth/login`, `/api/checkout`, `/api/saves`, `/api/multiplayer/match`. Authentication uses a fixed non-secret dummy session. Checkout never calls Stripe; saves and matches are never persisted.
- Worker source: `scripts/security/staging-synthetic-worker.mjs`. Four Node unit tests in `staging-synthetic-worker.test.mjs` **passed**; no prod access, fake login, dummy writes and public forms.

## OWASP ZAP Full Active on synthetic staging — completed
- Gateway job: `job_01M80505ZM00AP1J6X327KK59J`, finished code 0.
- ZAP official `zap-full-scan.py`, public isolated staging URL; spider + active scanning with synthetic session cookie via scoped Replacer hook `scripts/security/zap-full-synthetic-auth-hook.py`; 1 thread, 800ms delay, 5-minute active budget.
- CLI result **138 PASS, 5 WARN families, 0 FAIL** using `-I`; 43 individual alert instances / 12 detailed subtypes in report.
- CLI WARN: style-src unsafe-inline (8); Permissions-Policy header absent (5); Unix timestamp disclosure (7); missing anti-CSRF tokens (4); COEP header absent (10). These are observations about the **dummy harness only**, not proof of issues in the production game's implementation.
- Private reports on VPS: `/opt/jm-security/zap/20261121-staging-auth/synthetic-auth.{html,json,md}`.
- Separate checks confirmed real HTTP 200 health, synthetic HTTP 303 login, HTTP 200 authenticated dashboard, fake checkout response `stripe_called:false`, fake save `production_touched:false`, fake multiplayer `persisted:false`.
- **DO NOT CLAIM THE REAL GAME WAS AUTHENTICATED AND FULLY SCANNED.** Real Stripe sandbox integration, separate Supabase Auth project, actual multiplayer Worker with isolated state, and deployment of game Worker with only staging bindings are still missing.

## Fail-closed workflow for future REAL authenticated game staging
- Added `scripts/security/verify_zap_full_real_staging.py` and `test_verify_zap_full_real_staging.py`, **5/5 tests pass**.
- Updated `.github/workflows/security-zap-active-staging.yml` to refuse the current synthetic harness. The real app must attest `X-PFM-Full-Game-Stage: yes`, `X-PFM-Synthetic: false`, `X-PFM-Isolated-Stage: yes` with JSON `app_deployed:true`, `mock:false`, `production_access:false`, `app:jogomanager-web-staging`, `supabase:staging-isolated`, an independent project ref (never production's `lguqnwvsfeefxamzeyos`), `stripe:test`, and `multiplayer:isolated`.
- Live guard **correctly rejected** the deployed synthetic staging host with exit 2. This is intentional until a genuinely isolated game is deployed. Server-provided attestations supplement, not replace, operator verification of Cloudflare bindings, Supabase project, Stripe test keys and webhook endpoints.

## Fifth scanner: Semgrep Community Edition 1.186.0
- Source tree scan main: 1,851 files, 231 rules, 1 MEDIUM finding (Bun minimum release age below suggested seven-day threshold), 4 partial parsing errors.
- PR branch scan: 1,865 files, 235 rules, one similar MEDIUM warning, 4 parse errors.
- The repository already has `bunfig.toml` `minimumReleaseAge=86400` (one day); the Semgrep rule recommends `604800` (seven days). Do not raise the minimum blindly without verifying lockfile/build impacts.
- Tool installed on VPS in pinned Docker image `semgrep/semgrep:1.186.0`; root-owned command `/usr/local/sbin/jm-semgrep-safe`, source script `scripts/security/semgrep-community-scan.sh`. Original JSON reports remain private.

## Trivy: Hono dependency risk — mitigated in PR, not production
- Main branch scan: 10 lockfile vulnerability *occurrences* (5 Hono advisories, duplicated in Bun and npm lockfiles), 8 MEDIUM + 2 LOW, from `hono@4.13.13`.
- PR #144 now pins `hono@4.13.16` consistently in `package.json`, `bun.lock`, `package-lock.json`, with published registry integrity. Re-scan of both lockfiles on PR branch: **0 known vulnerabilities** in the scanned dependency targets.
- CI Lighthouse/mobile tests, authentication, performance and application deployment remain mandatory before merging. **Production still runs its existing release**.

## Trivy: PostgreSQL 18.7 image analysis and offline patched candidate
- Existing running VPS staging DB `jm-supabase-stage-pg` is on internal-only Docker network `jm-supabase-stage-internal`, no published database port, PostgreSQL **18.7** Debian Trixie locale `en_US.utf8`. The isolated database is `jmstage` (two user tables `jm_staging.synthetic_bots`, `jm_staging.synthetic_matches`, six schema objects).
- Trivy 0.76.2 counts on each offline image (not CVEs unique):
  - Current running `postgres:18` Trixie: **552** vulnerability occurrences (2 CRITICAL, 151 HIGH, 206 MEDIUM, 176 LOW, 17 UNKNOWN), and one `ssl-cert-snakeoil.key` likely test key; investigate usage.
  - Official `postgres:18.7-bookworm`: 602 occurrences, 4 CRITICAL — **rejected** for worse scanner profile.
  - Official `postgres:18.7-alpine3.23`: 61 occurrences, mostly attributed to Go 1.24.6 in the `gosu` binary; zero direct PostgreSQL critical examples established.
  - Rebuilt `gosu 1.20` from pinned upstream commit `29b939aa5bd4dc588af765b8248f6e39150d2565`, Go `1.27.4`, `golang.org/x/sys 0.44.0`, over the immutable PostgreSQL 18.7 Alpine base: **0 vuln, 0 secret, 0 misconfiguration findings detected** in candidate image.
- Reproducible multi-stage build: `scripts/security/postgres-stage-hardened.Dockerfile`, pins official Go and PostgreSQL base digests and upstream gosu commit. Candidate local tag `jm-security/postgres:18.7-alpine-gosu-go1274-xsys044`; no production or staging container was replaced.
- The rebuilt candidate passed `postgres --version`, `gosu --version`, privilege drop to `nobody` with minimal required `SETUID/SETGID` capabilities and a **separate offline logical restore test**: backup of `jmstage` restored into a disposable network-isolated PostgreSQL 18.7 Alpine container; schema object counts **6 vs 6**, database ~7910KB, successful restore with `pg_restore --exit-on-error`; temporary restore container removed.
- IMPORTANT migration blocker: original PostgreSQL cluster's `datcollate/datctype=en_US.utf8` while Alpine may not reproduce glibc sort rules. No replacement before text/collation compatibility tests, extensions, backup, smoke tests and prepared rollback.
- Preserved backup root-only: `/opt/jm-security/trivy/restore-proof/stage-jmstage-20261121.dump`. Never commit it to GitHub. Only synthetic staging data.
- Image vulnerability report root-restricted: `/opt/jm-security/trivy/reports/postgres18-alpine-gosu-xsys044-20261121.json`. Keep private.
- Tracking: https://github.com/davizeiro12345678/jogomanager/issues/145.

## Pending gates for a REAL full-game scan and rollout
1. Create an independently billed/authorized Supabase staging Auth/Storage/Realtime project with test users and isolated RLS, or self-host a complete isolated stack (not just Postgres).
2. Deploy the actual game bundle to a different staging Worker with only test bindings; keep cloud Access restricted to authorized testers, rather than the current public dummy worker policy.
3. Configure Stripe sandbox keys, test-price IDs, signed test-only webhooks, synthetic fulfillment records and multiplayer Durable Objects isolated from production.
4. Validate end-to-end login/OAuth/MFA, save writes, checkout test card, idempotent webhook, 1x1/2x2 multiplayer; compare UI/UX and code with production without copying production accounts.
5. Only then re-enable real-game ZAP Full Active through the fail-closed GitHub workflow. Review security reports, investigate findings and run CodeSpeed/Lighthouse gates before PR merge.
6. Stage PostgreSQL migration separately with source/target locale tests and rollback; never treat scanner counts as a guarantee of safety.

No passwords, API tokens, real payloads, sensitive report bodies or database dumps are included in this source-controlled document.
