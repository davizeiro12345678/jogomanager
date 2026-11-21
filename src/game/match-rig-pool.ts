import { createDormantResourcePool } from "./dormant-resource-pool";
import type { RigSkin } from "./rig-skin";
import type { PlayerMaterials } from "./player-materials";

export interface PooledMatchRig {
  skin: RigSkin;
  retainMaterials: (materials: PlayerMaterials) => void;
}
export type MatchRigPool = ReturnType<typeof createDormantResourcePool<string, PooledMatchRig>>;

/** Only inactive rigs are retained; active ownership and the drawing budget
 * stay with each PlayerRig. Two full promotion cycles bound their lifetime. */
export function createMatchRigPool(): MatchRigPool {
  return createDormantResourcePool<string, PooledMatchRig>({
    // At most six dormant hero atlases, beside the existing six/eight active
    // hero limit, keep the original 16 MiB high-quality kit cache viable.
    maxDormantEntries: 6,
    maxDormantBytes: 16 * 1024 * 1024,
    maxIdleCycles: 2,
  });
}

export function rigRetainedBytes(skin: RigSkin): number {
  const buffers = new Set<ArrayBufferLike>();
  for (const group of skin.all) {
    const geometry = group.geometry;
    const attributes = [
      ...Object.values(geometry.attributes),
      ...Object.values(geometry.morphAttributes).flat(),
      geometry.index,
    ];
    for (const attribute of attributes) {
      if (!attribute) continue;
      const array = "data" in attribute ? attribute.data.array : attribute.array;
      buffers.add(array.buffer);
    }
  }
  // Bone matrices are owned too. Texture maps remain in their existing,
  // separately bounded shared material/texture caches.
  let bytes = skin.bones.length * 3 * 16 * 8;
  for (const buffer of buffers) bytes += buffer.byteLength;
  return bytes;
}
