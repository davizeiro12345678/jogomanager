<!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ -->
## Merging this PR will regress 5 benchmarks

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


`⚡ 4` improved benchmarks
`❌ 5` regressed benchmarks
`✅ 7` untouched benchmarks
`🆕 9` new benchmarks


> [!WARNING]
> Please fix the performance issues or [acknowledge them on CodSpeed](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?q=is%3Aregression&utm_source=github&utm_medium=comment-v2&utm_content=acknowledge).

### Performance Changes

|     | Benchmark | `BASE` | `HEAD` | Efficiency |
| --- | --------- | ------ | ------ | ---------- |
| ❌ | [`` match simulation: 300 live ticks ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520simulation%3A%2520300%2520live%2520ticks&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 134.4 ms | 205.7 ms | -34.67% |
| ❌ | [`` replay codec: decodeReplay ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Areplay%2520codec%3A%2520decodeReplay&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 374.8 ms | 573.4 ms | -34.64% |
| ❌ | [`` live match: WorkerMatchView.apply ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Alive%2520match%3A%2520WorkerMatchView.apply&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 355.6 µs | 504.1 µs | -29.45% |
| ❌ | [`` match setup: buildTeamSetup ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520setup%3A%2520buildTeamSetup&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 4.7 ms | 4.8 ms | -3.54% |
| ❌ | [`` match simulation: 120 coarse steps ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520simulation%3A%2520120%2520coarse%2520steps&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 83.1 ms | 85.4 ms | -2.62% |
| ⚡ | [`` match setup: new MatchSim ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520setup%3A%2520new%2520MatchSim&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 4.5 ms | 2.4 ms | +84.42% |
| ⚡ | [`` rig geometry: Rust/WASM 64 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252064%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1.4 ms | 1.1 ms | +29.54% |
| ⚡ | [`` live match: snapshotMatch ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Alive%2520match%3A%2520snapshotMatch&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1,235.3 µs | 972.2 µs | +27.06% |
| ⚡ | [`` rig geometry: Rust/WASM 16 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252016%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 402.3 µs | 318.2 µs | +26.46% |
| 🆕 | [`` presentation contact: 22 grounded athletes ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520contact%3A%252022%2520grounded%2520athletes&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 1.9 ms | N/A |
| 🆕 | [`` presentation contact: body recovery ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520contact%3A%2520body%2520recovery&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 217.3 µs | N/A |
| 🆕 | [`` presentation geometry: detailed hair ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520detailed%2520hair&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 523.3 ms | N/A |
| 🆕 | [`` presentation geometry: head match close ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520head%2520match%2520close&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 522.1 ms | N/A |
| 🆕 | [`` presentation geometry: head match distant ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520head%2520match%2520distant&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 56.9 ms | N/A |
| 🆕 | [`` presentation geometry: head portrait ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520geometry%3A%2520head%2520portrait&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 1.2 s | N/A |
| 🆕 | [`` presentation adapter: 22 mixed action poses ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520adapter%3A%252022%2520mixed%2520action%2520poses&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 1.2 ms | N/A |
| 🆕 | [`` presentation adapter: 22 run poses ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520adapter%3A%252022%2520run%2520poses&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 609.7 µs | N/A |
| 🆕 | [`` presentation locomotion: 22 reusable gait poses ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?uri=src%2Fgame%2Fbenchmarks%2Fpresentation.ts%3A%3Apresentation%2520locomotion%3A%252022%2520reusable%2520gait%2520poses&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | N/A | 480.1 µs | N/A |

> [!TIP]
> Investigate this regression by commenting `@codspeedbot fix this regression` on this PR, or directly use the [CodSpeed MCP](https://codspeed.io/docs/ai/mcp?utm_source=github&utm_medium=comment-v2&utm_content=mcp_tip_regression) with your agent.

---

<sub>Comparing <code>codex/integrity-realism-graphics-20261023</code> (76f51b6) with <code>main</code> (3ff9192)</sub>

<a href="https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fintegrity-realism-graphics-20261023?utm_source=github&utm_medium=comment-v2&utm_content=button">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">
    <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">
  </picture>
</a>
