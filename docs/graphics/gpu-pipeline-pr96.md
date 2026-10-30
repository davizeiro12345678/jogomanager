# GPU pipeline checklist, PR #96

Only a subset of the 19 requested GPU features is production-ready. Treat
all new WebGPU toggles as experiments. The PR must pass all same-SHA CI gates
before merge.

| Feature | Code state |
| --- | --- |
| GPU skinning | Existing `SkinnedMesh` rigid actor batch; compute skinning not added |
| Hierarchical Z-Buffer | Opt-in native WebGPU GPU-compute conservative max-depth pyramid, generated from temporal scene depth; also retains CPU reference |
| GPU crowd animation | Native WebGPU TSL shader for tiered instanced crowds; WebGL2 GLSL path retained; GPU visual parity still needs capture |
| Geometry quantization | Uint16 position pack/decode with precision tests; shader decode pending |
| Shader permutation reduction | Shared materials/batches and reduced shadow receivers |
| Adaptive animation rate | Integrated quality/LOD-dependent pose cadence, full-rate near players |
| Texture streaming | Existing bounded KTX2 streaming and compressed GPU budget |
| Clustered lighting | Native WebGPU opt-in with bounded light lists |
| Temporal upscaling | Native WebGPU opt-in TAAU, 0.75 internal resolution |
| Shadow receiver optimization | Baked grandstands skip unnecessary real-time shadow sampling |
| LOD hysteresis | Integrated 2.5 m sector retention in grass selection |
| Frustum culling by sectors | Existing crowd worker/WASM tiles and grass chunks |
| Render target pooling | Bounded scratch resource pool; not yet used by EffectComposer |
| GPU performance governor | Existing p95-driven adaptive renderer quality stages |
| GPU indirect/multi-draw | GPU compute now writes five-word indirect draw arguments for crowd LOD pools; GPU Hi-Z can conservatively suppress a fully occluded whole tier; per-tile compaction remains pending |
| Animation pose caching | Existing paused/offscreen/LOD pose reuse; shared cross-player cache pending |
| GPU texture-array atlas | RGBA8 DataArrayTexture builder; material layer selectors pending |
| GPU async readback | One-request bounded asynchronous readback helper; consumer pending |
| PSO prewarming | Idle-time WebGPU compileAsync opt-in; runs after initial LCP |

Opt-in keys in localStorage: `manager3d.webgpu.clusteredLighting`,
`manager3d.webgpu.taau`, `manager3d.webgpu.psoPrewarm`,
`manager3d.webgpu.hiz`, `manager3d.webgpu.crowdIndirect` (value `on`).
The GPU depth pyramid requires a temporal render pass, so activate TAAU or
TRAA together with Hi-Z. Restart the scene after changing flags.

The Hi-Z GPU compute path and indirect draw arguments are implemented, but the
first occlusion consumer uses only the final **1x1 max-depth level** and suppresses
only an entirely occluded whole LOD pool. It will often cull nothing because
sky pixels naturally have depth=1. Per-sector GPU compaction and a GPU trace
are required before claiming a material draw-call or FPS improvement. The
goal of 96% faster benchmarks has not been measured on the same hardware.
WebGL2 fallback, visual parity, GPU capture and exact-SHA CI are required.
