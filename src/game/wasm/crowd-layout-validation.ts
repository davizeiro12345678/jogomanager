import type { CrowdVisibilityLayout } from "./crowd-visibility";
export const CROWD_LAYOUT_LIMITS = { seats: 262144, tiles: 65536, references: 1048576 } as const;
/** Validate once before scratch allocation or crossing a Worker/WASM boundary. */
export function validCrowdLayout(value: unknown): value is CrowdVisibilityLayout {
  if (!value || typeof value !== "object") return false;
  const layout = value as CrowdVisibilityLayout;
  if (
    !(layout.positions instanceof Float64Array) ||
    !(layout.tiles instanceof Float64Array) ||
    !(layout.tileOffsets instanceof Uint32Array) ||
    !(layout.tileIndices instanceof Uint32Array)
  )
    return false;
  if (
    !Number.isInteger(layout.positionCount) ||
    layout.positionCount < 0 ||
    layout.positionCount > CROWD_LAYOUT_LIMITS.seats ||
    layout.positions.length !== layout.positionCount * 3 ||
    !Number.isInteger(layout.tileCount) ||
    layout.tileCount < 0 ||
    layout.tileCount > CROWD_LAYOUT_LIMITS.tiles ||
    layout.tiles.length !== layout.tileCount * 4 ||
    layout.tileOffsets.length !== layout.tileCount + 1 ||
    layout.tileIndices.length > CROWD_LAYOUT_LIMITS.references ||
    layout.tileOffsets[0] !== 0 ||
    layout.tileOffsets[layout.tileCount] !== layout.tileIndices.length
  )
    return false;
  for (let i = 0; i < layout.tileCount; i++) {
    if (
      layout.tileOffsets[i]! > layout.tileOffsets[i + 1]! ||
      layout.tileOffsets[i + 1]! > layout.tileIndices.length ||
      layout.tiles[i * 4 + 3]! < 0
    )
      return false;
  }
  for (const value of layout.positions) if (!Number.isFinite(value)) return false;
  for (const value of layout.tiles) if (!Number.isFinite(value)) return false;
  for (const seat of layout.tileIndices) if (seat >= layout.positionCount) return false;
  return true;
}
