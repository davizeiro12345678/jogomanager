// ============================================================================
//  rig-geometry.ts
//  Construção de malha mesclada por junta para o rig dos jogadores.
//
//  O rig procedural desenhava cada volume (músculo, manga, caneleira, cadarço,
//  travas…) como uma malha própria. Um único atleta chegava a ~117 meshes, e
//  cada malha é um draw call: com 6 heróis em campo, só de jogadores eram ~700
//  desenhos — o triplo do orçamento do perfil Alto (260).
//
//  A correção é mesclar as malhas que compartilham a MESMA transformação rígida
//  (a mesma junta) e o MESMO material. A aparência não muda: as geometrias são
//  cozidas no espaço da junta uma única vez, e a junta continua girando igual.
//  Um atleta sai de ~117 para ~45 malhas em LOD 0 (e ~30 nas LODs distantes,
//  onde os detalhes finos ficam ocultos).
//
//  Nada aqui depende de WebGL: os testes constroem geometria três em Node.
// ============================================================================

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Transformação local de uma peça dentro da junta. */
export interface RigTransform {
  position?: readonly [number, number, number];
  /** rotação em radianos, ordem XYZ */
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number] | number;
}

/** Uma peça do rig: geometria + material + matriz local na junta. */
export interface RigPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: THREE.Matrix4;
  castShadow: boolean;
}

/** Resultado do merge: uma malha por (material, sombra). */
export interface RigMesh {
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
}

const scratch = new THREE.Object3D();

/** Monta uma peça pronta para o merge. */
export function rigPart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transform?: RigTransform,
  castShadow = false,
): RigPart {
  scratch.position.fromArray(transform?.position ?? [0, 0, 0]);
  scratch.rotation.set(...(transform?.rotation ?? [0, 0, 0]));
  if (typeof transform?.scale === "number") scratch.scale.setScalar(transform.scale);
  else scratch.scale.fromArray(transform?.scale ?? [1, 1, 1]);
  scratch.updateMatrix();
  return { geometry, material, matrix: scratch.matrix.clone(), castShadow };
}

/**
 * Agrupa peças por (material, sombra), cozinha as transformações e mescla.
 * Se o merge falhar (atributos incompatíveis), devolve as peças individuais —
 * a silhueta nunca desaparece por causa de uma otimização.
 */
export function mergeRigParts(parts: RigPart[]): RigMesh[] {
  if (parts.length === 0) return [];
  const groups = new Map<string, RigPart[]>();
  for (const part of parts) {
    const key = `${part.material.uuid}|${part.castShadow ? 1 : 0}`;
    const list = groups.get(key);
    if (list) list.push(part);
    else groups.set(key, [part]);
  }

  const meshes: RigMesh[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0]!;
      const geometry = only.geometry.clone();
      geometry.applyMatrix4(only.matrix);
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      meshes.push({ material: only.material, geometry, castShadow: only.castShadow });
      continue;
    }
    const baked: THREE.BufferGeometry[] = [];
    for (const part of group) {
      const geometry = part.geometry.clone();
      geometry.applyMatrix4(part.matrix);
      baked.push(geometry);
    }
    const merged = mergeGeometries(baked, false);
    for (const geometry of baked) geometry.dispose();
    if (!merged) {
      // caminho seguro: mantém cada peça como malha própria
      for (const part of group) {
        const geometry = part.geometry.clone();
        geometry.applyMatrix4(part.matrix);
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        meshes.push({ material: part.material, geometry, castShadow: part.castShadow });
      }
      continue;
    }
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    meshes.push({
      material: group[0]!.material,
      geometry: merged,
      castShadow: group[0]!.castShadow,
    });
  }
  for (const part of parts) part.geometry.dispose();
  return meshes;
}

/** Smooth elliptical rings: waist, ribcage and shoulders have distinct widths.
 * Closed caps and UVs keep this compatible with the existing kit materials. */
