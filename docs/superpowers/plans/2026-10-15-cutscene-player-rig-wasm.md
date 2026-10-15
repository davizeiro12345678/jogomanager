# Cutscenes, PlayerRig e geometria WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularizar as responsabilidades de cutscene e PlayerRig, carregar somente o ambiente cinematográfico ativo e medir o caminho existente de geometria Rust/WASM sem alterar a autoridade ou a primeira renderização.

**Architecture:** Separar os sete ambientes em módulos com contrato comum; carregá-los por um registro tipado de imports dinâmicos e manter a ilustração 2D como fallback. Extrair a UI de diálogo/controles como componentes controlados e a seleção temporal da animação do PlayerRig como função pura. Medir kernel e fluxo de geometria pelo caminho Worker existente, preservando o fallback TypeScript e o gate Rust desligado até haver evidência comparável.

**Tech Stack:** React, React Three Fiber, Three.js, TypeScript, Vitest, Rust/WASM, Vite, CodSpeed Tinybench.

**Spec:** `docs/superpowers/specs/2026-10-15-cutscene-player-rig-wasm-design.md`

## Global Constraints

- Preservar a simulação sequencial no `match.worker.ts`; nenhuma regra, RNG, save, relógio, resultado, economia ou decisão de segurança migra para Rust/WASM no cliente.
- Usar o Worker de geometria, `WASM_CAPABILITY.rigSection`, os limites atuais, cache limitado e fallback TypeScript; não criar runtime ou dependência duplicada.
- Manter Rust/WASM desligado até pelo menos três medições de fluxo completo comparáveis demonstrarem ganho mediano mínimo de 20% e nenhuma regressão na primeira imagem.
- Preservar aparência, seed/identidade, LOD, cadência de `useFrame`, seleção 2D/3D, acessibilidade e comportamento de saves.
- Não alterar imagens/assets, dependências, serviços remotos ou produção; manter o PR #39 em draft e nunca reescrever histórico publicado.
- Comparar closures estáticas e chunks sob demanda em bytes, Gzip e Brotli sob a mesma configuração; bundle menor não equivale a FPS ou Core Web Vitals melhores.

## Review Focus

- Arte/set desconhecido ou registro incompleto: não renderizar um ambiente incorreto; usar a saída ilustrada segura. Testar o registro exaustivo na Task 2.
- Import do chunk de uma cena falha ou fica pendente: manter o estado de carregamento e permitir fallback/retry 2D sem travar a cutscene. Testar falha de import e retry na Task 2.
- A cena muda enquanto um chunk anterior ainda carrega: apenas o ambiente atual pode aparecer; testar seleção concorrente/tardia na Task 2.
- Player pausado, em preview ou com clip/foco de gol: progresso e pose devem permanecer determinísticos sem mutar o snapshot. Testar esses casos na Task 4.
- WASM apresenta entrada inválida, trap, ABI incompatível, timeout ou resposta corrompida: rejeitar o buffer e manter o fallback TS. Testar falha/paridade na Task 5.

---

### Task 1: Separar os ambientes cinematográficos por responsabilidade

**Files:**
- Create: `src/components/game/cinematic/sets/types.ts`
- Create: `src/components/game/cinematic/sets/shared.tsx`
- Create: `src/components/game/cinematic/sets/LockerRoom.tsx`
- Create: `src/components/game/cinematic/sets/Tunnel.tsx`
- Create: `src/components/game/cinematic/sets/PressRoom.tsx`
- Create: `src/components/game/cinematic/sets/PitchEntry.tsx`
- Create: `src/components/game/cinematic/sets/Stands.tsx`
- Create: `src/components/game/cinematic/sets/Office.tsx`
- Create: `src/components/game/cinematic/sets/BusArrival.tsx`
- Modify: `src/components/game/CinematicLocationSets.tsx`, `src/components/game/CinematicStage3D.tsx`
- Test: `src/components/game/cinematic/sets/cinematic-set-modules.test.ts`

