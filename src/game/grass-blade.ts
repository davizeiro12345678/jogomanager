import * as THREE from "three";

/** A curved, tapered blade has six triangles instead of a shaded cone with
 * caps. Its tip bends in the existing wind shader; its base stays planted. */
export function grassBladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rows = [
    [0, 0.013, 0],
    [0.028, 0.01, 0.002],
    [0.06, 0.005, 0.009],
    [0.085, 0.0004, 0.019],
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
