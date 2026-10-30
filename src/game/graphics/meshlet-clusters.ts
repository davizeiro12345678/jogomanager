import * as THREE from "three";
import { MeshoptClusterizer } from "meshoptimizer";

export type Meshlet = Readonly<{
  vertices: Uint32Array;
  triangles: Uint8Array;
  center: THREE.Vector3;
  radius: number;
}>;

/**
 * Offline/WASM meshlet construction for the opt-in WebGPU path.
 * These GPU-ready vertex/triangle clusters also support the stable CPU
 * frustum fallback. GPU compute occlusion and indirect draw integration
 * are deliberately a separate release gate; this module does NOT draw.
 */
export async function buildMeshletClusters(
  geometry: THREE.BufferGeometry,
  maxVertices = 64,
  maxTriangles = 126,
): Promise<Meshlet[]> {
  if (
    !Number.isInteger(maxVertices) ||
    maxVertices < 3 ||
    maxVertices > 256 ||
    !Number.isInteger(maxTriangles) ||
    maxTriangles < 1 ||
    maxTriangles > 512
  ) throw new RangeError("Invalid meshlet vertex or triangle limit");
  const attribute = geometry.getAttribute("position");
  if (!attribute || attribute.itemSize < 3)
    throw new TypeError("Indexed triangle geometry needs xyz positions");
  const index = geometry.getIndex();
  const count = index?.count ?? attribute.count;
  if (count % 3 !== 0) throw new RangeError("Meshlets require triangle indices");
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++)
    indices[i] = index ? index.getX(i) : i;
  const positions = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    positions[i * 3] = attribute.getX(i);
    positions[i * 3 + 1] = attribute.getY(i);
    positions[i * 3 + 2] = attribute.getZ(i);
  }
  await MeshoptClusterizer.ready;
  const buffers = MeshoptClusterizer.buildMeshlets(
    indices,
    positions,
    3,
    maxVertices,
    maxTriangles,
    0.25,
  );
  const bounds = MeshoptClusterizer.computeMeshletBounds(buffers, positions, 3);
  return Array.from({ length: buffers.meshletCount }, (_, i) => {
    const extracted = MeshoptClusterizer.extractMeshlet(buffers, i);
    const bound = bounds[i]!;
    return {
      // Copy views so the original WASM output may be discarded independently.
      vertices: new Uint32Array(extracted.vertices),
      triangles: new Uint8Array(extracted.triangles),
      center: new THREE.Vector3(bound.centerX, bound.centerY, bound.centerZ),
      radius: bound.radius,
    };
  });
}

/** Frustum visibility is a conservative WebGL2 fallback. The radius accounts
 * for object scale; no occlusion or vertex removal is done on the CPU. */
export function meshletInsideFrustum(
  meshlet: Pick<Meshlet, "center" | "radius">,
  frustum: THREE.Frustum,
  transform: THREE.Matrix4,
): boolean {
  const center = meshlet.center.clone().applyMatrix4(transform);
  const radius = meshlet.radius * transform.getMaxScaleOnAxis();
  return frustum.intersectsSphere(new THREE.Sphere(center, radius));
}
