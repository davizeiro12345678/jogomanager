import * as THREE from "three";

/** A curved, tapered blade has six triangles instead of a shaded cone with
 * caps. Its tip bends in the existing wind shader; its base stays planted. */
export function grassBladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rows = [
    [0, 0.0035, 0],
    [0.012, 0.0028, 0.001],
    [0.026, 0.0014, 0.003],
    [0.035, 0.00015, 0.006],
  ];
  rows.forEach(([height, width, bend], row) => {
    positions.push(-width!, height!, bend!, width!, height!, bend!);
    uvs.push(0, row / 3, 1, row / 3);
    if (row < 3) {
      const a = row * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
