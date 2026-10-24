# PR 62: load the deterministic solver only for match commands

The worker serves live matches, completed simulations and career operations. Previously, importing its entry evaluated the complete MatchSim solver even for career-only commands. MatchSim is now imported inside the existing sequential queue, immediately before startLive or simulate constructs a match. Constants come directly from sim-contracts. Physics initialization remains before the first canonical tick; failed imports use the existing command error response and queue recovery.

## Reproducible local validation

Reference: 5395c89713bb3a37e3305c2e5d5f9a041dee5661. Integrated parent: bcaef4494667b35da3d7a69c5567b2456f22cd32. Dependencies unchanged. Candidate output was built from an empty .output directory with PFM_LOCAL_VERIFY=1 npm run build. Measurements below are emitted asset sizes, not execution-time benchmarks.

| Worker static dependency closure | Before | After | Reduction |
| -------------------------------- | -----: | ----: | --------: |
| JavaScript bytes                 | 120179 | 35601 |    70.38% |
| gzip bytes                       |  39390 | 13731 |    65.14% |
| Brotli bytes, quality 6          |  37647 | 13268 |    64.76% |
| Absolute JS limit                |  90000 | 90000 | unchanged |

`npm run bundle:check` passed after the clean build. Four targeted Vitest files passed all 45 tests: sequential-worker-queue, simWorkerClient, simWorkerClient-transport and match-command-validation. TypeScript and ESLint checks passed. No solver logic, fixtures, seeds, benchmark workloads, CI assertions or budgets were changed by this patch.

This defers solver acquisition; it does not eliminate the bytes required to start a match. It does not establish a 149% improvement in CodSpeed, GPU FPS or mobile Core Web Vitals.

## Remaining release blockers

Quality run 40118803748 on 5395c89 had five failed jobs: constructor/checkpoint comparison, absolute bundle check, comparative startup bundles, mobile Lighthouse and the aggregate release gate. Its other jobs passed, including the real 200-match deterministic stress suite, database replay, types, tests, lint and Rust/WASM parity. New CI is required for this patch.

The checkpoint gate detects real semantic changes versus main 7a5b04b: at tick zero execution revision 2 becomes 3, tactical/analytics state is added, and goalkeeper dimensions differ. At tick 300 the shared bench-setup fixture has 159 differing leaves, including RNG state. Exact equivalence must not be claimed and the gate has not been relaxed.

Mobile run 40118803748 reported quick-match performance 0.72/0.73/0.74 and TBT 1642/1621/1469 ms, versus the unchanged 0.98 and 200 ms requirements. The worker split alone does not prove these failures resolved.

CodSpeed comparison 6adcf216fd02167c89337228..6adcf31ffe0ea3154c4e502f flags different host CPUs (EPYC 9V74 versus 9V45). Cross-run gains cannot certify the requested all-metric target. The integrated parent adds paired CodSpeed instrumentation to compare workloads on one runner. Production remains blocked until every required gate passes.
