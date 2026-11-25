# Nikto 2.6.1 — isolated staging scanner, not a production scan

Added an independently maintained, free web-server DAST engine alongside the existing ZAP, Wapiti, Nuclei, Trivy and source/host analyzers. Nikto probes known risky server files, outdated components and misconfiguration classes; its coverage is not a guarantee of vulnerability absence.

## Actual operational state (2026-11-22)
- The GitHub Actions workflow `.github/workflows/security-nikto-active-staging.yml` is **manual** and uses the `security-staging` environment.
- Nikto is pinned to official upstream version 2.6.1, Linux/amd64 image manifest `sha256:2ea1d2107af52638445807059f8ae2877b9fb8aed7792771dd1dc1d31c5016dd` (digest checked against GHCR on 2026-11-22).
- The workflow refuses any target except `https://staging.jogomanager.com/`, and independently executes the project's `verify_zap_full_real_staging.py` gate **before** Nikto.
- As checked on 2026-11-22, `/__security/health` on that hostname returns `x-pfm-synthetic: true` and `mock: true`; its Supabase, Stripe and multiplayer are not connected. **This is not a real-game staging environment, so the active scan must be refused.**
- Resource bounds: Docker 1 CPU, 1 GiB, 120 PIDs, no Linux capabilities, nonprivileged process constraints, Nikto `-maxtime 10m`, outer 14-minute timeout, artifact retention 14 days.
- Scan output is written only inside a staging evidence artifact. No production secrets, logins or payments should be provided.

## Acceptance before running
1. Deploy a real full-game staging application with synthetic accounts, independent Supabase database, isolated authority and Stripe test mode; never reuse production service-role keys.
2. Make the existing `/__security/health` readiness attestation truthful, including `x-pfm-full-game-stage: yes` and `x-pfm-synthetic: false`, backed by live assertions rather than a constant mock.
3. Use the existing ZAP/real-staging contract tests and the Nikto scope/unit guards. Only then invoke the manual workflow and inspect the JSON report and GitHub Actions exit status.
4. Independently triage each reported finding. Do not turn off WAF/CSP to make scanner output look clean.

Nikto official documentation: https://github.com/sullo/nikto/wiki/Docker ; https://github.com/sullo/nikto/wiki/
