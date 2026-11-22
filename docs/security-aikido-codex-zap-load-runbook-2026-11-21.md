# Aikido / Codex MCP / ZAP / 4000 RPS — integration runbook

Date: 2026-11-21 UTC. No Aikido credential is committed or repeated here.

## Evidence of installation on authorized VPS
- Gateway `jm-fra-01` Linux; Codex CLI and Node 24 were run inside a Docker container with non-root UID 1000, read-only container filesystem, no Linux capabilities, no privileged mode, and CPU/memory/pid limits.
- Executed the requested `codex mcp add aikido -- npx -y @aikidosec/mcp@latest` from isolated Node Docker with /home/jmadmin/.codex persisted.
- Verified `/home/jmadmin/.codex/config.toml` owner jmadmin, permission 0600, and `mcp list` shows the `aikido` MCP server enabled, pointing to `npx -y @aikidosec/mcp@latest`.
- Installed root-owned wrapper `/usr/local/bin/jm-codex` to run Codex in the same isolated container without adding a root-level Node runtime to Ubuntu. Test `sudo jm-codex mcp list` is read-only.
- **Not authenticated**. Neither user-supplied token was copied to disk or shell arguments. Optional future root:root 0600 `/etc/jm-security/aikido-mcp.env` is accepted only if ownership/perms match. No such file was installed. Store a **freshly rotated** `AIKIDO_API_KEY` there only using a non-logging secure channel after threat modeling; avoid credentials in shell history, issue body or git.
- The IDE MCP token and the CI client API token have different purposes and should not be interchanged. Both supplied values were exposed in chat; rotate both before use.

## Five requested Aikido connections — evidence/status (do not fake green)
| # | Integration | State | Action and blocker |
|---|---|---|---|
| 1 | Aikido IDE MCP ↔ Codex on VPS | Launcher/config **installed**, authorization **pending** | Rotate exposed IDE token; use a protected new AIKIDO_API_KEY or interactive browser authorization. MCP advertises read-only issue listing (`aikido_issues_list`), which may allow retrieval without paid CSV export if enabled by plan/admin. |
| 2 | Aikido source scan ↔ GitHub repositories | Screenshot shows issues tied to repositories, but **coverage of all 11 repos unverified** | Review authorized GitHub app installation, map all accessible repos and exact branches. GitHub **issue tracking** is a distinct integration that requires a GitHub organization and may be paid, per screenshot. |
| 3 | Aikido CI/PR gating ↔ GitHub Actions | **Pending** | Rotate exposed AIK_CI token and save as GitHub Actions Secret `AIKIDO_CLIENT_API_KEY`; confirm plan entitlement. Do not pass the secret in a process command argument (upstream documentation example uses --apikey; secure mediation must be verified). Enable gating only after an end-to-end test. |
| 4 | Aikido Cloud scanning ↔ Supabase Organization | **Pending human OAuth/plan support** | In Aikido `Cloud → Connect Cloud → Supabase`, authorize only the intended Supabase organization in its native OAuth UI; review read-only permissions, never hand over production service-role key. Official: https://help.aikido.dev/cloud-scanning/connect-your-cloud/connect-supabase-organization |
| 5 | Aikido Local VM Scanner ↔ VPS Linux | **Pending license/agent enrollment** | The Aikido VM scanner is separate from Codex MCP; confirm Free/Student entitlement and agent enrollment wizard before installing root-level security software on a production VPS with existing Wazuh/Elastic/Tracee. Official: https://help.aikido.dev/virtual-machine-scanning/local-vm-scanning |

## ZAP bridge
- OWASP ZAP is **not proven to be a native Aikido cloud integration**. Keep its reports in auditable VPS locations and GitHub Actions artifacts; triage issues in GitHub tracking. Do not claim that uploading ZAP JSON into Aikido is supported without a documented import interface.
- Passive baseline and expanded baseline completed: each 60 PASS, 11 warning families, 0 scanner FAIL (the expanded had 77 instances).
- Active homepage-only test completed: 10 alert instances in 9 families, no high/critical findings **within the homepage-only anonymous scope**.
- Automated ZAP full active is allowed only on separately isolated staging, not the production origin.

## 4000 total RPS load test — prepared, not executed
- Code: `scripts/security/staging-load-policy.js`, `staging-load-policy.test.mjs`, `staging-load.k6.js`, `summarize-k6.py`, GitHub workflow `.github/workflows/security-staging-4k-rps.yml`.
- 5/5 Node unit tests pass and Grafana k6 v2.4.0 `inspect` validates scenario options **without generating traffic**.
- Workload: read-only public GET endpoints, `ramping-arrival-rate` 50→200→500→1000→2000→4000, then 30 second 4000 target hold. Aborts on 1%+ errors or WAF blocks, 0.5%+ 5xx, or p95≥2000ms, and fails if dropped iterations occur.
- Require protected `security-staging` GitHub environment, manual `confirm_isolation` input, repo variable `PFM_STAGING_ISOLATED=true`, and server HTTP header `X-PFM-Isolated-Stage: yes`. Even that header is not a substitute for proving independent Worker, staging database and external services.
- The staging PostgreSQL container `jm-supabase-stage-pg` exists, but `staging.jogomanager.com` did NOT resolve in DNS during the 2026-11-21 check, so **no full Active ZAP on staging and no 4000 RPS test were run**. Production homepage still returned HTTP 200.
- k6 scenario cannot validate the complete business system: authenticate, Stripe sandbox, save synchronizations, multiplayer reconnect and Worker authoritative engine need separate safe benchmarks with synthetic accounts and fixtures.
- 4000 **requested** RPS is not automatically 4000 **achieved** RPS. The Python summary counts observed per-second requests and reports peak 5s rolling average; no result is invented.

## Related critical Rust advisory
- AetherAV Cargo.lock includes wasmtime 29.0.1 transitively via YARA-X 0.13 with default YARA feature enabled. It is affected by CVE-2026-115889/GHSA-897f-g5gm-fmxm, rated critical. Independent exposure audit is documented in AetherAV draft PR #2: https://github.com/davizeiro12345678/AetherAV/pull/2. No unsafe lockfile-only upgrade and no silent disabling of AV detection took place.

## User-side account prerequisites
1. Revoke both exposed Aikido tokens, regenerate with least privilege, and avoid posting them in ChatGPT.
2. Connect GitHub source app for selected repos; issue-tracking integration requires a GitHub organization, not just a personal namespace.
3. Connect Supabase from the Aikido Cloud OAuth dialog if allowed by Free plan.
4. Inspect Aikido Local VM scanning eligibility before any agent install.
5. Confirm whether Aikido issues MCP listing is available under the current plan, since paid CSV export is blocked.

Documentation: https://www.npmjs.com/package/@aikidosec/mcp, https://help.aikido.dev/ai-and-dev-tools/aikido-mcp/using-aikido-mcp, https://www.zaproxy.org/docs/docker/full-scan/.
