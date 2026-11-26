# Local CPU comparison

Local Tinybench wall timing; not instrumented CodSpeed CI. Repetitions summarize observed variation and do not establish statistical significance or GPU/FPS gains.

Baseline runs: 3; candidate runs: 3; comparable: true.

| Existing benchmark | Before ms | After ms | Time reduction | Throughput gain | 89% faster target |
| --- | ---: | ---: | ---: | ---: | --- |
| match setup: buildTeamSetup | 0.169 | 0.147 | 12.869% | 14.769% | not reached |
| match setup: new MatchSim | 0.329 | 0.309 | 6.072% | 6.465% | not reached |
| match simulation: 300 live ticks | 5.731 | 6.331 | -10.482% | -9.488% | not reached |
| match simulation: 120 coarse steps | 3.456 | 3.776 | -9.239% | -8.457% | not reached |
| live match: snapshotMatch | 0.003 | 0.002 | 4.239% | 4.426% | not reached |
| live match: WorkerMatchView.apply | 0.014 | 0.014 | -5.254% | -4.992% | not reached |
| replay codec: encodeReplay | 17.929 | 17.366 | 3.142% | 3.244% | not reached |
| replay codec: decodeReplay | 11.534 | 8.532 | 26.030% | 35.189% | not reached |
| season: generateFixtures | 0.024 | 0.013 | 44.692% | 80.806% | not reached |
| season: tableFromFixtures | 0.039 | 0.039 | 0.445% | 0.447% | not reached |
| season: simulateDivisionTable | 3.672 | 3.620 | 1.406% | 1.426% | not reached |
| rng: makeRng 10k draws | 0.083 | 0.082 | 1.356% | 1.375% | not reached |
| rig geometry: fallback 64 radial | 0.077 | 0.034 | 55.675% | 125.607% | reached locally |
| rig geometry: fallback 16 radial | 0.025 | 0.012 | 51.692% | 107.007% | reached locally |
| rig geometry: Rust/WASM 64 radial | 0.139 | 0.037 | 73.079% | 271.456% | reached locally |
| rig geometry: Rust/WASM 16 radial | 0.035 | 0.011 | 68.048% | 212.970% | reached locally |

