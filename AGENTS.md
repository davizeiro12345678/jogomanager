<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Game architecture

- Keep national promotion/relegation tier links explicit in `src/game/pyramid.ts` and resolve all exchanges from one season snapshot; this preserves club counts, deterministic saves, and simultaneous moves across grouped divisions.
- Treat synced career JSON as a personal, untrusted save: only server-attested progress can grant durable achievements; multiplayer final scores must come from server replay, not client fields, to prevent fabricated wins.

- Keep season simulation sequential inside a dedicated Web Worker, not split across threads: each week depends on the preceding save; this preserves deterministic results without blocking rendering.
- Import premium sports records in bounded, resumable batches using stable source identifiers; cache immutable KTX2 and public sports images separately from private API responses.
- Limit KTX2 decoding workers from device capacity while reserving cores for rendering and the sequential match worker; saturating every core increases frame stalls.
- Reuse the existing R3F, Rapier, post-processing, BVH, GPU-detection, and motion stack before adding 3D packages; duplicate engines increase bundle size and runtime ownership conflicts.
- Send Slack notifications only from server code via `src/lib/slack.server.ts`, fire-and-forget; a Slack outage must never block purchases or matches.
- Preserve deterministic player identity while concentrating body mass in anatomical surfaces rather than uniformly scaling the whole rig; this keeps football silhouettes athletic across LODs.
- Validate new athlete rendering in an isolated career portrait before promoting it to match squads; this protects the 22-player frame budget.
- Career cloud saves are rejected when they carry less progress than the stored save of the same career, and attestation extends only through append-only, time-plausible continuations; this stops stale devices overwriting progress while keeping achievements server-decided.

## Critical performance requirements

- Performance budgets are mandatory release requirements of critical importance. A failed, missing, cancelled, or skipped required check is a release blocker. Do not turn assertions into warnings, raise limits, remove scenarios, or disable rules to make a release pass.
- Preserve the `Quality gates` workflow and its `Critical performance release gate`, including the real 200-match stress suite, same-runner MatchSim comparison, startup bundle checks, graphics contracts, and desktop/mobile Lighthouse assertions. Database replay and the other Quality jobs must also pass before production publication.
- Lint must pass with zero errors and zero warnings. Fix component/export boundaries instead of suppressing Fast Refresh diagnostics.
- Performance comparisons must use identical fixtures, seeds, runtime, dependencies, viewport and measurement protocol. Keep baseline and candidate evidence and check deterministic state as well as timing. Never describe skipped tests, software-rendered browser timings, or structural graphics tests as physical-device FPS certification.
- Production verification must compare the compile-time Git commit in `/api/health` with the exact approved release SHA, in addition to checking backend readiness and public access. Do not publish an obsolete revision after `main` has advanced.
- See `docs/critical-performance.md` for the limits and evidence required to assess a change.
- The connected backend did not run the recovered history in `supabase/migrations/` (it belongs to another backend); apply schema changes as new forward migrations under `drizzle/migrations/` and never replay those historical files, because they assume an empty database.
- Wallet items are spent only through service-role database functions called from authenticated server functions, and their rates live in both those functions and `src/lib/wallet-rules.ts`; the database is the authority so clients cannot mint coins or items.

- Keep match physics refinements as pure, randomness-free functions in `src/game/match-physics-extras.ts`; MatchSim and the Rapier authority call them so seeds and server replays stay deterministic.
- Coin-priced career services are charged only by `spend_coins_on_service` (prices, weekly limits and per-request idempotency in the database), which consumes a stored shop item before coins; the client applies the effect to its own save only after the server approves.
- Implausible career saves are still stored but never attested; the server records risk signals and a 30-day risk score blocks attestation, so suspicious accounts lose rewards before any ban.
- Every post-processing stack runs `HdrSanitize` before bloom; one non-finite pixel spread by bloom flashes the whole frame white or black.

- Reference the full game stylesheet only through `src/lib/game-stylesheet.ts` (`?url`); a second plain `import "@/styles.css"` makes server and browser builds name the asset differently and game pages link a missing stylesheet.
- Select home, store, tables, editorial or gameplay CSS in the root SSR head; shared public sources stay explicit, so route navigation preserves first-paint styling without downloading unrelated utilities.
- New-career catalog hydration starts at club selection, not root startup; bundled league identities remain available while optional catalog enrichment loads.
- Go and C#/.NET WebAssembly pilots were measured and rejected (`docs/report-2026-11-03-speed-and-wasm-pilots.md`); TypeScript stays the only runtime for game logic unless a new pilot beats that baseline.
- Move MatchSim behaviour into `src/game/sim-*.ts` modules as functions that take the sim (shared members marked `@internal`, not `private`), copying code verbatim and confirming same-seed parity against the previous engine; this shrinks sim.ts without changing draw order or replays.
- Split oversized modules into sibling files (`career-*.ts`, `apifootball-*.server.ts`, `players/PlayerStudioScene.tsx`, `features/match/*`) while the original file re-exports the public API; existing imports stay valid and each piece can be tested alone.
- Keep fatigue cadence shared between gait sampling and the visual motion clock; mismatched clocks cause foot sliding across LODs.
- Submit chat reports through the authenticated community function and validate targets and rate limits in the database; local hiding alone is not a report.
- Every accepted career save is hash-linked to the previous one by a database trigger (`careers.chain_hash`, ledger `career_save_chain`); clients never compute or send the hash, so a forged or replayed save cannot fake the chain.
