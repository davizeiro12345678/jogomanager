<!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ -->
## Merging this PR will regress 4 benchmarks

<details>
<summary><b>2 warnings</b></summary>

> :warning: **4 benchmarks are dominated by system calls**
>
> System calls cannot be simulated consistently and are left out of the measure. The reported value understates the real cost. Switch to the Walltime instrument to measure them.
>
> [Learn more about system calls](https://codspeed.io/docs/instruments/cpu?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time#system-calls)
>
> [See affected benchmarks](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?q=has%3Asignificant_sys_time&utm_source=github&utm_medium=comment-v2&utm_content=affected_benchmarks)

> :warning: **Base and head ran on different runner types**
>
> Some benchmarks with significant performance changes were compared across different runner types, so the changes might not come from the code. Run base and head on the same runner type, or use CodSpeed Macro Runners for more stable results.
>
> [Learn more about Macro Runners](https://codspeed.io/docs/features/macro-runners)
>
> [Open the report in CodSpeed to investigate](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?utm_source=github&utm_medium=comment-v2&utm_content=comparison_issues)

</details>


`⚡ 11` improved benchmarks
`❌ 4` regressed benchmarks
`✅ 1` untouched benchmark
`🆕 9` new benchmarks


> [!WARNING]
> Please fix the performance issues or [acknowledge them on CodSpeed](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?q=is%3Aregression&utm_source=github&utm_medium=comment-v2&utm_content=acknowledge).

### Performance Changes

|     | Benchmark | `BASE` | `HEAD` | Efficiency |
| --- | --------- | ------ | ------ | ---------- |
| ❌ | [`` match simulation: 300 live ticks ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520simulation%3A%2520300%2520live%2520ticks&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 134.4 ms | 212.3 ms | -36.69% |
| ❌ | [`` replay codec: decodeReplay ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Areplay%2520codec%3A%2520decodeReplay&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 374.8 ms | 546.2 ms | -31.39% |
| ❌ | [`` match simulation: 120 coarse steps ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520simulation%3A%2520120%2520coarse%2520steps&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 83.1 ms | 97.2 ms | -14.43% |
| ❌ | [`` live match: WorkerMatchView.apply ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Alive%2520match%3A%2520WorkerMatchView.apply&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 355.6 µs | 415.1 µs | -14.33% |
| ⚡ | [`` replay codec: encodeReplay ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Areplay%2520codec%3A%2520encodeReplay&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 577 ms | 163.9 ms | ×3.5 |
| ⚡ | [`` match setup: new MatchSim ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520setup%3A%2520new%2520MatchSim&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 4.5 ms | 1.6 ms | ×2.7 |
| ⚡ | [`` season: tableFromFixtures ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Aseason%3A%2520tableFromFixtures&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 2.4 ms | 1.1 ms | ×2.2 |
| ⚡ | [`` season: generateFixtures ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Aseason%3A%2520generateFixtures&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 665 µs | 317.7 µs | ×2.1 |
| ⚡ | [`` rig geometry: Rust/WASM 64 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252064%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1,379 µs | 733.6 µs | +87.96% |
| ⚡ | [`` season: simulateDivisionTable ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Aseason%3A%2520simulateDivisionTable&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 62.9 ms | 38.4 ms | +63.87% |
| ⚡ | [`` rig geometry: Rust/WASM 16 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252016%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 402.3 µs | 245.5 µs | +63.86% |
| ⚡ | [`` rig geometry: fallback 64 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520fallback%252064%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1.9 ms | 1.3 ms | +43.76% |
| ⚡ | [`` match setup: buildTeamSetup ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520setup%3A%2520buildTeamSetup&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 4.7 ms | 3.4 ms | +39.3% |
| ⚡ | [`` rig geometry: fallback 16 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520fallback%252016%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 607.3 µs | 460.6 µs | +31.83% |
| ⚡ | [`` rng: makeRng 10k draws ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Arng%3A%2520makeRng%252010k%2520draws&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1.4 ms | 1.3 ms | +14.72% |
| 🆕 | [`` presentation contact: 22 grounded athletes ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520contact%3A%252022%2520grounded%2520athletes&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 1.6 ms | N/A |
| 🆕 | [`` presentation contact: body recovery ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520contact%3A%2520body%2520recovery&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 182.4 µs | N/A |
| 🆕 | [`` presentation geometry: detailed hair ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520detailed%2520hair&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 422.3 ms | N/A |
| 🆕 | [`` presentation geometry: head match close ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520head%2520match%2520close&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 181.8 ms | N/A |
| 🆕 | [`` presentation geometry: head match distant ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520head%2520match%2520distant&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 14.9 ms | N/A |
| ... | ... | ... | ... | ... |

<br/>

> :information_source: _Only the first 20 benchmarks are displayed. [Go to the app to view all benchmarks](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?utm_source=github&utm_medium=comment-v2&utm_content=all_benchmarks)._

> [!TIP]
> Investigate this regression by commenting `@codspeedbot fix this regression` on this PR, or directly use the [CodSpeed MCP](https://codspeed.io/docs/ai/mcp?utm_source=github&utm_medium=comment-v2&utm_content=mcp_tip_regression) with your agent.

---

<sub>Comparing <code>codex/integrity-realism-graphics-20261023</code> (ccba0f9) with <code>main</code> (3ff9192)</sub>

<a href="https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?utm_source=github&utm_medium=comment-v2&utm_content=button">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">
    <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">
  </picture>
</a>