**Interfaces:**
- Produces: `CinematicSetProps` with `primary`, `secondary`, `speaker`, and optional `festive`/`training`; scene modules keep the existing named exports until Task 2.
- `shared.tsx` owns only the existing cross-scene hash, celebration rain, press flashes, and tunnel dust helpers.

- [ ] **Step 1: Write the failing module contract test** asserting all seven named scenes export callable components through the current facade.
- [ ] **Step 2: Run the focused test** with `npm.cmd exec -- vitest run src/components/game/cinematic/sets/cinematic-set-modules.test.ts --pool=forks --maxWorkers=1`; expected: FAIL because the separated modules do not exist.
- [ ] **Step 3: Extract each scene and only its shared helpers** into the listed files; keep `CinematicStage3D` statically importing the modules for this task so render behavior is unchanged.
- [ ] **Step 4: Run the module contract test and `src/components/game/cinematic/cinematic-surfaces.test.ts`**; expected: PASS with the same scene exports and surface lifecycle.
- [ ] **Step 5: Run `npm.cmd exec -- tsc --noEmit --pretty false` and `git diff --check`; expected: no type or whitespace errors.
- [ ] **Step 6: Commit** as `refactor: split cinematic environment modules`.

### Task 2: Carregar apenas o set cinematográfico selecionado

**Files:**
- Create: `src/components/game/cinematic/sets/registry.ts`
- Create: `src/components/game/cinematic/sets/registry.test.ts`
- Modify: `src/components/game/CinematicStage3D.tsx`, `scripts/bundle-report.mjs`
- Remove: `src/components/game/CinematicLocationSets.tsx` after confirming no remaining callers.

**Interfaces:**
- Consumes: `CinematicSetProps` and the seven scene modules from Task 1.
- Produces: exhaustive `CINEMATIC_SET_LOADERS: Record<CinematicSet, () => Promise<...>>`; resolving a set invokes only its loader. The rendered scene is wrapped in local `Suspense` and a set-load error boundary that calls the existing `onUnavailable` illustrated fallback.

- [ ] **Step 1: Write failing registry tests** for all seven `CinematicSet` keys, selected-loader-only invocation, and propagation of a rejected selected import.
- [ ] **Step 2: Run the focused registry test** with `npm.cmd exec -- vitest run src/components/game/cinematic/sets/registry.test.ts --pool=forks --maxWorkers=1`; expected: FAIL because the loader registry does not exist.
- [ ] **Step 3: Replace static scene imports with typed dynamic imports**; mount only the active set, retain a non-blocking R3F fallback while it loads, and route a rejected import to the existing 2D fallback/retry path.
- [ ] **Step 4: Extend `scripts/bundle-report.mjs`** to report `CinematicStage3D` static closure and enforce that all seven scene modules are emitted as dynamic chunks and absent from that static closure.
- [ ] **Step 5: Run the registry test, build, and `npm.cmd run bundle:check`; expected: PASS and the report lists per-scene JS/Gzip/Brotli sizes without scene chunks in the stage static closure.
- [ ] **Step 6: Run the cinematic preview for all seven sets and force one failed scene-chunk load; expected: only the selected scene renders, a late prior load is ignored, and failure recovers through the illustrated fallback/retry.
- [ ] **Step 7: Commit** as `perf: lazy load cinematic environment chunks`.

### Task 3: Extrair diálogo e controles como UI controlada

**Files:**
- Create: `src/components/game/cinematic/CutsceneDialogue.tsx`
- Create: `src/components/game/cinematic/CutsceneSettings.tsx`
- Create: `src/components/game/cinematic/CutsceneDialogue.test.tsx`
- Create: `src/components/game/cinematic/CutsceneSettings.test.tsx`
- Modify: `src/components/game/cinematic/CutsceneStage.tsx`

**Interfaces:**
- Produces: controlled presentation props for `CutsceneDialogue` (`beat`, `speaker`, `text`, `typed`, `choices`, `chosen`, `captions`, `onNext`, `onChoose`) and `CutsceneSettings` (existing toggle values and callbacks).
- `CutsceneStage` remains the sole owner of playback, voice, timing, branch state, portal/focus and modal lifecycle; child components own only their DOM presentation.

