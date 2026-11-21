# CodSpeed remote comparison for source 0a6a04e581571a367cc1c742ead21f984abbbc1b

Source: GitHub PR #128 CodSpeed bot comment, workflow run 42543242353. These are simulation-instrument results, not physical-device FPS. Four benchmarks have a system-call warning.

<!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ -->
## Merging this PR will regress 2 benchmarks

<details>
<summary><b>1 warning</b></summary>

> :warning: **4 benchmarks are dominated by system calls**
>
> System calls cannot be simulated consistently and are left out of the measure. The reported value understates the real cost. Switch to the Walltime instrument to measure them.
>
> [Learn more about system calls](https://codspeed.io/docs/instruments/cpu)
>
> [See affected benchmarks](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?q=has%3Asignificant_sys_time&utm_source=github&utm_medium=comment-v2&utm_content=affected_benchmarks)

</details>


`⚡ 6` improved benchmarks  
`❌ 2` regressed benchmarks  
`✅ 8` untouched benchmarks  


> [!WARNING]
> Please fix the performance issues or [acknowledge them on CodSpeed](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?q=is%3Aregression&utm_source=github&utm_medium=comment-v2&utm_content=acknowledge).

### Performance Changes

|     | Benchmark | `BASE` | `HEAD` | Efficiency |
| --- | --------- | ------ | ------ | ---------- |
| ❌ | [`` live match: snapshotMatch ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Alive%2520match%3A%2520snapshotMatch&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 968.9 µs | 1,065.8 µs | -9.09% |
| ❌ | [`` match setup: new MatchSim ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Fmatch.ts%3A%3Amatch%2520setup%3A%2520new%2520MatchSim&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 4.9 ms | 5.1 ms | -5.05% |
| ⚡ | [`` season: generateFixtures ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Aseason%3A%2520generateFixtures&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 665.6 µs | 319.7 µs | ×2.1 |
| ⚡ | [`` rig geometry: Rust/WASM 64 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252064%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1,378.9 µs | 757.9 µs | +81.95% |
| ⚡ | [`` rig geometry: Rust/WASM 16 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520Rust%2FWASM%252016%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 403 µs | 255.8 µs | +57.56% |
| ⚡ | [`` rig geometry: fallback 64 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520fallback%252064%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1.9 ms | 1.4 ms | +37.91% |
| ⚡ | [`` rig geometry: fallback 16 radial ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Frig.ts%3A%3Arig%2520geometry%3A%2520fallback%252016%2520radial&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 608.4 µs | 475.3 µs | +28.02% |
| ⚡ | [`` season: tableFromFixtures ``](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108?uri=src%2Fgame%2Fbenchmarks%2Fseason.ts%3A%3Aseason%3A%2520tableFromFixtures&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 2.4 ms | 2.4 ms | +2.41% |

> [!TIP]
> Investigate this regression by commenting `@codspeedbot fix this regression` on this PR, or directly use the [CodSpeed MCP](https://codspeed.io/docs/ai/mcp) with your agent.

---

<sub>Comparing <code>codex/massive-quality-20261108</code> (0a6a04e) with <code>main</code> (c20036f)</sub>

<a href="https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">
    <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">
  </picture>
</a>


