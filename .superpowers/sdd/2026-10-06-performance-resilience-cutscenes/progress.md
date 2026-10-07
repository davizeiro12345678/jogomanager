# SDD ledger — plan: C:\Users\User\Downloads\stadium-stewards (3)\docs\superpowers\plans\2026-10-06-performance-resilience-cutscenes.md

Setup: Native execution in isolated checkout `audit-jogomanager-646afae`; the parent snapshot has no `.git` and differs from this checkout, so no files were copied across.

Pre-flight: shared interfaces — Tarefa 0 produces the metric schema consumed by Tarefas 4, 5, 6 and 7; Tarefa 1 produces `reportSilent` and worker-error contracts consumed by Tarefas 2, 3 and 7; Tarefa 2 changes `LiveSnapshot`/`WorkerMatchView` consumed by match routes, replay capture and benchmark; Tarefa 3 preserves replay consumers and storage compatibility used by the gallery; Tarefa 4 supplies profiler/governor evidence consumed by the final benchmark; Tarefa 5 changes shared career layout consumed by all career routes; Tarefa 6 consumes chunk retry and cinematic runtime contracts from Tarefa 1.

Ruling: implement against the clean Git checkout rather than copying the non-Git parent snapshot — the parent has divergent code/dependencies and copying it would overwrite user data and invalidate the isolated Git boundary; cost if wrong: local changes in the parent snapshot will not receive this implementation and must be reconciled separately.

Ruling: the bundled SDD shell helpers could not run because this Windows host has no bash; this ledger is the manual equivalent and is updated after each task chunk.

Task 0: complete — installed dependencies; tsc, Vitest baseline, graphics build and deterministic snapshot telemetry passed; captured browser benchmark in verification/performance-2026-10-06/baseline.json. Benchmark exposed a visible WebGL fallback and no device matrix, so results are local comparative evidence only.

Task 1: complete — added deduplicated classified silent-error reporting, worker ErrorEvent/messageerror/unhandledrejection serialization, UI-visible cutscene retry/fallback, and failure-injection tests. Operational catches now report fatal/degradation/ignorable intent instead of silently disappearing.

Task 2: complete — added typed-array live-match packets with 3-slot transferable buffer pool, delta events, two-snapshot client retention and interpolation, plus versioned replay codec/storage compatibility. The measured 23,284-frame fixture only reduced 5.6%, below the 20% write gate, so legacy v2 remains the persisted representation while v3 stays readable/available for future fixtures.

Task 3: complete — added static Three lifecycle audit and shorts moire/waist-band correction. The scoped static inventory reports 19 dispose calls (not a runtime census); shared materials remain reference-counted and the final runtime profile still needs browser inspection before governor thresholds are changed.

Task 4: in progress — introduced career CSS tokens/layer registry, z-index scale, measured safe-area content reservation, container-driven card layouts, and audit artifact. The legacy stylesheet still has 25 media blocks (three primary shell cuts plus contextual accessibility/height/hover rules) and many repeated selectors/literal colors; these remain explicit follow-up debt rather than being hidden by the audit.
