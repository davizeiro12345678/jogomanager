import { readFile, writeFile, access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

/** Compare real captures; software cadence cannot grant physical certification. */
export function compareMatch3dEvidence(before, after) {
  const violations = [];
  const check = (condition, reason) => {
    if (!condition) violations.push(reason);
  };
  for (const [label, report] of [
    ["baseline", before],
    ["candidate", after],
  ]) {
    check(report.status?.startsWith("captured"), `${label}: capture did not complete`);
    check(report.errors?.length === 0, `${label}: runtime errors or missing error record`);
    check(report.captures?.length === 44, `${label}: missing Studio captures`);
    check(
      report.videos?.length === 6 &&
        report.videos.every((video) => video.phases === 12 && video.timingEvidence === false),
      `${label}: missing sampled action evidence`,
    );
    check(report.mobileDiagnostics?.length === 3, `${label}: missing mobile diagnostics`);
    check(report.matchScenes?.length === 6, `${label}: missing match scenarios`);
    check(report.physicalDeviceCertification === false, `${label}: invalid physical-device claim`);
  }
  for (const key of ["captures", "videos"]) {
    check(
      JSON.stringify(
        before[key]?.map(({ file, ...rest }) =>
          key === "captures"
            ? {
                file,
                seed: rest.seed,
                clip: rest.clip,
                angle: rest.angle,
                framing: rest.framing,
                progress: rest.progress,
              }
            : { file, clip: rest.clip, phases: rest.phases },
        ),
      ) ===
        JSON.stringify(
          after[key]?.map(({ file, ...rest }) =>
            key === "captures"
              ? {
                  file,
                  seed: rest.seed,
                  clip: rest.clip,
                  angle: rest.angle,
                  framing: rest.framing,
                  progress: rest.progress,
                }
              : { file, clip: rest.clip, phases: rest.phases },
          ),
        ),
      `${key}: fixture mismatch`,
    );
  }
  for (const key of ["mobileDiagnostics", "matchScenes"]) {
    for (const candidate of after[key] ?? []) {
      const baseline = before[key]?.find((item) => item.label === candidate.label);
      check(Boolean(baseline), `${candidate.label}: missing baseline`);
      if (!baseline) continue;
      for (const record of [baseline, candidate]) {
        check(
          record.certification === false && record.basis === "software-webgl-submissions",
          `${record.label}: invalid timing basis`,
        );
        check(
          record.renderer?.contextLosses === 0,
          `${record.label}: lost or unrecorded WebGL context`,
        );
        check(
          record.metrics?.frames > 0 && record.peakDraws > 0 && record.peakTriangles > 0,
          `${record.label}: missing measurements`,
        );
      }
      if (candidate.scene) {
        check(
          JSON.stringify(candidate.scene.scenario) === JSON.stringify(baseline.scene?.scenario),
          `${candidate.label}: different scenario`,
        );
        check(
          JSON.stringify(candidate.scene.simulation) === JSON.stringify(baseline.scene?.simulation),
          `${candidate.label}: authoritative state changed`,
        );
      }
      const reference = candidate.fixture?.canvas || candidate.config?.canvas;
      if (reference) {
        for (const record of [baseline, candidate])
          check(
            record.renderer?.width === reference[0] && record.renderer?.height === reference[1],
            `${candidate.label}: unequal reference framebuffer`,
          );
        const studio = key === "mobileDiagnostics",
          basic = candidate.label.includes("basic");
        const draws = studio ? (basic ? 40 : 50) : basic ? 75 : 110;
        const triangles = studio ? (basic ? 90000 : 140000) : basic ? 130000 : 260000;
        check(
          candidate.peakDraws <= draws,
          `${candidate.label}: ${candidate.peakDraws} draws exceed ${draws}`,
        );
        check(
          candidate.peakTriangles <= triangles,
          `${candidate.label}: ${candidate.peakTriangles} triangles exceed ${triangles}`,
        );
      }
    }
  }
  return {
    baseline: before.sha,
    candidate: after.sha,
    violations,
    physicalDeviceCertification: false,
    visualAssetsComplete: Boolean(before.assetsComplete && after.assetsComplete),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [beforePath, afterPath, outputPath] = process.argv.slice(2);
  if (!beforePath || !afterPath || !outputPath)
    throw new Error("Expected baseline, candidate and output JSON paths");
  const reports = await Promise.all(
    [beforePath, afterPath].map(async (filename) => {
      const report = JSON.parse(await readFile(filename, "utf8"));
      for (const item of [...report.captures, ...report.videos, ...report.matchScenes])
        await access(path.resolve(path.dirname(filename), item.file));
      return report;
    }),
  );
  const comparison = compareMatch3dEvidence(...reports);
  await writeFile(outputPath, JSON.stringify(comparison, null, 2) + "\n");
  console.log(JSON.stringify(comparison));
  if (comparison.violations.length) process.exitCode = 1;
}
