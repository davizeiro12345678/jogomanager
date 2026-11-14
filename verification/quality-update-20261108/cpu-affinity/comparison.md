# Local CPU comparison

Local Tinybench wall timing; not instrumented CodSpeed CI. Repetitions summarize observed variation and do not establish statistical significance or GPU/FPS gains.

Baseline runs: 2; candidate runs: 2; comparable: true.

| Existing benchmark | Before ms | After ms | Time reduction | Throughput gain | 89% faster target |
| --- | ---: | ---: | ---: | ---: | --- |
| match setup: buildTeamSetup | 0.174 | 0.205 | -18.070% | -15.305% | not reached |
| match setup: new MatchSim | 0.308 | 0.361 | -17.329% | -14.770% | not reached |
| match simulation: 300 live ticks | 8.168 | 7.431 | 9.026% | 9.921% | not reached |
| match simulation: 120 coarse steps | 6.775 | 5.225 | 22.882% | 29.672% | not reached |
| live match: snapshotMatch | 0.003 | 0.003 | -11.323% | -10.171% | not reached |
| live match: WorkerMatchView.apply | 0.016 | 0.019 | -14.685% | -12.805% | not reached |
| replay codec: encodeReplay | 36.103 | 31.442 | 12.912% | 14.826% | not reached |
| replay codec: decodeReplay | 15.221 | 15.211 | 0.067% | 0.067% | not reached |
| season: generateFixtures | 0.024 | 0.013 | 45.943% | 84.991% | not reached |
| season: tableFromFixtures | 0.049 | 0.037 | 23.986% | 31.554% | not reached |
| season: simulateDivisionTable | 4.330 | 3.815 | 11.887% | 13.490% | not reached |
| rng: makeRng 10k draws | 0.098 | 0.094 | 4.550% | 4.767% | not reached |
| rig geometry: fallback 64 radial | 0.126 | 0.097 | 23.477% | 30.680% | not reached |
| rig geometry: fallback 16 radial | 0.040 | 0.025 | 37.283% | 59.445% | not reached |
| rig geometry: Rust/WASM 64 radial | 0.185 | 0.091 | 50.633% | 102.566% | reached locally |
| rig geometry: Rust/WASM 16 radial | 0.049 | 0.023 | 53.843% | 116.653% | reached locally |

