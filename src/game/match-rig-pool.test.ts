import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMatchRigPool, rigRetainedBytes, type PooledMatchRig } from "./match-rig-pool";
import type { RigSkin } from "./rig-skin";

describe("match-owned dormant rig budget", () => {
  it("counts shared backing buffers once and includes retained garment morphs and bone matrices", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    geometry.setIndex(new THREE.Uint16BufferAttribute(new Uint16Array([0, 1, 2]), 1));
    geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(9), 3)];
    const skin = {
      all: [{ geometry }, { geometry }],
      bones: [new THREE.Bone()],
    } as unknown as RigSkin;
    expect(rigRetainedBytes(skin)).toBe(9 * 4 * 3 + 3 * 2 + 3 * 16 * 8);
    geometry.dispose();
  });
  it("retains at most six inactive atlases beside the active match roster", () => {
    const pool = createMatchRigPool();
    let disposed = 0;
    for (let index = 0; index < 9; index++) {
      const value = { skin: {}, retainMaterials() {} } as unknown as PooledMatchRig;
      pool
        .acquire(String(index), () => ({
          value,
          estimatedBytes: 100,
          dispose: () => {
            disposed++;
          },
        }))
        .release();
    }
    expect(pool.stats).toMatchObject({ dormantEntries: 6, dormantBytes: 600, activeLeases: 0 });
    expect(disposed).toBe(3);
    pool.dispose();
    expect(disposed).toBe(9);
  });
});
