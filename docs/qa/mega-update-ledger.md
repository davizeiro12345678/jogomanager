# JogoManager mega update — execution ledger

Base: `cc75d5f827977a64244775aba664b5752884fa32` (`origin/main`, 2026-10-09).
Delivery: normal commits on `codex/mega-update-2026-10-09`, pull request to main. The latest user instruction also authorizes publication and remote migrations within the approved scope, after technical acceptance. See `cycle-acceptance-2026-10-09.md` for the current evidence and release blockers.

## Accepted contracts

- Scalable realism; sports broadcast presentation plus clear management panels.
- Main native GPU gate: Alta, 1280×720, DPR 1, mean ≥45 FPS, frame p95 ≤28 ms. Three equivalent runs per GPU, 60 s warmup and 300 s measured. 69 FPS remains a separate stretch campaign.
- Existing career identity, history, purchases and contracted wages stay compatible. New careers opt into versioned economy/development. Prospective precision/security corrections apply without recalculating history.
- Refunds are reconciled and recorded for review; no automatic entitlement revocation.
- One sequential writer per career; national exchanges use one season snapshot; durable achievements and multiplayer results require server authority.
- WASM athlete geometry stays disabled unless full-flow median gain ≥20%, including transfer and BufferGeometry construction, with no first-frame regression.

## Work and verification

| Workstream | Owner | State | Evidence |
| --- | --- | --- | --- |
| Graphics, cutscenes, KTX2 ownership, hero selection | implement_graphics | in progress | pending |
| Money precision, versioned economy/development, identity | implement_economy | in progress | pending |
| UI, SEO, server errors, payment reconciliation | implement_ui_security | in progress | pending |
| Deterministic physics, Worker fallback, WASM architecture | root | in progress | pending |
| Baseline, integration, full checks, native/browser QA | root | pending | pending |
| Independent code/spec review and GitHub delivery | root | pending | pending |

## Rulings

- Native worktree tool cannot operate on the non-Git Downloads parent (`Not a git repository`). Use a linked worktree from the canonical clean clone; preserve the parent and published history.
- Main contains newer security fixes than the planning snapshot. Reproduce each finding on this base and port local improvements selectively; never overlay the non-Git snapshot onto main.
- Supabase production ranking already ignores client wins and reports zero unverified match/win counters. Preserve that behavior in source/migrations.
- Codex Security Cloud access was denied during planning. Its status is an external coverage dependency, not a security clearance.

## Final acceptance checklist

- [x] TypeScript and focused regression tests (latest full unit suite: 220 files, 1,163 tests passed; see acceptance record)
- [x] Full unit suite and relevant simulation stress tests (1,163 unit tests; 200 compatibility seeds independently replayed; remote/Rapier campaign remains separate)
- [x] Rust tests and reproducible WASM build (18 tests; isolated release builds match shipped WASM; local no-wasm-opt scope)
- [ ] Production/graphics builds and existing bundle gates
- [ ] Before/after visual comparisons: match, Player Studio, cutscenes, management UI
- [ ] Native GPU campaign and resource lifecycle cycles
- [ ] CodSpeed initialized CPU/kernel/full-flow comparisons on trustworthy runners
- [ ] UI keyboard/mobile/error/offline and HTTP/SSR SEO checks
- [ ] Security review and database test coverage; remote changes only after release gates
- [ ] Independent review, normal commit/push, attached pull request
