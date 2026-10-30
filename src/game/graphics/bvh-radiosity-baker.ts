import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

/**
 * Offline/worker-only diffuse vertex-light baker for static, LOCAL-space
 * triangle meshes. Do not call from useFrame or while a match is running.
 *
 * This is an approximation of diffuse radiosity with BVH visibility, not a
 * replacement for a production lightmapper: thin walls, UV seams, textured
 * albedo and arbitrary emissive meshes require a dedicated asset pipeline.
 * The output owns its geometry; the input is never changed.
 */
export interface RadiosityBakeOptions {
  /** Direction *towards* a distant light, in geometry-local coordinates. */
  lightDirection?: THREE.Vector3;
  ambient?: number;
  sunlight?: number;
  /** Average diffuse reflectance for this static mesh. */
  albedo?: THREE.ColorRepresentation;
  /** Number of cosine-weighted rays per vertex and bounce (1..32). */
  samples?: number;
  /** Number of indirect diffuse bounces (0..2). */
  bounces?: number;
  /** Maximum BVH ray length in local metres. */
  maxDistance?: number;
  /** Reject accidentally baking a full stadium on the main thread. */
  maxVertices?: number;
  /** Deterministic sampling seed. */
  seed?: number;
}

export interface RadiosityBakeResult {
  geometry: THREE.BufferGeometry;
  rays: number;
  vertices: number;
  bounces: number;
}

function unitRandom(n: number): number {
  let x = n | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function hemisphere(
  normal: THREE.Vector3,
  seed: number,
  output: THREE.Vector3,
  tangent: THREE.Vector3,
  bitangent: THREE.Vector3,
) {
  const u = unitRandom(seed);
  const v = unitRandom(seed + 0x9e3779b9);
  const r = Math.sqrt(u);
  const theta = 2 * Math.PI * v;
  tangent.set(0, Math.abs(normal.y) < 0.9 ? 1 : 0, Math.abs(normal.y) < 0.9 ? 0 : 1);
  tangent.cross(normal).normalize();
  bitangent.crossVectors(normal, tangent);
  output.copy(tangent).multiplyScalar(r * Math.cos(theta));
  output.addScaledVector(bitangent, r * Math.sin(theta));
  output.addScaledVector(normal, Math.sqrt(1 - u)).normalize();
}

export function bakeVertexRadiosityBvh(
  source: THREE.BufferGeometry,
  options: RadiosityBakeOptions = {},
): RadiosityBakeResult {
  const positions = source.getAttribute("position");
  if (!positions || positions.itemSize !== 3) throw new Error("Radiosity requires positions");
  const count = source.getIndex()?.count ?? positions.count;
  const maxVertices = options.maxVertices ?? 20000;
  if (count > maxVertices || count < 3 || count % 3 !== 0)
    throw new Error("Radiosity requires a bounded triangle mesh");
  const samples = THREE.MathUtils.clamp(Math.floor(options.samples ?? 8), 1, 32);
  const bounces = THREE.MathUtils.clamp(Math.floor(options.bounces ?? 1), 0, 2);
  const maxDistance = Math.max(0.1, options.maxDistance ?? 200);
  const light = (options.lightDirection ?? new THREE.Vector3(0.3, 1, 0.2)).clone();
  if (light.lengthSq() < 1e-8) throw new Error("Light direction must not be zero");
  light.normalize();
  const ambient = Math.max(0, options.ambient ?? 0.25);
  const sunlight = Math.max(0, options.sunlight ?? 0.75);
  const albedo = new THREE.Color(options.albedo ?? 0xaaaaaa);
  const seed = (options.seed ?? 17) | 0;

  // Unindexed geometry provides a reliable faceIndex -> three vertex mapping.
  // Keep its attributes, normals and the source geometry untouched.
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const vertices = geometry.getAttribute("position") as THREE.BufferAttribute;
  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const colors = geometry.getAttribute("color");
  const bvh = new MeshBVH(geometry);
  const n = vertices.count;
  const direct = new Float32Array(n);
  const outgoing = new Float32Array(n * 3);
  const next = new Float32Array(n * 3);
  const origin = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const ray = new THREE.Ray();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const bary = new THREE.Vector3();
  let rays = 0;

  for (let i = 0; i < n; i++) {
    origin.fromBufferAttribute(vertices, i);
    normal.fromBufferAttribute(normals, i).normalize();
    const cosine = Math.max(0, normal.dot(light));
    let visible = true;
    if (cosine > 0) {
      ray.origin.copy(origin).addScaledVector(normal, 0.002);
      ray.direction.copy(light);
      visible = !bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDistance);
      rays++;
    }
    direct[i] = ambient + (visible ? sunlight * cosine : 0);
    const index = i * 3;
    outgoing[index] = direct[i]! * albedo.r * (colors?.getX(i) ?? 1);
    outgoing[index + 1] = direct[i]! * albedo.g * (colors?.getY(i) ?? 1);
    outgoing[index + 2] = direct[i]! * albedo.b * (colors?.getZ(i) ?? 1);
  }
  for (let bounce = 0; bounce < bounces; bounce++) {
    for (let i = 0; i < n; i++) {
      origin.fromBufferAttribute(vertices, i);
      normal.fromBufferAttribute(normals, i).normalize();
      let indirectR = 0,
        indirectG = 0,
        indirectB = 0;
      for (let j = 0; j < samples; j++) {
        hemisphere(
          normal,
          seed + i * 65537 + bounce * 104729 + j * 97,
          direction,
          tangent,
          bitangent,
        );
        ray.origin.copy(origin).addScaledVector(normal, 0.002);
        ray.direction.copy(direction);
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDistance);
        rays++;
        if (!hit || hit.faceIndex == null) continue;
        const first = hit.faceIndex * 3;
        a.fromBufferAttribute(vertices, first);
        b.fromBufferAttribute(vertices, first + 1);
        c.fromBufferAttribute(vertices, first + 2);
        if (!THREE.Triangle.getBarycoord(hit.point, a, b, c, bary)) continue;
        for (let k = 0; k < 3; k++) {
          const weight = bary.getComponent(k) / samples;
          const offset = (first + k) * 3;
          indirectR += outgoing[offset]! * weight;
          indirectG += outgoing[offset + 1]! * weight;
          indirectB += outgoing[offset + 2]! * weight;
        }
      }
      const p = i * 3;
      // Outgoing radiance at each vertex is used as the incoming source for
      // the next bounce. Values are limited to prevent runaway energy.
      const ir = Math.min(4, direct[i]! + indirectR);
      const ig = Math.min(4, direct[i]! + indirectG);
      const ib = Math.min(4, direct[i]! + indirectB);
      next[p] = ir * albedo.r * (colors?.getX(i) ?? 1);
      next[p + 1] = ig * albedo.g * (colors?.getY(i) ?? 1);
      next[p + 2] = ib * albedo.b * (colors?.getZ(i) ?? 1);
    }
    outgoing.set(next);
  }

  const baked = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = i * 3;
    if (bounces) {
      // Remove the average material albedo already present in outgoing.
      // The caller should use a white material with vertexColors=true.
      baked[p] = outgoing[p]!;
      baked[p + 1] = outgoing[p + 1]!;
      baked[p + 2] = outgoing[p + 2]!;
    } else {
      baked[p] = direct[i]! * albedo.r * (colors?.getX(i) ?? 1);
      baked[p + 1] = direct[i]! * albedo.g * (colors?.getY(i) ?? 1);
      baked[p + 2] = direct[i]! * albedo.b * (colors?.getZ(i) ?? 1);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(baked, 3));
  return { geometry, rays, vertices: n, bounces };
}
