import * as THREE from "three";
import type { StadiumTierInstance } from "./stadium-tier-instances";

/** Bake immutable placements into one indexed geometry. There is no source
 * mesh hierarchy, per-placement geometry clone, or instanceMatrix in the
 * vertex shader. Positions and inverse-transpose normals are authored once;
 * UVs remain those of each original box/chair, including aisle cutouts.
 * The caller owns the returned geometry; source geometry remains untouched.
 */
export function bakeStadiumTierGeometry(
  source: THREE.BufferGeometry,
  placements: readonly StadiumTierInstance[],
): THREE.BufferGeometry {
  const position = source.getAttribute("position");
  if (!position || position.itemSize !== 3) throw new Error("Stadium tier source needs positions");
  const attributes = Object.entries(source.attributes);
  for (const [name, attribute] of attributes) {
    if (attribute.count !== position.count)
      throw new Error(`Invalid stadium tier attribute: ${name}`);
    if ((name === "normal" || name === "tangent") && attribute.itemSize < 3)
      throw new Error(`Invalid stadium tier vector: ${name}`);
  }
  for (const placement of placements) {
    if (
      ![...placement.position, ...placement.scale, placement.rotationY].every(Number.isFinite) ||
      placement.scale.some((value) => value <= 0)
    )
      throw new Error("Stadium tiers need finite placements with positive scales");
  }
  const vertices = position.count * placements.length;
  const index = source.getIndex();
  const indexCount = index?.count ?? position.count;
  const indices =
    vertices > 65535
      ? new Uint32Array(indexCount * placements.length)
      : new Uint16Array(indexCount * placements.length);
  const geometry = new THREE.BufferGeometry();
  geometry.name = "stadium-tier-baked";
  for (const [name, attribute] of attributes)
    geometry.setAttribute(
      name,
      new THREE.Float32BufferAttribute(
        new Float32Array(vertices * attribute.itemSize),
        attribute.itemSize,
      ),
    );

  const transform = new THREE.Object3D();
  const normalMatrix = new THREE.Matrix3();
  const directionMatrix = new THREE.Matrix3();
  const vector = new THREE.Vector3();
  placements.forEach((placement, placementIndex) => {
    transform.position.fromArray(placement.position);
    transform.scale.fromArray(placement.scale);
    transform.rotation.set(0, placement.rotationY, 0);
    transform.updateMatrix();
    normalMatrix.getNormalMatrix(transform.matrix);
    directionMatrix.setFromMatrix4(transform.matrix);
    const offset = placementIndex * position.count;
    for (const [name, attribute] of attributes) {
      const output = geometry.getAttribute(name) as THREE.BufferAttribute;
      for (let vertex = 0; vertex < position.count; vertex++) {
        for (let component = 0; component < attribute.itemSize; component++)
          output.setComponent(
            offset + vertex,
            component,
            attribute.getComponent(vertex, component),
          );
        if (name === "position" || name === "normal" || name === "tangent") {
          vector.fromBufferAttribute(attribute, vertex);
          if (name === "position") vector.applyMatrix4(transform.matrix);
          else vector.applyMatrix3(name === "normal" ? normalMatrix : directionMatrix).normalize();
          output.setXYZ(offset + vertex, vector.x, vector.y, vector.z);
        }
      }
    }
    for (let vertex = 0; vertex < indexCount; vertex++)
      indices[placementIndex * indexCount + vertex] = offset + (index?.getX(vertex) ?? vertex);
  });
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Three baked buckets with explicit ownership. Materials/shadow flags belong
 * to the three ordinary meshes that consume them, exactly as before. */
export function bakeStadiumTierBuckets(
  sources: {
    concrete: THREE.BufferGeometry;
    longitudinalSeats: THREE.BufferGeometry;
    endSeats: THREE.BufferGeometry;
  },
  placements: {
    concrete: readonly StadiumTierInstance[];
    longitudinalSeats: readonly StadiumTierInstance[];
    endSeats: readonly StadiumTierInstance[];
  },
) {
  const created: THREE.BufferGeometry[] = [];
  const bake = (source: THREE.BufferGeometry, plan: readonly StadiumTierInstance[]) => {
    const geometry = bakeStadiumTierGeometry(source, plan);
    created.push(geometry);
    return geometry;
  };
  try {
    const concrete = bake(sources.concrete, placements.concrete);
    const longitudinalSeats = bake(sources.longitudinalSeats, placements.longitudinalSeats);
    const endSeats = bake(sources.endSeats, placements.endSeats);
    let disposed = false;
    return {
      concrete,
      longitudinalSeats,
      endSeats,
      dispose() {
        if (disposed) return;
        disposed = true;
        created.forEach((geometry) => geometry.dispose());
      },
    };
  } catch (error) {
    created.forEach((geometry) => geometry.dispose());
    throw error;
  }
}
