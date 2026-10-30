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
- **TRAA guard:** the opt-in WebGPU pipeline now discards color/velocity/depth
  history on cinematic cuts, zoom discontinuities and teleports. External
  view offsets bypass r186's destructive temporal jitter; on returning to a
  normal projection the history is rebuilt. This is not the upstream r188
  fix for previous-depth or instanced-velocity buffers.
- **Probe GI:** opt-in indoor cutscenes use the native GPU-resident
  `LightProbeGrid` on WebGPU (with bounded falloff), or
  `LightProbeGridWebGL` on WebGL2. Both bake only once per set and retain
  the original lighting on unsupported drivers. Neither backend implements
  the upstream unmerged Chebyshev DDGI visibility weighing.
- **FP16 volumes:** preallocated exponent/shift tables convert 32-bit HDR
  voxels to 16-bit payloads directly from typed-array bit patterns, including
  negative-zero preservation and unusual-value fallback to the official Three
  converter. A 32k-value equivalence test and CodSpeed benchmark were added.
- **PMREM budget:** the static stadium environment now uses power-of-two
  capture sizes (64/128/256), scaled by quality budget rather than oversized
  arbitrary 192/384 resolutions. This reduces capture allocations but is
  not compute-shader PMREM.
- **CSM option:** the opt-in native WebGPU 3-cascade shadow node from r186
  is enabled on high quality with camera-projection-dependent frustum updates.
  Shadow GPU write counts have not been measured.
- **CodSpeed visibility:** graphics preparation benchmarks now cover
  batched-versus-independent beams and FP16 conversion against scalar Three,
  in addition to all previous game-engine benchmarks.
- **Meshlet preparation:** `meshoptimizer` partitions indexed static meshes
  into bounded 64-vertex / 126-triangle clusters and exposes world-space
  bounding spheres with a conservative CPU frustum fallback. The tests verify
  triangle coverage and rejection of distant clusters. This prepares the
  cluster data; GPU compute occlusion and indirect draws still require the
  upstream renderer path and are NOT active in the match.

## Not included in the game renderer yet

The following items refer to *upstream Three.js development* rather than
functions exposed and production-tested by this game's pinned r186 version.
Do not insert patches from unmerged PRs into a paid production application.

| Request | Correct adoption gate |
| --- | --- |
| TAA depth history / motion across passes | Camera-cut invalidation and view-offset safe fallback implemented. Upstream #35235/#35236/#35239 are still required for fully correct depth/velocity history and thousands of moving instances. |
| Temporal jitter and custom projection | External view offsets use the stable render path to prevent r186 TRAA from overwriting the projection; true jitter-preserving TAA awaits upstream. |
| DDGI light leaking | Bounded room-local WebGPU probe volumes implemented; true DDGI visibility weighting across walls awaits #35174/#35187. |
| GPU compute PMREM | Power-of-two budget implemented; compute kernel #35130 remains an upstream open experimental PR. |
| Half-float 5.2× conversion | Fast bit-pattern converter implemented with parity tests. No target-device 5.2× speedup has been measured yet. |
| CSM from 302 to 7 GPU writes | Native CSM opt-in and frustum update throttling implemented. This exact reduction has not been profiled and must not be claimed. |
| GPU-driven meshlets, GPU occlusion, indirect draws | **Preprocessing implemented, GPU renderer pending.** Bounded meshopt clusters and CPU frustum fallback are tested. GPU visibility buffers, indirect-draw integration and real GPU occlusion remain unshipped. |
| Full shared-geometry draw ranges | BatchedMesh implemented for exterior cones; upstream #35112 still pending for arbitrary mesh draw ranges. |
| Material invalidation 98% | Same-turn KTX2 coalescing implemented; exact 98% remains unmeasured. |

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
