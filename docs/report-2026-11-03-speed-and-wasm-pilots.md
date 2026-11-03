# Speed baseline and Go/C# pilots — 2026-11-03

## Lighthouse mobile, published site (before this change)

Lighthouse 12, mobile preset, sandbox Chromium, 2 runs per page; worst run shown.
Sandbox CPU is noisy (home varied 87–96), so these are a baseline, not the
release gate's three-run assessment.

| Page | Perf | A11y | LCP ms | TBT ms | CLS | JS kB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| / | 87 | 97 | 2132 | 316 | 0 | 200 |
| /produtos | 73 | 100 | 1461 | 1452 | 0.071 | 292 |
| /tabelas | 90 | 100 | 1318 | 350 | 0 | 186 |
| /criador | 95 | 100 | 1333 | 269 | 0 | 192 |
| /guias | 76 | 100 | 1496 | 1130 | 0 | 193 |
| /new | 28 | 96 | 5416 | 1866 | 0.778 | 463 |

/perguntas-frequentes was not measured: it returned 404 on the published build.

## Findings and fixes

1. **Game pages linked a missing stylesheet.** The published HTML linked
   `/assets/QuickLive-*.css` (404); the browser build emitted `styles-*.css` with
   the same hash. Cause: `QuickLive.tsx` imported `@/styles.css` directly next to
   the root's `styles.css?url`, so server and client named the asset differently.
   Every game page painted unstyled until JavaScript loaded the CSS (CLS 0.778 on
   /new). Fix: one `?url` asset in `src/lib/game-stylesheet.ts`; quick match
   adds that same link and waits for it before live play.
2. **/new downloaded the whole club database while painting** (dozens of
   1,000-row pages). The refresh now waits for browser idle; cached visits still
   apply instantly.
3. **Long guides on /produtos and /criador skipped no offscreen layout.** The
   `content-visibility` rule now covers every section after the first in public
   articles.

Not re-measured yet: the fixes reach the published site only after publishing.

## Go and C#/.NET pilots (CPU half-time reading, `src/game/ai-halftime.ts`)

Sources in `experiments/wasm-pilots/`. Same inputs, same outputs.

| | TypeScript (today) | Go (TinyGo 0.41) | C# (.NET 8, browser-wasm) |
| --- | ---: | ---: | ---: |
| Parity on 93,312 inputs | reference | 0 mismatches | identical sample results |
| Download | 0 extra | 1.0 kB (0.6 kB gzip) | 4.2 MB (1.34 MB Brotli) |
| Startup in browser | 0 | ~10 ms | 350–475 ms (local, cached) |
| 200k calls | — | ~9 ms | ~350–440 ms (interpreter, no AOT) |
| 18.7M calls in Bun | 2,194 ms | 2,655 ms | — |

Decision: neither ships. The function runs twice per match. Go is identical but
about 21% slower than TypeScript once results cross the boundary. .NET would add
about 1.3 MB to the match start on mobile. The plan's rule was to keep only what
improves the baseline, and neither does. Go on the server is also not an option:
the hosting runs only JavaScript there.
