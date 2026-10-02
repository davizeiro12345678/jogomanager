# Match rendering, accessibility and data integration — 2026-10-02

This delivery reconciles the local game update with `main` at
`8f40569fea9603d59e6b80d9d79ad243f727e862`. The source snapshot was captured at
2026-10-02 21:15:03 UTC and validated in an isolated checkout. Subsequent edits
in the original project remain outside this snapshot.

The update integrates player anatomy, skin deformation, materials, stadium
rendering and cinematic sets with the existing match presentation. It also
updates simulation rules and worker timing, season and competition contracts,
club and player identity handling, and bounded SportsDB import infrastructure.
The home and career flows include expanded navigation translations, reading
preferences and narration settings.

## Local verification

| Check | Result |
| --- | --- |
| Normal test suite | 89 test files; 563 tests passed |
| TypeScript | `tsc --noEmit --pretty false` passed |
| Production build | `PFM_GRAPHICS_VERIFY=1 npm run build` passed |
| Graphics build | `npm run graphics:build` passed |
| ESLint on delivery code | 165 files; zero errors and 12 warnings |
| Global ESLint excluding local generated output | 651 errors and 37 warnings; all errors are in 82 files outside the delivery |
| SportsDB bridge contracts | Nine Node tests passed |
| Simulation stress suite | One test covering 200 seeded complete matches passed during preparation |
| Diff and publication audit | No whitespace errors, private environment files or generated build output included |

The stress suite and SportsDB bridge tests ran before the final snapshot refresh.
The normal test suite, TypeScript, both builds and lint were repeated on the final
snapshot. This delivery does not establish browser, physical-device, production
deployment, live database migration or remote CI results.

## Bundle budget pending

The final emitted production bundle was measured with `scripts/bundle-report.mjs`.
The complete static dependency closure is counted, including the application
startup dependencies.

| Surface | Measured bytes | Limit | Result |
| --- | ---: | ---: | --- |
| Root chunk | 400,924 | 430,000 | Passed |
| Home including startup | 829,559 | 900,000 | Passed |
| Simulation worker startup | 64,376 | 90,000 | Passed |
| Quick match selection including startup | 1,228,884 | 1,150,000 | Failed |

Quick match selection includes the club catalogue in its static dependency
closure. The budget check exits with `Quick match selection bundle budget
failed`. The pull request should remain a draft until this excess and the
repository's existing global lint failures are addressed.
