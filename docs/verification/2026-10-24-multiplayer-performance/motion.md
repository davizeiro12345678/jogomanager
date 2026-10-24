# Athlete motion experiment

Reference: b6368e9c8254a9aa35e0798e4af4829c2abec822, PR #62.

CodSpeed WallTime profile in run `6add2174d6a14e1526843ad7` attributes 36.45% self time of `match simulation: 300 live ticks` to `advanceAthlete`. The experiment keeps position and velocity in scalar locals during each integration call, writing the final values once. It preserves the arithmetic order, physics slices and remainder policy.

`node --import tsx scripts/verify-athlete-motion-parity.mjs ../jogomanager-perf-base` passed 30,720 exact state/remainder comparisons across 256 input sequences, including wet/dry traction, mass/speed limits, fractional ticks, coarse ticks and invalid/nonpositive intervals. Five existing athlete mechanics tests also passed. No workload, seed, quality setting, dependency or release threshold changed.

This is a performance experiment, not a measured gain yet. Compare the new CodSpeed CI run with `6add2174d6a14e1526843ad7` in both Simulation and WallTime before accepting a speed claim. The previous run warns that WallTime uses a shared runner. Existing failures against main (bundles, simulation-revision checkpoints and mobile Lighthouse) remain release blockers.

## First measured result and next experiment

CodSpeed run `6add3bc2ab287825ce854d91` measured the standard `300 live ticks` WallTime minimum at 5.658291 ms, versus 5.823380 ms in the reference run: 2.83% less duration / 2.92% higher speed. Median: 6.093173 -> 5.941060 ms; 64 rounds per run. This is a small observed change, not a massive or physical-device improvement. Many unrelated benchmarks also moved; paired-job CPU hardware changed (EPYC 7763 -> EPYC 9V74), so cross-run gains for those affected measurements are confounded. Do not attribute the report's 62 improvements to this source change.

[CodSpeed comparison](https://app.codspeed.io/davizeiro12345678/jogomanager/runs/compare/6add2174d6a14e1526843ad7..6add3bc2ab287825ce854d91)

The second experiment moves tick-local urgency and movement-context closures into a module function and a class method. The same profile attributes 4.93% self time to `__name` invoked from `moveOffBall`; reducing function recreation targets that overhead while preserving lazy side-context evaluation. After both experiments, all 30,720 body/remainder states, 36,000 paired ticks and 372 full checkpoints still match b6368e9. Affected mechanics/realism tests: 37 tests / 3 files passed. The second performance result is still pending; the main-comparison gates remain mandatory.
