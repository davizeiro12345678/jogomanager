# Local CPU comparison

Local Tinybench wall timing; not instrumented CodSpeed CI. Repetitions summarize observed variation and do not establish statistical significance or GPU/FPS gains.

Baseline runs: 2; candidate runs: 2; comparable: true.

| Existing benchmark | Before ms | After ms | Time reduction | Throughput gain | 89% faster target |
| --- | ---: | ---: | ---: | ---: | --- |
| match setup: buildTeamSetup | 0.150 | 0.192 | -27.570% | -21.612% | not reached |
| match setup: new MatchSim | 0.293 | 0.335 | -14.255% | -12.477% | not reached |
| match simulation: 300 live ticks | 5.446 | 5.976 | -9.741% | -8.877% | not reached |
| match simulation: 120 coarse steps | 3.669 | 3.579 | 2.451% | 2.513% | not reached |
| live match: snapshotMatch | 0.003 | 0.003 | 8.358% | 9.120% | not reached |
| live match: WorkerMatchView.apply | 0.015 | 0.014 | 6.442% | 6.885% | not reached |
| replay codec: encodeReplay | 18.075 | 18.427 | -1.944% | -1.907% | not reached |
| replay codec: decodeReplay | 11.945 | 10.509 | 12.019% | 13.661% | not reached |
| season: generateFixtures | 0.025 | 0.014 | 43.061% | 75.625% | not reached |
| season: tableFromFixtures | 0.039 | 0.036 | 6.998% | 7.524% | not reached |
| season: simulateDivisionTable | 3.749 | 3.546 | 5.434% | 5.746% | not reached |
| rng: makeRng 10k draws | 0.087 | 0.087 | -0.795% | -0.788% | not reached |
| rig geometry: fallback 64 radial | 0.096 | 0.042 | 55.589% | 125.169% | reached locally |
| rig geometry: fallback 16 radial | 0.023 | 0.011 | 51.782% | 107.392% | reached locally |
| rig geometry: Rust/WASM 64 radial | 0.148 | 0.038 | 74.123% | 286.446% | reached locally |
| rig geometry: Rust/WASM 16 radial | 0.035 | 0.010 | 70.511% | 239.111% | reached locally |

