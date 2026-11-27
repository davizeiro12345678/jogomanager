import { buildArenaArchitecture } from "@/components/game/stadium/arena-architecture-builder";
import { expect, it } from "vitest";
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

it("differentiates matte concrete, brushed steel and painted fascia without new material batches", () => {
  const { meshes, materials } = buildArenaArchitecture(11, "#b22b42", true);
  const [concrete, steel, fascia] = materials;
  expect(concrete!.metalness).toBe(0);
  expect(concrete!.envMapIntensity).toBeLessThan(0.5);
  expect(steel!.metalness).toBeGreaterThanOrEqual(0.6);
  expect(steel!.roughness).toBeGreaterThan(0.4);
  expect(fascia!.metalness).toBe(0);
  expect(meshes).toHaveLength(3);
  meshes.forEach((m) => m.geometry.dispose());
  materials.forEach((m) => m.dispose());
});
