# Three.js r186 graphics hardening in PR #96

The game currently depends on `three: ^0.186.1`, `@react-three/fiber: ^9.8.2`
and uses native WebGPU only after an explicit user opt-in. The WebGL2 path
and saved career snapshots must remain backwards compatible.

## Implemented in this branch

- **Static shared geometry and BatchedMesh:** exterior pre-match light cones
  share one ConeGeometry and MeshBasicMaterial through a BatchedMesh. Four
  candidate draws are reduced to one in the *isolated scene-graph census*.
  This is NOT a measured 60% frame-rate improvement for the entire stadium.
  Do not apply multi-draw to skinned players or transparent objects which
  overlap and depend on painter-order sorting.
- **Sparse matrix transfers:** photographer flash matrices update only the
  dirty 16-float slots. Static pylon transforms are set only during setup.
  Verify actual GPU transfer bytes via a GPU capture before citing a 62.5%
  reduction; the CPU-side update range is only a proxy.
- **Material invalidations:** KTX2 texture completions in the same microtask
  turn notify subscribers once. A renderer-context reset still notifies
  synchronously and supersedes pending notices. This avoids repeated
  reconstruction of stadium materials and static merge groups.
- **Geometry cleanup:** temporary shell/pylon geometries are disposed after
  their contents are copied to the baked exterior geometry.

## Not included in the game renderer yet

The following items refer to *upstream Three.js development* rather than
functions exposed and production-tested by this game's pinned r186 version.
Do not insert patches from unmerged PRs into a paid production application.

| Request | Correct adoption gate |
| --- | --- |
| TAA depth history and velocity across multiple passes | Compare #35235, #35236, #35239 against a released, tested Three.js version; integrate with WebGPU render graph and measure ghosting on 1k+ moving instances. |
| Temporal jitter and custom projection | Validate projection restore, reverse depth, camera cuts, aspect changes and LOD teleport reset against native TRAA/TAAU. Never stack jitter on top of R3F camera updates without view-offset testing. |
| DDGI probe light-leak reduction | Evaluate #35174 visibility weighting and #35187 influence bounds only after benchmarked probe layout, depth data and gameplay memory budgets. |
| GPU compute PMREM | Evaluate #35130 after release and compare on the player's own adapter. Avoid dynamic PMREM for a stadium with static environment until evidence justifies it. |
| Half-float conversion improvements | Use the upstream released loader path and validate sRGB versus linear data, NaN handling and mobile GPU formats; do not reinterpret HDR bytes manually. |
| Cascaded shadow GPU write reduction | The match currently uses directional shadow maps, not the cited experimental CSM graph. Introduce only with shadow quality parity and a GPU timestamp/query. |
| GPU-driven meshlets / LOD and occlusion | Requires preprocessed clusters, a WebGPU compute pipeline, indirect draws, and a robust WebGL2 CPU fallback. Do not mislabel ordinary BatchedMesh as meshlets. |
| Full shared-geometry draw ranges | Consider #35112 after its target release, and validate mesh bounds against multi-draw positions and raycasting. |
| Material invalidation -98% | Microtask coalescing is implemented but the exact 98% must be benchmarked from material rebuild and shader compile counters. |

## Required release evidence

1. Run the exact PR SHA's Quality gates, including TypeScript, formatting,
   scene-census, deterministic 200-match stress, WebGL2, WebGPU fallback,
   textures/asset compression, mobile draw inventory, startup CPU and Lighthouse.
2. Capture `renderer.info.render.calls`, GPU frame time p50/p95 and transfer
   bytes before and after for the *same* stadium/camera/quality tier. Test
   cold load, camera cuts, crowd/grass LOD changes and context restoration.
3. Verify the four pylon lights preserve color, intensity and transforms
   visually. Compare with the unbatched baseline on opaque, transparent and
   additive paths.
4. Run CodSpeed on a matched runner. Simulation estimates CPU behavior and
   is not a substitute for a consistent GPU or walltime measurement. The
   target of a 96% speedup in *every benchmark* is a goal, not an achieved fact.
5. Keep the experimental rendering paths behind the existing per-device opt-in
   and preserve the automatic WebGL2 fallback. Do not merge a draft PR while
   release or Lighthouse gates fail.

Upstream references:
- https://github.com/mrdoob/three.js/pull/35112
- https://github.com/mrdoob/three.js/pull/35130
- https://github.com/mrdoob/three.js/pull/35174
- https://github.com/mrdoob/three.js/pull/35187
- https://github.com/mrdoob/three.js/pull/35235
- https://github.com/mrdoob/three.js/pull/35236
- https://github.com/mrdoob/three.js/pull/35239
