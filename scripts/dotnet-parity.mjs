import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { dotnetCoreSources, fileSha256, coreBuildInput } from "./dotnet-source-fingerprints.mjs";
import { createNativeProcess } from "./dotnet-native-process.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(process.argv.length <= 3, true, "Only an optional evidence directory is supported");
const evidence = path.resolve(
  process.argv[2] ?? path.join(root, "engine/dotnet/artifacts/contracts"),
);
await mkdir(evidence, { recursive: true });
const startingCoreSources = await dotnetCoreSources(root);
const tools = process.env.JM_DOTNET_TOOLS_DIR ?? path.resolve(root, "../../.cache/tools");
const sdk =
  process.env.JM_DOTNET_PATH ??
  (process.platform === "win32" ? path.join(tools, "dotnet/dotnet.exe") : "dotnet");
const environment = {
  ...process.env,
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  DOTNET_NOLOGO: "1",
};
if (process.env.JM_DOTNET_TOOLS_DIR || process.platform === "win32") {
  environment.DOTNET_CLI_HOME ??= path.join(tools, "dotnet-home");
  environment.NUGET_PACKAGES ??= path.join(tools, "nuget");
}
const engineDirectory = path.join(root, "engine/dotnet");
const pin = JSON.parse(await readFile(path.join(engineDirectory, "global.json"), "utf8"));
const selectedSdk = spawnSync(sdk, ["--version"], {
  cwd: engineDirectory,
  env: environment,
  encoding: "utf8",
});
assert.equal(selectedSdk.status, 0, selectedSdk.stderr || selectedSdk.error?.message);
assert.equal(selectedSdk.stdout.trim(), pin.sdk.version, "Select the exact pinned .NET SDK");
const compile = spawnSync(
  sdk,
  [
    "build",
    "JogoManager.Engine.slnx",
    "-c",
    "Release",
    "-m:1",
    "--disable-build-servers",
    "-p:UseSharedCompilation=false",
    `-p:RestoreConfigFile=${path.join(engineDirectory, "NuGet.Config")}`,
    "--nologo",
  ],
  { cwd: engineDirectory, env: environment, encoding: "utf8", timeout: 120_000 },
);
await writeFile(
  path.join(evidence, "native-build.log"),
  (compile.stdout ?? "") + (compile.stderr ?? ""),
);
assert.equal(compile.status, 0, compile.stderr || compile.error?.message || "Native build failed");
const binary = path.join(
  root,
  "engine/dotnet/tests/JogoManager.Engine.Verification/bin/Release/net10.0/JogoManager.Engine.Verification.dll",
);
const self = spawnSync(sdk, [binary, "--self-test"], {
  cwd: engineDirectory,
  env: environment,
  encoding: "utf8",
  timeout: 60_000,
});
await writeFile(path.join(evidence, "self-checks.log"), (self.stdout ?? "") + (self.stderr ?? ""));
assert.equal(self.status, 0, self.stderr || self.error?.message || "Native self checks failed");
const selfChecks = JSON.parse(self.stdout);
await writeFile(path.join(evidence, "self-checks.json"), JSON.stringify(selfChecks, null, 2));

