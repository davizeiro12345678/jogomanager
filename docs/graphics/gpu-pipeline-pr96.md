# GPU pipeline checklist, PR #96

Only a subset of the 19 requested GPU features is production-ready. Treat
all new WebGPU toggles as experiments. The PR must pass all same-SHA CI gates
before merge.

| Feature | Code state |
| --- | --- |
| GPU skinning | Existing `SkinnedMesh` rigid actor batch; compute skinning not added |
| Hierarchical Z-Buffer | Conservative CPU depth-pyramid reference; GPU depth pass pending |
| GPU crowd animation | Existing WebGL2 vertex animation; native WebGPU TSL port pending |
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
| GPU indirect/multi-draw | Existing BatchedMesh multi-draw; compute-generated indirect draws pending |
| Animation pose caching | Existing paused/offscreen/LOD pose reuse; shared cross-player cache pending |
| GPU texture-array atlas | RGBA8 DataArrayTexture builder; material layer selectors pending |
| GPU async readback | One-request bounded asynchronous readback helper; consumer pending |
| PSO prewarming | Idle-time WebGPU compileAsync opt-in; runs after initial LCP |

Opt-in keys in localStorage: `manager3d.webgpu.clusteredLighting`,
`manager3d.webgpu.taau`, `manager3d.webgpu.psoPrewarm` (value `on`).

A helper or CPU reference does not amount to a GPU compute integration. The
goal of 96% faster benchmarks has not been measured on the same hardware.
WebGL2 fallback, visual parity, GPU capture and exact-SHA CI are required.
