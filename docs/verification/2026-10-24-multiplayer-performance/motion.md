# Athlete motion experiment

Reference: b6368e9c8254a9aa35e0798e4af4829c2abec822, PR #62.

CodSpeed WallTime profile in run `6add2174d6a14e1526843ad7` attributes 36.45% self time of `match simulation: 300 live ticks` to `advanceAthlete`. The experiment keeps position and velocity in scalar locals during each integration call, writing the final values once. It preserves the arithmetic order, physics slices and remainder policy.

`node --import tsx scripts/verify-athlete-motion-parity.mjs ../jogomanager-perf-base` passed 30,720 exact state/remainder comparisons across 256 input sequences, including wet/dry traction, mass/speed limits, fractional ticks, coarse ticks and invalid/nonpositive intervals. Five existing athlete mechanics tests also passed. No workload, seed, quality setting, dependency or release threshold changed.

This is a performance experiment, not a measured gain yet. Compare the new CodSpeed CI run with `6add2174d6a14e1526843ad7` in both Simulation and WallTime before accepting a speed claim. The previous run warns that WallTime uses a shared runner. Existing failures against main (bundles, simulation-revision checkpoints and mobile Lighthouse) remain release blockers.
