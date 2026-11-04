# Production readiness continuation

Continue PR #96 (`9e14ca61459249d86f4c56fa50f98708e81f4f0a`) without rewriting published history or changing other projects/accounts.

- Update remaining compatible dependencies from registry metadata; preserve the 24-hour release-age policy and synchronized npm/Bun lockfiles.
- Remove the vulnerable legacy transactional-email chain while preserving HTML, Portuguese metadata and usable plain-text action links.
- Integrate authenticated auxiliary simulation readiness into server health only when configured. Use HTTPS, bounded timeouts, fail closed for invalid configuration/results, and expose no credentials, URLs, MongoDB details or user data. A busy simulation slot is not a database failure.
- Correct existing CI formatting failures and investigate stale dependency/API assumptions in comparative startup diagnostics; retain baseline provenance and identical measurement dependencies.
- Run lint with zero warnings, TypeScript, unit/contract/service tests, 200 deterministic matches and independent replays, production build, bundle budgets/comparison, pinned-runtime CPU comparison, Lighthouse, and available database/WASM checks.
- Release only after all mandatory checks pass on the exact candidate, and confirm public health with the exact build SHA. Record unavailable infrastructure and failed checks honestly. Do not buy services, change account access or manufacture test credentials.
