# Web core and heading verification — 22 October 2026

This change keeps all existing release budgets. It is not a production release approval.

## Changes

- Reconstruct the pinned Rapier 0.21.0 module graph from the official npm source map and declaration barrels. Share the content-addressed WASM bindings between document and module workers; retain the exact binary and complete default API. Fail closed on an upstream package layout/version change or a failed WASM fetch.
- Count root-relative static and dynamic imports in bundle analysis, including shared bindings. Remote URLs remain excluded.
- Keep Portuguese and English interface dictionaries available offline while deferring optional locales. Reuse the same base dictionaries in the optional catalogue.
- Load the career navigation shell only for the match route's no-career state.
- Serve a smaller Tailwind stylesheet on the home, guides, scouting and formations pages. Other routes retain the complete stylesheet; custom design tokens and styles are shared.
- Give guide cards and FAQ questions semantic H3 headings. Group formations under one H2. Add a scouting decision checklist with meaningful H2/H3/H4/H5 nesting. Do not use headings to control appearance alone.

## Local evidence

Baseline: main 93c31441261e011f3db3198d77c44b8208a8596e, rebuilt using the same installed dependencies and runtime as the candidate. Cold browser capture baseline: previous PR #59 source equivalent to d56356a3. These are different comparisons and must stay labelled.

Both absolute bundle checks and the zero-regression gzip/Brotli comparison against main pass locally. Estimated initial gzip JS decreases by 6.62% on home, 6.00% on Match 3D, 40.69% on the editor and 3.08% on quick match. These are emitted code estimates, not observed Core Web Vitals or FPS. Public CSS transfer in the capture harness decreases from about 26.6 KB to 13.1 KB gzip.

The complete unit suite passed 255 files / 1,390 tests before the final dictionary reuse and match empty-state split; focused locale/physics tests, TypeScript and zero-warning lint were then rerun. The analyzer has an additional root-relative dependency regression test. Physics tests compare complete API keys and 540 deterministic state samples with the official package, and exercise a failed WASM fetch.

The screenshot harness audits 18 public routes on mobile and five on desktop (23 cases): HTTP 200, no page exceptions and no horizontal overflow. Captures use Chromium 138 in software headless mode. They do not certify a physical GPU, real-user INP, CrUX, production CDN compression or production Supabase data.

Controlled Lighthouse comparison uses three mobile runs on five routes per version, alternating AB/BA/AB, identical warmed route requests, fresh Chrome profiles, 390×844 DPR 2.75 and simulated mobile throttling. Local worker assets use gzip; HTML is uncompressed equally on both versions. The result must be assessed after all 30 runs complete. Existing CI thresholds remain 98 performance, LCP ≤ 2.5 seconds, CLS ≤ 0.1 and TBT ≤ 200 ms on every run. No score is assumed here.

## Service dependencies and release status

Twilio was authenticated and inspected: the selected account is trial with no balance and displays a paid upgrade requirement for creating/managing Verify services. No Verify service, Fraud Guard/Geo policy or real SMS/WhatsApp send was activated. Phone flags remain disabled. The account owner must complete the paid upgrade; credentials must remain server-side.

New OAuth/custom providers need their own registered applications, client credentials and redirect configuration. Existing provider credentials must not be reused across unrelated providers. No invented credentials or untested providers are enabled.

The previous CI run confirmed complete disposable Supabase migration replay, ownership/access contracts, the 200-match stress suite, MatchSim comparison, Rust/WASM and graphics checks. The new commit must pass all these checks again, including mobile Lighthouse, before merge or production. Production /api/health must attest the exact release SHA.
