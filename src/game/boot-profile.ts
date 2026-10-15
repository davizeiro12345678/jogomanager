/** Shared boot cross-sections: z is relative to length, x/y to boot height.
 * Ground contact and the visible mesh must use the same physical envelope. */
export const FOOTBALL_BOOT_PROFILE = [
  { z: -0.3, width: 0.25, depth: 0.19, centerDepth: 0.31 },
  { z: -0.19, width: 0.6, depth: 0.46, centerDepth: 0.22 },
  { z: 0.03, width: 0.67, depth: 0.46, centerDepth: 0.25 },
  { z: 0.29, width: 0.72, depth: 0.29, centerDepth: 0.4 },
  { z: 0.49, width: 0.63, depth: 0.23, centerDepth: 0.45 },
  { z: 0.59, width: 0.24, depth: 0.12, centerDepth: 0.49 },
  { z: 0.61, width: 0.015, depth: 0.02, centerDepth: 0.49 },
] as const;

/** Construction details sample the same Hermite last as the visible upper.
 * Laces placed at guessed heights either vanished inside it or floated above. */
export function bootCrossSectionAt(z: number) {
  const last = FOOTBALL_BOOT_PROFILE.length - 1;
  const next = FOOTBALL_BOOT_PROFILE.findIndex((section) => section.z >= z);
  const row = next < 0 ? last - 1 : Math.max(0, Math.min(last - 1, next - 1));
  const a = FOOTBALL_BOOT_PROFILE[row]!,
    b = FOOTBALL_BOOT_PROFILE[row + 1]!;
  const span = b.z - a.z;
  const t = Math.min(1, Math.max(0, (z - a.z) / span));
  const sample = (key: "width" | "depth" | "centerDepth") => {
    const value = (i: number) => FOOTBALL_BOOT_PROFILE[Math.min(last, Math.max(0, i))]![key];
    const tangent = (i: number): number => {
      if (i === 0)
        return (value(1) - value(0)) / (FOOTBALL_BOOT_PROFILE[1]!.z - FOOTBALL_BOOT_PROFILE[0]!.z);
      if (i === last)
        return (
          (value(last) - value(last - 1)) /
          (FOOTBALL_BOOT_PROFILE[last]!.z - FOOTBALL_BOOT_PROFILE[last - 1]!.z)
        );
      const before =
        (value(i) - value(i - 1)) / (FOOTBALL_BOOT_PROFILE[i]!.z - FOOTBALL_BOOT_PROFILE[i - 1]!.z);
      const after =
        (value(i + 1) - value(i)) / (FOOTBALL_BOOT_PROFILE[i + 1]!.z - FOOTBALL_BOOT_PROFILE[i]!.z);
      return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
    };
    return (
      (2 * t ** 3 - 3 * t ** 2 + 1) * value(row) +
      (t ** 3 - 2 * t ** 2 + t) * span * tangent(row) +
      (-2 * t ** 3 + 3 * t ** 2) * value(row + 1) +
      (t ** 3 - t ** 2) * span * tangent(row + 1)
    );
  };
  return { width: sample("width"), depth: sample("depth"), centerDepth: sample("centerDepth") };
}

// Include both the 2- and 3-subdivision render rings. Six intervals also
// bound the smooth shoulder of the sole without creating geometry per frame.
const widthAt = (index: number) => FOOTBALL_BOOT_PROFILE[index]!.width;
const tangentAt = (index: number) => {
  const last = FOOTBALL_BOOT_PROFILE.length - 1;
  const z = (i: number) => FOOTBALL_BOOT_PROFILE[i]!.z;
  if (index === 0) return (widthAt(1) - widthAt(0)) / (z(1) - z(0));
  if (index === last) return (widthAt(last) - widthAt(last - 1)) / (z(last) - z(last - 1));
  const before = (widthAt(index) - widthAt(index - 1)) / (z(index) - z(index - 1));
  const after = (widthAt(index + 1) - widthAt(index)) / (z(index + 1) - z(index));
  return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
};
export const SOLE_CONTACT_PROFILE: readonly { z: number; width: number }[] =
  FOOTBALL_BOOT_PROFILE.flatMap((a, row) => {
    const b = FOOTBALL_BOOT_PROFILE[row + 1];
    if (!b) return [{ z: a.z, width: a.width }];
    const span = b.z - a.z;
    return Array.from({ length: 6 }, (_, step) => {
      const t = step / 6;
      return {
        z: a.z + span * t,
        width:
          (2 * t * t * t - 3 * t * t + 1) * a.width +
          (t * t * t - 2 * t * t + t) * span * tangentAt(row) +
          (-2 * t * t * t + 3 * t * t) * b.width +
          (t * t * t - t * t) * span * tangentAt(row + 1),
      };
    });
  });
