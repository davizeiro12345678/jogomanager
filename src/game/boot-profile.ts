/** Shared boot cross-sections: z is relative to length, x/y to boot height.
 * Ground contact and the visible mesh must use the same physical envelope. */
export const FOOTBALL_BOOT_PROFILE = [
  { z: -0.3, width: 0.25, depth: 0.19, centerDepth: 0.31 },
  { z: -0.19, width: 0.54, depth: 0.42, centerDepth: 0.26 },
  { z: 0.03, width: 0.58, depth: 0.39, centerDepth: 0.3 },
  { z: 0.29, width: 0.63, depth: 0.26, centerDepth: 0.42 },
  { z: 0.49, width: 0.56, depth: 0.2, centerDepth: 0.47 },
  { z: 0.59, width: 0.24, depth: 0.12, centerDepth: 0.49 },
  { z: 0.61, width: 0.015, depth: 0.02, centerDepth: 0.49 },
] as const;

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
