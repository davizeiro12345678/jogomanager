const ORDER = ["baseline", "candidate", "candidate", "baseline"];
const CHECKPOINTS = ["bench-setup", "setup-parity-1", "setup-parity-2"].flatMap((seed) =>
  Array.from({ length: 7 }, (_, index) => ({ seed, tick: index * 300 })),
);
function validContract(value) {
  return (
    value &&
    [1, 2, 3].includes(value.revision) &&
    ["compat", "rapier"].includes(value.physics) &&
    ["compat", "wasm"].includes(value.perception)
  );
}

/** Physics revision changes intentionally reject old live checkpoints. Require
 * exact independent replays within each revision and equality across revisions
 * only when their execution contract declares that they are compatible. */
export function assessSetupParity(reports) {
  const violations = [];
  if (JSON.stringify(reports.map((report) => report.revision)) !== JSON.stringify(ORDER))
    violations.push("Expected four complete samples in ABBA order");
  const first = reports[0];
  for (const report of reports) {
    if (
      !report.environment ||
      ["node", "platform", "architecture", "kernel", "cpu"].some(
        (field) => typeof report.environment[field] !== "string" || !report.environment[field],
      )
    )
      violations.push(`${report.revision}: missing runtime metadata`);
    if (JSON.stringify(report.environment) !== JSON.stringify(first?.environment))
      violations.push("Runtime or CPU changed between samples");
    if (
      !/^[a-f0-9]{64}$/.test(report.fixtureSha256) ||
      report.fixtureSha256 !== first?.fixtureSha256
    )
      violations.push("Team fixture changed between samples");
    if (!validContract(report.executionContract))
      violations.push(`${report.revision}: missing or unsupported execution contract`);
    if (
      !Array.isArray(report.checkpoints) ||
      report.checkpoints.length !== 21 ||
      report.checkpoints.some(
        (checkpoint, index) =>
          checkpoint.seed !== CHECKPOINTS[index].seed ||
          checkpoint.tick !== CHECKPOINTS[index].tick ||
          !/^[a-f0-9]{64}$/.test(checkpoint.sha256),
      )
    )
      violations.push(`${report.revision}: missing deterministic checkpoints`);
  }
  const groups = Object.fromEntries(
    ORDER.map((revision) => [revision, reports.filter((report) => report.revision === revision)]),
  );
  for (const [revision, samples] of Object.entries(groups)) {
    if (samples.length !== 2) {
      violations.push(`${revision}: two independent samples are required`);
      continue;
    }
    if (
      JSON.stringify(samples[0].executionContract) !== JSON.stringify(samples[1].executionContract)
    )
      violations.push(`${revision}: execution contract changed within the run`);
    if (JSON.stringify(samples[0].checkpoints) !== JSON.stringify(samples[1].checkpoints))
      violations.push(`${revision}: independent deterministic checkpoints differ`);
  }
  const baseline = groups.baseline?.[0];
  const candidate = groups.candidate?.[0];
  const before = baseline?.executionContract;
  const after = candidate?.executionContract;
  const sameRevision = before?.revision === after?.revision;
  if (validContract(before) && validContract(after)) {
    if (before.physics !== after.physics || before.perception !== after.perception)
      violations.push("Physics or perception backend changed between measurements");
    if (!sameRevision && after.revision !== before.revision + 1)
      violations.push("Unexpected execution revision transition");
    if (
      sameRevision &&
      JSON.stringify(baseline.checkpoints) !== JSON.stringify(candidate.checkpoints)
    )
      violations.push("Same-revision deterministic checkpoints differ across revisions");
  }
  return {
    baselineExecution: before ?? null,
    candidateExecution: after ?? null,
    crossRevisionEqualityRequired: sameRevision,
    checkpointPolicy:
      "exact independent replays within each revision; cross-revision equality for the same execution revision; explicit adjacent revision boundary otherwise",
    violations,
  };
}