export function anatomicalSection(
  rings: readonly { y: number; width: number; depth: number; centerDepth?: number }[],
  radial = 12,
  roundness = 1,
  caps = true,
): THREE.BufferGeometry {
  // Shape-preserving Hermite tangents avoid a bulge/ledge at every landmark.
  const sampled: { y: number; width: number; depth: number; centerDepth?: number }[] = [];
  const subdivisions = radial >= 12 ? 3 : 2;
  for (let row = 0; row < rings.length - 1; row++) {
    const a = rings[row]!;
    const b = rings[row + 1]!;
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions;
      const sample = (key: "width" | "depth" | "centerDepth") => {
        const value = (i: number) => rings[Math.max(0, Math.min(rings.length - 1, i))]![key] ?? 0;
        const tangent = (i: number) => {
          if (i === 0) return (value(1) - value(0)) / (rings[1]!.y - rings[0]!.y);
          if (i === rings.length - 1)
            return (value(i) - value(i - 1)) / (rings[i]!.y - rings[i - 1]!.y);
          const before = (value(i) - value(i - 1)) / (rings[i]!.y - rings[i - 1]!.y);
          const after = (value(i + 1) - value(i)) / (rings[i + 1]!.y - rings[i]!.y);
          return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
        };
        const span = b.y - a.y;
        return (
          (2 * t * t * t - 3 * t * t + 1) * value(row) +
          (t * t * t - 2 * t * t + t) * span * tangent(row) +
          (-2 * t * t * t + 3 * t * t) * value(row + 1) +
          (t * t * t - t * t) * span * tangent(row + 1)
        );
      };
      sampled.push({
        y: a.y + (b.y - a.y) * t,
        width: sample("width"),
        depth: sample("depth"),
        centerDepth: sample("centerDepth"),
      });
    }
  }
  sampled.push(rings[rings.length - 1]!);
  rings = sampled;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bottom = rings[0]!.y;
  const span = Math.max(0.001, rings[rings.length - 1]!.y - bottom);
  for (const ring of rings) {
    for (let side = 0; side <= radial; side++) {
      const u = side / radial;
      const angle = u * Math.PI * 2;
      const sine = Math.sin(angle),
        cosine = Math.cos(angle);
      positions.push(
        Math.sign(sine) * Math.abs(sine) ** roundness * ring.width,
        ring.y,
        Math.sign(cosine) * Math.abs(cosine) ** roundness * ring.depth + (ring.centerDepth ?? 0),
      );
      uvs.push(u, (ring.y - bottom) / span);
    }
  }
  for (let row = 0; row < rings.length - 1; row++) {
    for (let side = 0; side < radial; side++) {
      const a = row * (radial + 1) + side;
      const b = a + radial + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  for (const [row, reverse] of caps
    ? ([
        [0, true],
        [rings.length - 1, false],
      ] as const)
    : []) {
    const ring = rings[row]!;
    const center = positions.length / 3;
    positions.push(0, ring.y, ring.centerDepth ?? 0);
    uvs.push(0.5, reverse ? 0 : 1);
    for (let side = 0; side < radial; side++) {
      const a = row * (radial + 1) + side;
      indices.push(center, reverse ? a + 1 : a, reverse ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The UV seam duplicates a vertex. Its two normals must still agree.
  const normals = geometry.getAttribute("normal");
  const seam = new THREE.Vector3();
  for (let row = 0; row < rings.length; row++) {
    const a = row * (radial + 1);
    const b = a + radial;
    seam
      .set(
        normals.getX(a) + normals.getX(b),
        normals.getY(a) + normals.getY(b),
        normals.getZ(a) + normals.getZ(b),
      )
      .normalize();
    normals.setXYZ(a, seam.x, seam.y, seam.z);
    normals.setXYZ(b, seam.x, seam.y, seam.z);
  }
  return geometry;
}

/** Millimetre-scale folds baked once into cloth, with zero per-frame work. */
export function clothSurface(geometry: THREE.BufferGeometry, amplitude = 0.002) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const fold =
      Math.sin(u * Math.PI * 12 + v * 11) * Math.sin(v * Math.PI) +
      0.35 * Math.sin(v * 39 + u * 8) * (1 - v) ** 2;
    const x = position.getX(i),
      z = position.getZ(i),
      length = Math.hypot(x, z);
    if (length > 0.001)
      position.setXYZ(
        i,
        x + (x / length) * fold * amplitude,
        position.getY(i),
        z + (z / length) * fold * amplitude,
      );
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A continuous last with a fitted heel, instep and flattened toe box. */
export function footballBoot(length: number, height: number, radial = 12, sole = false) {
  const geometry = anatomicalSection(
    [
      { y: -length * 0.3, width: height * 0.25, depth: height * 0.19, centerDepth: height * 0.31 },
      { y: -length * 0.19, width: height * 0.54, depth: height * 0.42, centerDepth: height * 0.26 },
      { y: length * 0.03, width: height * 0.58, depth: height * 0.39, centerDepth: height * 0.3 },
      { y: length * 0.29, width: height * 0.63, depth: height * 0.26, centerDepth: height * 0.42 },
      { y: length * 0.49, width: height * 0.56, depth: height * 0.2, centerDepth: height * 0.47 },
      { y: length * 0.59, width: height * 0.24, depth: height * 0.12, centerDepth: height * 0.49 },
      { y: length * 0.61, width: height * 0.015, depth: height * 0.02, centerDepth: height * 0.49 },
    ].map((r) => (sole ? { ...r, depth: height * 0.045, centerDepth: height * 0.64 } : r)),
    radial,
  );
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** Scalp follows the forehead, temples and nape instead of a uniform cap
 * that descends over the eyes. Same geometry is used in both player LODs. */
export function scalpGeometry(radius: number, radial = 14, rows = 10) {
  const geometry = new THREE.SphereGeometry(radius, radial, rows, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) {
    const angle = uv.getX(index) * Math.PI * 2;
    const theta = (1 - uv.getY(index)) * Math.PI * (0.48 - 0.13 * Math.sin(angle));
    positions.setXYZ(
      index,
      -radius * Math.cos(angle) * Math.sin(theta),
      radius * Math.cos(theta),
      radius * Math.sin(angle) * Math.sin(theta),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

export type LimbProfile = "upperArm" | "forearm" | "thigh" | "calf";

/** Shared tapered anatomy for both skinned and instanced players. The pivot
 * is at the proximal joint and the segment extends down to -length.
 * Skinned ends share blended rings. Rigid instances need rounded, overlapping
 * ends so bending two independent segments cannot expose a hole at the joint. */
export function anatomicalLimb(
  kind: LimbProfile,
  length: number,
  radius: number,
  radial = 12,
  rigidEnds = false,
) {
  const profiles: Record<LimbProfile, readonly [number, number, number][]> = {
    upperArm: [
      [0, 1.05, 0.96],
      [0.24, 1.1, 1.02],
      [0.55, 0.98, 1.06],
      [0.84, 0.79, 0.82],
      [1, 0.75, 0.78],
    ],
    forearm: [
      [0, 0.75, 0.78],
      [0.2, 0.91, 0.87],
      [0.46, 0.84, 0.8],
      [0.8, 0.61, 0.65],
      [1, 0.53, 0.61],
    ],
    thigh: [
      [0, 1.18, 1.12],
      [0.24, 1.22, 1.16],
      [0.52, 1.08, 1.13],
      [0.85, 0.82, 0.87],
      [1, 0.75, 0.8],
    ],
    calf: [
      [0, 0.75, 0.8],
      [0.22, 0.84, 0.94],
      [0.4, 0.86, 1.02],
      [0.74, 0.56, 0.63],
      [1, 0.41, 0.5],
    ],
  };
  const profile = profiles[kind];
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  // Upper segments already meet the clothed pelvis/shoulder. Only the lower
  // segment needs a proximal overlap; extending the thigh above its pivot
  // would expose skin through the top of the shorts.
  const proximalCap = kind === "forearm" || kind === "calf";
  const rings = rigidEnds
    ? [
        ...(proximalCap
          ? [
              [-0.12, first[1] * 0.04, first[2] * 0.04],
              [-0.08, first[1] * 0.62, first[2] * 0.62],
            ]
          : []),
        ...profile,
        [1.08, last[1] * 0.62, last[2] * 0.62],
        [1.12, last[1] * 0.04, last[2] * 0.04],
      ]
    : profile;
  const geometry = anatomicalSection(
    rings.map(([u, w, d]) => ({ y: -length * u, width: radius * w, depth: radius * d })).reverse(),
    radial,
    1,
    rigidEnds,
  );
  if (rigidEnds) return geometry;
  // Matching ellipse, weights and radial normals on both sides of a joint.
  const normals = geometry.getAttribute("normal");
  const rows = geometry.getAttribute("position").count / (radial + 1);
  for (const row of [0, rows - 1])
    for (let side = 0; side <= radial; side++) {
      const i = row * (radial + 1) + side;
      const n = new THREE.Vector3(normals.getX(i), 0, normals.getZ(i)).normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
  return geometry;
}

/** Libera as geometrias criadas pelo merge (materiais são compartilhados). */
export function disposeRigMeshes(meshes: RigMesh[]): void {
  for (const mesh of meshes) mesh.geometry.dispose();
}

/** Conta malhas de um rig mesclado (usado em teste de orçamento). */
export function countRigMeshes(meshes: RigMesh[]): number {
  return meshes.length;
}
