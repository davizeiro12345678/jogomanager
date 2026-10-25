# Match 3D realism and mobile implementation plan

> For agentic workers: use superpowers:executing-plans. The approved specification is binding; record implementation rulings and evidence in the plan ledger.

**Goal:** Fix the Studio leg tear and improve athlete realism, animation, contact physics and mobile rendering without weakening release gates.
**Architecture:** Preserve deterministic identity and authoritative simulation. Share anatomy across high/low representations and measure the real rendered geometry. Add bounded mobile scene policies and honest frame evidence.
**Tech Stack:** React, TypeScript, R3F/Three.js, Rapier, Vite, Vitest, existing WASM/CodSpeed.
**Spec:** docs/superpowers/specs/2026-10-25-match3d-design.md (approved v2).

## Global Constraints

- Preserve existing Quality gates, all 200 stress seeds and 21 deterministic checkpoints; no relaxed limits or skipped required checks.
- Preserve player identity, saved progress, names and account settings; no production database, auth or payment mutations.
- Reuse the current 3D stack and lockfile. No paid assets or services.
- Deliver an isolated branch, preview, PR and before/after evidence; no production publication before final approval.
- Mobile target: nominal 60 FPS, mean >=59.5, p95<=18 ms, p99<=25 ms; intervals>33.3 ms<=0.5%; no full 5 s window below58 FPS. Physical presentation remains unverified without authorized hardware and compositor evidence.
- Proposed mobile scene ceilings: basic 960x540,75draws/130k triangles; intermediate1280x720,110draws/260k triangles; Studio40draws/90k and50draws/140k respectively.

## Review Focus

- A real animated leg gap, including a boundary with skin/cloth following different bones.
- Crossed limbs, extreme body sizes, reversed/paused clips and low/high render parity.
- Rendering cadence versus actual presented FPS, especially software rendering and adaptive resolution.
- Invalid time deltas, contact replays and GPU/context/resource lifecycle.
- Startup lazy-loading boundaries and immutable authoritative checkpoints.

### Task 1: Baseline and reproducible Studio evidence

**Files:** scripts/graphics-vite.config.ts, existing graphics/player studio; baseline evidence outside tracked source.
**Interfaces:** existing PlayerStudio -> PlayerRig/LowPlayers; no product changes in this task.

- [ ] Run clean baseline tests/build and capture Studio/match screenshots, errors and frame/scene metadata.
- [ ] Identify exact pose, region, side and renderer for the reported leg gap using actual geometry and UI.
- [ ] Inspect Lighthouse traces separately from playback metrics.
      **Verification:** npm test; npm run graphics:build; meaningful Studio interactions in Playwright. Expected: record actual baseline, including any inherited failures; never fabricate a pass.

### Task 2: P0 leg tear and anatomical continuity

**Files:** src/game/rig-body.ts, rig-geometry.ts, rig-skin.ts, player-shorts.ts, player-model.ts; corresponding geometry/anatomy tests.
**Interfaces:** buildRigSkin, proportionsFor, existing skin indices/weights and garment opening identity.

- [ ] Write a regression using posed real triangles for the reproduced missing surface and observe RED.
- [ ] Correct the specific topology/skinning/coverage defect; preserve legal garment openings and draw budgets.
- [ ] Verify12 fixed identities, both sides, multiple clips/poses, body sizes and high/low paths.
- [ ] Correct additional demonstrated silhouette/joint problems while preserving deterministic identity.
      **Verification:** npm exec -- vitest run src/game/player-shorts.test.ts src/game/rig-skin.test.ts src/game/player-anatomy.test.ts src/game/rig-body.test.ts --pool=forks --maxWorkers=1; npm test. Expected: regression GREEN and baseline suite preserved.

### Task 3: Face, neck and athlete surface realism

**Files:** src/game/player-sculpt.ts, player-morphology.ts, player-materials.ts, rig-materials.ts, existing face/normal tests.
**Interfaces:** faceMorphology(seed), existing sculptedHead and shared material contracts.

- [ ] Capture current head/neck close-ups and identify concrete geometry/material defects.
- [ ] Add behavioral geometry regressions for demonstrated defects before changing surfaces.
- [ ] Improve local anatomy, normals and material response without rerolling the saved appearance or expanding distant-player work.
      **Verification:** npm exec -- vitest run src/game/player-sculpt.test.ts src/game/player-morphology.test.ts src/game/player-materials.test.ts src/game/player-naturalness.test.ts --pool=forks --maxWorkers=1; npm test. Expected: tests GREEN and equivalent-lighting close-up evidence.

### Task 4: Locomotion and action transitions

**Files:** src/game/gait-kinematics.ts, athlete-pose-blender.ts, football-action.ts, ground-contact.ts and player-rig-frame.ts as needed.
**Interfaces:** Pose and existing contact/action phases; solveGroundContact and blend outputs feed both player renderers.