- [ ] **Step 1: Write failing server-render tests** for dialogue text/choice semantics and settings labels/pressed states using `renderToStaticMarkup`.
- [ ] **Step 2: Run the two focused tests** with `npm.cmd exec -- vitest run src/components/game/cinematic/CutsceneDialogue.test.tsx src/components/game/cinematic/CutsceneSettings.test.tsx --pool=forks --maxWorkers=1`; expected: FAIL because the components do not exist.
- [ ] **Step 3: Move only the presentational JSX** to the two controlled components; keep callbacks and state transitions in `CutsceneStage` and preserve all labels, keyboard behavior, focus handling and ARIA attributes.
- [ ] **Step 4: Run the focused tests plus `src/game/cutscene-dialogue.test.ts` and `src/game/cutscene-story.test.ts`; expected: PASS with choices/branch behavior unchanged.
- [ ] **Step 5: Commit** as `refactor: separate cutscene dialogue controls`.

### Task 4: Modularizar seleção de animação do PlayerRig

**Files:**
- Create: `src/components/game/players/player-rig-frame.ts`
- Create: `src/components/game/players/player-rig-frame.test.ts`
- Create: `src/components/game/players/player-rig-animation.ts`
- Create: `src/components/game/players/player-rig-animation.test.ts`
- Modify: `src/components/game/players/PlayerRig.tsx`

**Interfaces:**
- Produces: `usePlayerRigFrame(input: PlayerRigFrameInput): void`, which owns the existing single `useFrame` callback; `PlayerRigFrameInput` groups the current scene snapshot/settings, presentation state refs, mesh/cloth resources and bone refs without adding a second animation clock.
- Produces: `resolvePlayerRigAnimationFrame(input: PlayerRigAnimationInput): PlayerRigAnimationFrame`; input carries current clip/time, `deltaSeconds`, speed/action/stamina/possession context, seed/time and optional preview clip/time and goal progress/seed; output carries selected clip, advanced clip time, normalized progress `u` and pose context `{ t, u, speed, stride, seed }`.
- `PlayerRig.tsx` stays the R3F composition owner; the frame hook owns scheduling/orchestration, while the pure helper owns deterministic clip/progress selection. LOD, IK, hair, cloth, bone writes and simulation state retain their current behavior.

- [ ] **Step 1: Write failing tests** for one `useFrame` registration and for preview-clip precedence, clip-change time reset plus cadence advancement, goal-progress/action-progress precedence, and repeatable output for identical inputs.
- [ ] **Step 2: Run the focused tests** with `npm.cmd exec -- vitest run src/components/game/players/player-rig-frame.test.ts src/components/game/players/player-rig-animation.test.ts --pool=forks --maxWorkers=1`; expected: FAIL because the hook/helper do not exist.
- [ ] **Step 3: Move the current callback body unchanged into `usePlayerRigFrame`** and pass its mutable refs/resources through the grouped `PlayerRigFrameInput`; keep exactly one `useFrame` registration and do not move Worker simulation or change LOD/IK cadence.
- [ ] **Step 4: Extract the existing clip selection and time/context formulas** into `resolvePlayerRigAnimationFrame` and replace only that block in the frame hook.
- [ ] **Step 5: Run both focused tests plus `src/game/animation-catalog.test.ts`, `src/game/player-morphology.test.ts`, and `src/game/rig-body.test.ts`; expected: PASS with appearance, deterministic pose, and rig contracts unchanged.
- [ ] **Step 6: Run `npm.cmd exec -- tsc --noEmit --pretty false` and `git diff --check`; expected: no type or whitespace errors.
- [ ] **Step 7: Commit** as `refactor: isolate deterministic player rig frame update`.

### Task 5: Validar o Worker de geometria e medir TS versus Rust/WASM