const sourceFingerprints = {};
async function sourceModule(filename) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, filename)],
    tsconfig: path.join(root, "tsconfig.json"),
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  for (const input of Object.keys(result.metafile.inputs)) {
    const resolved = path.resolve(root, input);
    assert.ok(resolved.startsWith(root + path.sep), "Oracle dependency escaped the checkout");
    sourceFingerprints[path.relative(root, resolved).replaceAll("\\", "/")] =
      await fileSha256(resolved);
  }
  return import(
    "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
const [{ makeRng }, { evaluatePassLanesFallback }, { aiSubPick, aiMentalityTweak }] =
  await Promise.all([
    sourceModule("src/game/rng.ts"),
    sourceModule("src/game/wasm/match-perception.ts"),
    sourceModule("src/game/sim-rules.ts"),
  ]);
const requests = [],
  expected = [],
  categories = { rng: 0, perception: 0, manager: 0 };
function add(kind, input, result, category) {
  requests.push({ protocolVersion: 1, kind, input });
  expected.push(result);
  categories[category]++;
}

for (const seed of [
  "",
  "hello",
  "Flamengo × Palmeiras",
  "São Paulo",
  "𝄞⚽",
  "汉字",
  "e\u0301",
  "é",
  0,
  1,
  2147483647,
  2147483648,
  4294967295,
  -1,
  -4294967296,
  0.5,
  Number.MAX_SAFE_INTEGER,
]) {
  const rng = makeRng(seed),
    initialState = rng.state(),
    values = [],
    states = [];
  for (let i = 0; i < 4096; i++) {
    values.push(rng());
    states.push(rng.state());
  }
  add(
    "rng.sequence.v1",
    { seed, count: values.length },
    { initialState, values, states, finalState: rng.state() },
    "rng",
  );
}
for (const restoreState of [0, 1, 2147483648, 4294967295]) {
  const rng = makeRng("restore"),
    initialState = rng.state(),
    values = [],
    states = [];
  rng.restore(restoreState);
  for (let i = 0; i < 128; i++) {
    values.push(rng());
    states.push(rng.state());
  }
  add(
    "rng.sequence.v1",
    { seed: "restore", count: values.length, restoreState },
    { initialState, values, states, finalState: rng.state() },
    "rng",
  );
}
for (let fixture = 0; fixture < 64; fixture++) {
  const receivers = Array.from(
    { length: fixture % 3 ? 40 : 256 },
    (_, i) => Math.sin(i + fixture) * 22,
  );
  const defenders = Array.from(
    { length: fixture % 3 ? 44 : 256 },
    (_, i) => Math.cos(i * 3 + fixture) * 17,
  );
  const x = -fixture / 3,
    z = 2;
  add(
    "perception.pass-lanes.v1",
    { x, z, receivers, defenders },
    {
      values: [
        ...evaluatePassLanesFallback(
          x,
          z,
          Float64Array.from(receivers),
          Float64Array.from(defenders),
        ),
      ],
    },
    "perception",
  );
}
for (const distance of [0, 2.2 - 1e-10, 2.2, 2.2 + 1e-10, 100, 100.001, 1e200, Number.MAX_VALUE]) {
  const receivers = [20, 0, 0, 0, 0, 0, 0, 0],
    defenders = [10, distance, 0, -2];
  add(
    "perception.pass-lanes.v1",
    { x: 0, z: 0, receivers, defenders },
    {
      values: [
        ...evaluatePassLanesFallback(
          0,
          0,
          Float64Array.from(receivers),
          Float64Array.from(defenders),
        ),
      ],
    },
    "perception",
  );
}
const positions = ["GK", "DF", "CB", "LB", "MF", "FW", "ST", "WG", "RW", "DM", "AM"];
for (let fixture = 0; fixture < 256; fixture++) {
  const seed = `manager-parity-${fixture}`;
  const lineup = positions.map((pos, i) => ({
    id: `l${i}`,
    pid: `p${i}`,
    pos,
    stamina: (fixture * 7 + i * 13) % 101,
    injuryWeeks: fixture % 4 === 0 && i === fixture % 11 ? 2 : 0,
    sentOff: fixture % 7 === 0 && i === 3,
    yellows: i % 3,
    ovr: 65 + (i % 5),
  }));
  const bench = positions.slice(0, 9).map((pos, i) => ({
    id: `b${i}`,
    pos,
    ovr: 70 + (i % 4),
    condition: (fixture + i) % 5 === 0 ? 40 : 90,
    injuryWeeks: fixture % 6 === 0 && i === 2 ? 1 : 0,
    suspended: fixture % 8 === 0 && i === 3,
  }));
  const minute = [49, 50, 59, 60, 63, 74, 80, 120][fixture % 8],
    subsUsed = fixture % 6,
    goalDiff = (fixture % 5) - 2,
    sentOffs = fixture % 12;
  const rng = makeRng(seed);
  const substitution = aiSubPick(lineup, bench, goalDiff, minute, subsUsed, rng);
  const result = {
    substitution,
    mentality: aiMentalityTweak(goalDiff, minute, sentOffs),
    rngState: rng.state(),
    checkpoint: {
      schemaVersion: 1,
      engineVersion: "dotnet-kernels-v1",
      sourceMatchExecutionRevision: 2,
      rngAlgorithm: "ts-xorshift32-arithmetic-v1",
      rngState: rng.state(),
      decisionSequence: 1,
    },
  };
  add(
    "ai.manager.v1",
    { seed, lineup, bench, goalDiff, minute, subsUsed, sentOffs },
    result,
    "manager",
  );
  if (fixture < 32) {
    const checkpoint = structuredClone(result.checkpoint);
    const nextSubstitution = aiSubPick(lineup, bench, goalDiff, 80, 0, rng);
    add(
      "ai.manager.v1",
      { seed, lineup, bench, goalDiff, minute: 80, subsUsed: 0, sentOffs, checkpoint },
      {
        substitution: nextSubstitution,
        mentality: aiMentalityTweak(goalDiff, 80, sentOffs),
        rngState: rng.state(),
        checkpoint: { ...checkpoint, rngState: rng.state(), decisionSequence: 2 },
      },
      "manager",
    );
  }
}

assert.equal(requests.length, 381, "The complete foundation corpus must run");
assert.deepEqual(categories, { rng: 21, perception: 72, manager: 288 });
await writeFile(path.join(evidence, "fixtures.json"), JSON.stringify({ requests, expected }));
const rejectionRun = spawnSync(sdk, [binary, "--rejection-fixtures"], {
  cwd: engineDirectory,
  env: environment,
  encoding: "utf8",
  timeout: 60_000,
});
assert.equal(rejectionRun.status, 0, rejectionRun.stderr || rejectionRun.error?.message);
const rejectionFixtures = JSON.parse(rejectionRun.stdout);
assert.equal(rejectionFixtures.length, 33, "All strict JSON rejection/recovery cases must run");
const native = createNativeProcess(sdk, [binary], {
  cwd: engineDirectory,
  env: environment,
  requestTimeoutMs: 60_000,
  closeTimeoutMs: 5_000,
});
const results = [],
  timings = [],
  rejectionRecoveries = [];
let processClose;
try {
  for (let index = 0; index < requests.length; index++) {
    const started = performance.now();
    const result = await native.request(JSON.stringify(requests[index]));
    timings.push({
      index,
      kind: requests[index].kind,
      elapsedMs: performance.now() - started,
      timeoutMs: 60_000,
    });
    results.push(result);
    assert.equal(result.protocolVersion, 1);
    assert.equal(result.engineVersion, "dotnet-kernels-v1");
    assert.equal(result.sourceMatchExecutionRevision, 2);
    assert.equal(
      result.fullMatchParityVerified,
      false,
      "A reference kernel cannot grant full-engine authority",
    );
    try {
      assert.deepEqual(result.result, expected[index]);
    } catch (error) {
      await writeFile(
        path.join(evidence, "mismatch.json"),
        JSON.stringify(
          { index, request: requests[index], actual: result, expected: expected[index] },
          null,
          2,
        ),
      );
      throw error;
    }
  }
  const recoveryIndex = requests.findIndex((request) => request.input.restoreState === 0);
  assert.ok(recoveryIndex >= 0);
  for (const fixture of rejectionFixtures) {
    const rejection = await native.request(fixture.request);
    assert.deepEqual(Object.keys(rejection), ["error"], fixture.name);
    assert.ok(typeof rejection.error === "string" && rejection.error.length > 0, fixture.name);
    const recovered = await native.request(JSON.stringify(requests[recoveryIndex]));
    assert.deepEqual(
      recovered,
      results[recoveryIndex],
      `${fixture.name}: next valid request must succeed in the same process`,
    );
    rejectionRecoveries.push({ ...fixture, rejection, nextValidReplyExact: true });
  }
  processClose = await native.finish();
  assert.equal(processClose.code, 0);
  assert.equal(processClose.signal, null);
  assert.equal(processClose.replies, requests.length + rejectionFixtures.length * 2);
} catch (error) {
  await native.abort(error);
  await writeFile(
    path.join(evidence, "native-process-failure.json"),
    JSON.stringify({ error: error.message }, null, 2),
  );
  throw error;
} finally {
  await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(results));
  await writeFile(
    path.join(evidence, "native-case-timings.json"),
    JSON.stringify(timings, null, 2),
  );
  await writeFile(path.join(evidence, "native-stderr.log"), native.stderr);
  await writeFile(
    path.join(evidence, "rejection-recovery.json"),
    JSON.stringify(rejectionRecoveries, null, 2),
  );
}
await writeFile(path.join(evidence, "native-process.json"), JSON.stringify(processClose, null, 2));
assert.deepEqual(
  await dotnetCoreSources(root),
  startingCoreSources,
  "Core sources changed during the proof",
);
for (const [file, before] of Object.entries(sourceFingerprints))
  assert.equal(await fileSha256(path.join(root, file)), before, `Oracle input changed: ${file}`);
const sourceHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
assert.equal(sourceHead.status, 0, sourceHead.stderr || sourceHead.error?.message);
const receipt = {
  matched: results.length,
  categories,
  exactNumericComparison: true,
  rngValues: 17 * 4096 + 4 * 128,
  selfChecks: selfChecks.passed,
  rejectionRecoveryCases: rejectionRecoveries.length,
  processClose,
  sourceHead: sourceHead.stdout.trim(),
  nodeVersion: process.version,
  v8Version: process.versions.v8,
  dotnetSdk: selectedSdk.stdout.trim(),
  dotnetRuntime: selfChecks.runtimeVersion,
  platform: process.platform,
  sourceExecutionRevision: 2,
  packageLockSha256: await fileSha256(path.join(root, "package-lock.json")),
  sourceFingerprints: Object.fromEntries(
    Object.entries(sourceFingerprints).sort(([a], [b]) => a.localeCompare(b)),
  ),
  coreSourceFingerprints: startingCoreSources,
  harnessSha256: await fileSha256(fileURLToPath(import.meta.url)),
  processHarnessSha256: await fileSha256(path.join(root, "scripts/dotnet-native-process.mjs")),
  nativeCoreSha256: await fileSha256(coreBuildInput(root)),
  nativeVerifierSha256: await fileSha256(binary),
  functionalTimeoutMs: 60_000,
  fullMatchParityVerified: false,
  scope:
    "Exact current-checkout TypeScript/native reference kernels only. No match loop, player AI revision, season, save migration, WASM, service, production admission or performance acceptance.",
};
await writeFile(path.join(evidence, "native-parity.json"), JSON.stringify(receipt, null, 2));
console.log(
  JSON.stringify({
    matched: receipt.matched,
    categories,
    selfChecks: receipt.selfChecks,
    nativeCoreSha256: receipt.nativeCoreSha256,
    sourceHead: receipt.sourceHead,
    dotnetSdk: receipt.dotnetSdk,
    nodeVersion: receipt.nodeVersion,
    fullMatchParityVerified: false,
  }),
);