- [ ] Record12 representative clips and transitions; reproduce discontinuities or slipping.
- [ ] Add targeted time/pose regressions before correcting movement and support composition.
- [ ] Verify left/right actions, pause/replay and same authoritatively sampled times at30/60/120 render Hz.
      **Verification:** npm exec -- vitest run src/game/gait-kinematics.test.ts src/game/athlete-pose-blender.test.ts src/game/football-action.test.ts src/game/ground-boot-contact.test.ts --pool=forks --maxWorkers=1; npm test. Expected: finite bounded poses, preserved support/contact and no cadence-dependent rules.

### Task 5: Physics, support and contact robustness

**Files:** src/game/rapier-ball-authority.ts, physics-quality.ts, rapier-ball-visual.ts, ground-contact.ts and related tests.
**Interfaces:** BallPhysicsAuthority and current integration clock remain authoritative; presentation never applies a second gameplay impulse.

- [ ] Audit ball/ground/post trajectories, support, delta validity and collision event ownership.
- [ ] Add real physics regressions for reproduced defects, observe RED and fix within existing checkpoint parity.
- [ ] Keep incompatible authoritative changes isolated and explicitly blocked from publication under the approved specification.
      **Verification:** npm exec -- vitest run src/game/rapier-ball-authority.test.ts src/game/rapier-ball-visual.test.ts src/game/physics-quality.test.ts src/game/live-match.visual-ball.test.ts --pool=forks --maxWorkers=1; npm test. Expected: finite repeatable physics, single contacts and no hidden checkpoint changes.

### Task 6: Mobile profiles and bounded render work

**Files:** src/game/contracts/graphics-profile.ts, runtime-scene-budget.ts, quality-governor.ts, FrameProbe.tsx, renderer/Studio/LOD components as demonstrated by profiling.
**Interfaces:** current graphics profiles stay valid; mobile policy constrains framebuffer/scene work and evidence records effective resolution/cadence.

- [ ] Add behavioral regressions for mobile pixel/scene budgets and unsupported/malformed evidence before implementation.
- [ ] Reuse cached pose/geometry/material buffers, bound costly work, preserve high/low silhouette and release resources correctly.
- [ ] Add honest frame submission/availability metadata; never label rAF callbacks as presented physical FPS.
      **Verification:** relevant graphics/runtime/quality/frame and lifecycle tests; npm test; npm run graphics:build. Expected: fixed-profile comparisons, scene caps and explicit unverified presentation without physical traces.

### Task 7: Stadium, crowd and scene presentation

**Files:** src/components/game/stadium/CrowdLod.tsx, CrowdReaction.tsx, Stadium3D.tsx, existing cinematic/post components.
**Interfaces:** shared runtime scene budget and deterministic crowd event inputs.

- [ ] Profile visible/offscreen crowd and post-processing cost and capture baseline presentation.
- [ ] Correct demonstrated crowd/scene issues with behavioral regressions and bounded changes.
- [ ] Verify day/night, dry/wet and goal/replay against unchanged scenario fixtures and draw budgets.
      **Verification:** relevant crowd/camera/scene tests; npm test; npm run graphics:build. Expected: comparable screenshots and bounded work without stealing the player budget.

### Task 8: Resolve inherited startup performance blocker

**Files:** routes and module-preload/loading code indicated by Lighthouse traces, without changing threshold configs.
**Interfaces:** initial JS protected paths; deferred3D loading must preserve first meaningful UI and controls.

- [ ] Reproduce current Lighthouse mobile failures with trace evidence.
- [ ] Add a meaningful regression for the observed eager work/import/loading defect before fixing it.
- [ ] Compare candidate/baseline startup bundle and repeat the3 pessimistic runs per protected URL.
      **Verification:** npm run test:performance-gates; npm run build; npm run bundle:check; existing Lighthouse configs. Expected: current limits preserved and all required assertions actually executed.

### Task 9: Full verification, evidence, preview and review

**Files:** software test/benchmark evidence outside source; final release summary, spec/plan and candidate code in the PR.
**Interfaces:** identical fixture/seed/viewport/dependencies/SHA identify every comparison.

- [ ] Run lint/types/full tests, stress200, WASM, deterministic ABBA construction, graphics/assets, bundle and security/replay checks available in the canonical workflow.
- [ ] Produce comparable before/after images and six short paired videos plus raw records and status matrix.
- [ ] Obtain a fresh whole-branch code review and fix important findings through RED/GREEN tests.
- [ ] Push the isolated branch and create a draft PR/preview; do not merge or publish production.
- [ ] Record physical mobile certification as pending when hardware/presentation traces are unavailable; do not misrepresent software timings as60FPS certification.
      **Verification:** complete Quality gates and the recorded browser interaction flow. Expected: every executed check has evidence and all missing/blocked checks remain explicit; production publication remains blocked until final approval and all mandatory gates pass.
