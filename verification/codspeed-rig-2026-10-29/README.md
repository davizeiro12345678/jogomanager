# Rig fallback: controlled local comparison, 2026-10-29

This is CPU evidence for the JavaScript geometry fallback, not a CodSpeed CI
result or a frame-rate certification. The baseline is commit
`249f17e0bc5edb9f207880a9e4ddaa1de1f1c412`, which corresponds to the
previous successful CodSpeed run 40940856871. The candidate changes only
`src/game/rig-section-kernel.ts`: it computes each angular function once per
radial segment instead of once per segment per ring.

Both versions used the same workload from `src/game/benchmarks/rig.ts` (16
rings, roundness 1.2, both caps), Linux x86_64, AMD EPYC 9V74, Node 24.22.0,
and dependencies from the baseline lockfile (SHA-256
`3db02875ebc10942bb4bff25d00331cd21c0e2c0242c1c6384774f0c06028a4c`).
Each version was warmed for 1,500 calls. Then 16 rounds of baseline,
candidate, candidate, baseline were timed, each sample containing 500 calls;
GC was requested before each sample. `local-abba.json` includes all 32 samples
per version. Medians are nanoseconds per call.

| Workload | Baseline | Candidate | Median time reduction |
| --- | ---: | ---: | ---: |
| Fallback, 16 radial | 19,480 ns | 6,156 ns | 68.4% |
| Fallback, 64 radial | 75,313 ns | 16,493 ns | 78.1% |

Baseline source SHA-256: `3b01087173a329edc2c5a28f25a1edd2dc304c6d1f8ef0b1aca6c0ae0f662ed2`.
Candidate source SHA-256: `ab72784c878b762698e3714988980182c975b7edd60e0f8ce80a942d986e2312`.
A separate byte-for-byte differential check compared both outputs for 320
combinations of ring count, radial resolution, roundness, and cap modes; all
matched. Existing tests compare the fallback with the independent Rust/WASM
implementation. These results do not establish that other benchmarks changed,
that all scenarios improve, or that a 96% target was met. The Rust/WASM
implementation is unchanged. CI and CodSpeed must provide independent
verification; the release gate remains mandatory.