**Files:**
- Create: `src/game/rig-geometry.worker.test.ts`
- Create: `src/game/rig-geometry-flow-benchmark.ts`
- Modify: `src/game/benchmarks/rig.ts`, `src/game/rig-geometry.worker.ts`, `src/game/rig-geometry-worker-client.ts`, `src/game/rig-geometry-gate.test.ts`
- Test: `src/game/rig-section-kernel.test.ts`

**Interfaces:**
- Consumes: current `GeometryBatch`, `RigGeometryWorkerClient`, `generateRigSectionFallback`, generated `generate_rig_section`, and `evaluateGeometryReleaseGate` contracts.
- Produces: an opt-in, same-input benchmark for TS fallback and Rust/WASM kernel; a flow result that records lane wait, worker round trip/transfer, returned-buffer validation, `BufferGeometry` construction, and first visible PlayerRig image time. Benchmark data is evidence only; it does not implicitly enable the release gate.

- [ ] **Step 1: Add failing parity and failure-path tests** covering representative 16/64 radial inputs, finite bounded outputs, Rust/TS vertex parity within `1e-6`, and TypeScript fallback for WASM import/ABI/trap/timeout or invalid response.
- [ ] **Step 2: Run the focused geometry tests** with `npm.cmd exec -- vitest run src/game/rig-section-kernel.test.ts src/game/rig-geometry.worker.test.ts src/game/rig-geometry-gate.test.ts --pool=forks --maxWorkers=1`; expected: new parity/failure tests fail before implementation.
- [ ] **Step 3: Add tests around the worker's batch computation** with injectable WASM loading; retain current count, byte, finite-value and deadline validation, never expose borrowed WASM memory, and fall back to TS on every failure case.
- [ ] **Step 4: Add paired `@codspeed/tinybench-plugin` benchmarks** for TS and Rust/WASM with identical 16/64 radial inputs; fail setup if WASM cannot initialize so the benchmark cannot silently compare TS against itself.
- [ ] **Step 5: Add the opt-in browser flow harness** over the existing lane reservation, real module Worker, transfer/return validation, geometry construction, and PlayerRig first-visible callback; feed only completed, same-device/same-build runs into `GeometryFlowMeasurement`.
- [ ] **Step 6: Run focused geometry tests and the CodSpeed benchmark workflow; expected: tests PASS, TS fallback remains available, results are tagged to the exact commit, and `RUST_GEOMETRY_RELEASE.enabled` remains false without three qualifying complete-flow measurements.
- [ ] **Step 7: Commit** as `perf: benchmark bounded rig wasm geometry`.

### Task 6: Validar closures, comportamento visual e entregar no PR #39

**Files:**
- Modify only source/tests/report files above if a focused gate exposes a regression.
- Update: PR #39 with normal commits; leave it in draft until required CI/review gates pass.

**Interfaces:**
- Consumes: completed deliverables from Tasks 1–5 and the spec's immutable behavior/security constraints.
- Produces: reviewable PR commits and same-build bundle/CodSpeed evidence; no deploy or production mutation.

- [ ] **Step 1: Run focused tests, TypeScript, lint, `npm.cmd run wasm:test`, `npm.cmd run build`, `npm.cmd run bundle:check`, and `git diff --check`; expected: all required checks pass.
- [ ] **Step 2: Compare before/after page and cinematic-stage closures** in bytes/Gzip/Brotli from the same build/config; expected: unselected environment modules are dynamic-only and cutscene/player rig remain absent from unrelated route startup closures.
- [ ] **Step 3: Review CodSpeed runs** for the exact PR commit against a compatible base environment; report environment differences and make no speed claim from incomparable runs, synthetic numbers, or bundle bytes alone.
- [ ] **Step 4: Verify `git status` contains only planned PR files, inspect the complete diff and security boundary, then check the remote PR #39 head before pushing; push only normal commits, never force-push or amend.
- [ ] **Step 5: Keep PR #39 draft** unless every required test, bundle, scene-preview and security review gate passes; do not deploy.

