export function compareMatch3dEvidence(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): {
  baseline: string;
  candidate: string;
  violations: string[];
  physicalDeviceCertification: false;
  visualAssetsComplete: boolean;
};
