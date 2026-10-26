import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [mode, sourceRoot, fixturePath, outputPath] = process.argv.slice(2);
const root = path.resolve(sourceRoot);
if (mode === "fixture") {
  const { buildTeamSetup } = await import(pathToFileURL(path.join(root, "src/game/quickMatch.ts")));
  writeFileSync(
    fixturePath,
    JSON.stringify({ home: buildTeamSetup("fla"), away: buildTeamSetup("pal") }),
  );
} else if (mode === "sample") {
  const { MatchSim, MATCH_SIMULATION_STEP } = await import(
    pathToFileURL(path.join(root, "src/game/sim.ts"))
  );
  const fixture = readFileSync(fixturePath, "utf8");
  const checkpoints = [];
  let executionContract;
  for (const seed of ["bench-setup", "setup-parity-1", "setup-parity-2"]) {
    const { home, away } = JSON.parse(fixture);
    const sim = new MatchSim(home, away, seed);
    const execution = sim.executionContract();
    if (executionContract && JSON.stringify(executionContract) !== JSON.stringify(execution))
      throw new Error("Execution contract changed between deterministic fixture seeds");
    executionContract = execution;
    for (let tick = 0; tick <= 1800; tick++) {
      if (tick % 300 === 0)
        checkpoints.push({
          seed,
          tick,
          sha256: createHash("sha256").update(JSON.stringify(sim.checkpoint())).digest("hex"),
        });
      if (tick < 1800) sim.step(MATCH_SIMULATION_STEP, 6);
    }
    sim.dispose();
  }
  const { home, away } = JSON.parse(fixture);
  const warmup = 3000;
  const iterations = 1000;
  let checksum = 0;
  for (let index = 0; index < warmup; index++)
    checksum += new MatchSim(home, away, "bench-setup").players[0].heightCm;
  const samples = [];
  for (let round = 0; round < 31; round++) {
    const cpuStart = process.cpuUsage();
    const started = performance.now();
    for (let index = 0; index < iterations; index++)
      checksum += new MatchSim(home, away, "bench-setup").players[0].heightCm;
    const wallMs = (performance.now() - started) / iterations;
    const cpu = process.cpuUsage(cpuStart);
    samples.push({ wallMs, cpuMs: (cpu.user + cpu.system) / 1000 / iterations });
  }
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        root,
        environment: {
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
          kernel: os.release(),
          cpu: os.cpus()[0]?.model,
        },
        fixtureSha256: createHash("sha256").update(fixture).digest("hex"),
        executionContract,
        warmup,
        iterations,
        checksum,
        checkpoints,
        samples,
      },
      null,
      2,
    ) + "\n",
  );
} else {
  throw new Error("Expected fixture or sample mode");
}
