import { expect, it } from "vitest";
import { compareMatch3dEvidence } from "../../scripts/compare-match3d-evidence.mjs";

const capture = () => ({
  sha: "fixture",
  status: "captured",
  errors: [],
  assetsComplete: true,
  physicalDeviceCertification: false,
  captures: Array.from({ length: 44 }, (_, i) => ({ file: `${i}.png` })),
  videos: Array.from({ length: 6 }, (_, i) => ({
    file: `${i}.mp4`,
    phases: 12,
    timingEvidence: false,
  })),
  mobileDiagnostics: ["basic", "mid", "actual"].map((id) => ({
    label: `mobile-${id}`,
    certification: false,
    basis: "software-webgl-submissions",
    renderer: { width: 960, height: 540, contextLosses: 0 },
    fixture: { canvas: [960, 540] },
    metrics: { frames: 600 },
    peakDraws: 30,
    peakTriangles: 60000,
  })),
  matchScenes: Array.from({ length: 6 }, (_, i) => ({
    label: `match-${i}`,
    scene: { scenario: { seed: `s${i}` }, simulation: { score: [0, 0], ball: { x: 1 } } },
    certification: false,
    basis: "software-webgl-submissions",
    renderer: { width: 1280, height: 720, contextLosses: 0 },
    metrics: { frames: 600 },
    peakDraws: 40,
    peakTriangles: 80000,
  })),
});

it("keeps software samples uncertified even when measurements and fixtures pass", () => {
  expect(compareMatch3dEvidence(capture(), capture())).toMatchObject({
    violations: [],
    physicalDeviceCertification: false,
  });
});
it("rejects missing captures, changed authority, unequal resolution and over-budget scenes", () => {
  const before = capture(),
    after = capture();
  after.captures.pop();
  after.matchScenes[0]!.scene.simulation.ball.x = 2;
  after.mobileDiagnostics[0]!.renderer.width = 800;
  after.mobileDiagnostics[0]!.peakTriangles = 90001;
  const result = compareMatch3dEvidence(before, after);
  expect(result.violations).toEqual(
    expect.arrayContaining([
      "candidate: missing Studio captures",
      "match-0: authoritative state changed",
      "mobile-basic: unequal reference framebuffer",
      "mobile-basic: 90001 triangles exceed 90000",
    ]),
  );
});
it("does not conceal missing assets or context loss", () => {
  const before = capture(),
    after = capture();
  after.assetsComplete = false;
  after.mobileDiagnostics[0]!.renderer.contextLosses = 1;
  const result = compareMatch3dEvidence(before, after);
  expect(result.visualAssetsComplete).toBe(false);
  expect(result.violations).toContain("mobile-basic: lost or unrecorded WebGL context");
});
