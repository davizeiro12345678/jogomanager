import { expect, it } from "vitest";
import { buildArenaArchitecture } from "./ArenaArchitecture";
it("keeps roof braces, concourse portals and railings within three material draws", () => {
  for (const rings of [4, 11, 16]) {
    const data = buildArenaArchitecture(rings, "#b22b42", true);
    expect(data.meshes).toHaveLength(3);
    let triangles = 0;
    for (const mesh of data.meshes) {
      triangles += mesh.geometry.index!.count / 3;
      expect(Array.from(mesh.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(
        true,
      );
      mesh.geometry.dispose();
    }
    // Includes the existing stairs and handrails, even beyond the 13-row
    // cinema preset. This bounds the entire architectural batch, not just
    // the new roof and circulation detail.
    expect(triangles).toBeLessThan(10_000);
    data.materials.forEach((material) => material.dispose());
  }
});
