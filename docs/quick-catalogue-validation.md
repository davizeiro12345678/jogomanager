# Quick-match catalogue loading

The quick-match page previously initialized the full football catalogue while
hydrating the first selection screen. Its loader now sends the league index and
the visible league from the same canonical catalogue. The complete catalogue is
loaded on league-selector intent, randomization, or entry into the actual match.
No separate copy of the football data is maintained.

Selection requests have a generation and an unmount guard. A pending league
keeps the previous teams visible and disables Play until both teams can be
replaced together. Returning to the current league cancels the pending request.
A failed import preserves the current teams and provides retry and page reload.
Cached catalogue selection works without a network connection; a first visit
still requires the normal application assets.

The build also groups shared React/routing primitives into one transport. Module
attribution confirmed that all 59 grouped modules were already in every browser
startup closure. The group adds no optional routes, gameplay or client renderer.

## Local validation, 2026-11-01

- Production build, TypeScript, changed-file lint and eight focused assertions
  passed. Both absolute and comparative bundle gates passed with unchanged
  budgets and identical installed dependencies.
- The real built application passed ten paired-browser cases: six viewport
  captures at 390/768/1280 pixels, then concurrent selection, cached offline
  selection, failure/retry/reload and unmount during loading. Initial candidate
  hydration requested no full catalogue module.
- The portable candidate-only verifier passed all seven cases with zero
  unexpected page/resource errors. Injected catalogue failures and background
  RPC failures during the intentional offline case remain in `expectedFailures`.
  Chrome closed, and both preview/inspector ports were available after terminating
  the exact process tree created by the verifier.
- An independent read-only review found no functional defect in the examined
  SSR, selection, unmount and offline paths. Linux CI must still validate the
  final pushed revision.

The following bundle comparison uses base
`e4d10b398e88e5af725bd33aec6e471c85f58a9a`. These are compressed JavaScript
estimates, not measured loading time, browser FPS or a graphics CPU benchmark.

| Metric | Base | Candidate |
| --- | ---: | ---: |
| Quick-match startup gzip | 300,058 B | 168,746 B |
| Quick-match startup Brotli Q6 | 284,237 B | 159,980 B |
| Total emitted gzip, including lazy chunks | 2,237,388 B | 2,235,063 B |
| Total emitted Brotli Q6, including lazy chunks | 2,108,575 B | 2,106,816 B |

Every protected startup path was no larger in gzip or Brotli; the simulation
Worker's startup was unchanged. Quick-match startup gzip decreased 43.76%.

## Local Lighthouse comparison and its limitation

Three alternating pairs used fresh Chrome 156 processes, mobile simulation,
390×844 at DPR 2.75 and the same local server configuration. Other builds and
browser captures were paused. There were no collection warnings or source drift.
The baseline here is the immediately preceding PR commit
`f30509166857c68396fd11630d92df0696f7fdb7`, rather than the bundle base above.

| Metric | Baseline, three samples | Candidate, three samples |
| --- | --- | --- |
| Performance score | 0.93 / 0.99 / 0.99 | 0.98 / 0.98 / 0.98 |
| Total blocking time | 299.58 / 27.50 / 24.50 ms | 0 / 0 / 0 ms |
| Largest contentful paint | 1976.92 / 2126.32 / 2122.70 ms | 2277.35 / 2272.78 / 2272.61 ms |
| Cumulative layout shift | 0 / 0 / 0 | 0 / 0 / 0 |

The median LCP regressed by about 150 ms locally. Therefore this change is not
claimed as a universal first-paint improvement. It removes catalogue startup
work and improves the worst blocking sample, while preserving the raw regression.
The remote mobile Lighthouse gate remains mandatory; these Windows diagnostics
do not replace it or prove the game's cutscene/FPS targets.

Baseline emitted-assets SHA256:
`b7a8688f8f10c9c61ff87bf6ae72dd5f6ad7b5fd31b283917977fd28507b4ace`.
Candidate emitted-assets SHA256:
`48a0b18c94b40cce9ff2ee800d17fdf818014bd8b63473a4572897df9ad39eb1`.

## Reproduce functional checks

After `npm ci` and `npm run build`:

```sh
npm install --prefix .cache/quick-browser --no-save --ignore-scripts playwright@1.63.0
node .cache/quick-browser/node_modules/playwright/cli.js install --with-deps chromium
node scripts/verify-quick-catalogue.mjs
```

The required build/types/tests job runs this check and uploads its receipt and
screenshots. `PFM_QUICK_BASELINE` optionally names an existing baseline build for
the three additional paired viewport cases. `PFM_PLAYWRIGHT_MODULE` may name an
already installed Playwright module, and `PFM_BROWSER_CHANNEL` may select an
installed browser. The verifier fails on occupied preview ports and only stops
processes it started.
