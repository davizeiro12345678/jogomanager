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
  if ((material as THREE.MeshStandardMaterial).vertexColors && !geometry.hasAttribute("color"))
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        new Float32Array(geometry.getAttribute("position").count * 3).fill(1),
        3,
      ),
    );
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
  caps: boolean | "bottom" | "top" = true,
  subdivisions = radial >= 12 ? 3 : 2,
): THREE.BufferGeometry {
  // Shape-preserving Hermite tangents avoid a bulge/ledge at every landmark.
  const sampled: { y: number; width: number; depth: number; centerDepth?: number }[] = [];
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
  const capRows: readonly (readonly [number, boolean])[] =
    caps === true
      ? [
          [0, true],
          [rings.length - 1, false],
        ]
      : caps === "bottom"
        ? [[0, true]]
        : caps === "top"
          ? [[rings.length - 1, false]]
          : [];
  for (const [row, reverse] of capRows) {
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

/** Sternomastoid contours and a small larynx live on the neck surface itself. */
export function neckSurface(geometry: THREE.BufferGeometry, radius: number, length: number) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / radius,
      y = position.getY(i) / length;
    const z = position.getZ(i);
    if (z <= 0) continue;
    const envelope = Math.sin(Math.min(1, Math.max(0, y / 1.25)) * Math.PI);
    const tendon = Math.exp(-(((Math.abs(x) - 0.33 - y * 0.3) / 0.18) ** 2));
    const larynx = Math.exp(-((x / 0.32) ** 2) - ((y - 0.6) / 0.17) ** 2);
    position.setZ(i, z + radius * envelope * (tendon * 0.035 + larynx * 0.065));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Thenar volume and dorsal tendons refine the palm without changing knuckle pivots. */
export function palmSurface(geometry: THREE.BufferGeometry, radius: number, side: number) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / radius,
      y = position.getY(i) / radius,
      z = position.getZ(i);
    const envelope = Math.sin(Math.min(1, Math.max(0, (y + 1.5) / 1.58)) * Math.PI);
    const thenar = Math.exp(-(((x * side + 0.38) / 0.32) ** 2) - ((y + 0.65) / 0.45) ** 2);
    const tendon =
      (0.5 + Math.cos((x * Math.PI) / 0.36) * 0.5) * Math.exp(-(((y + 0.85) / 0.48) ** 2));
    position.setZ(i, z + radius * envelope * (z > 0 ? thenar * 0.06 : -tendon * 0.025));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Millimetre-scale folds baked once into cloth, with zero per-frame work. */
export function clothSurface(geometry: THREE.BufferGeometry, amplitude = 0.002) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const angle = u * Math.PI * 2;
    const fold =
      Math.sin(angle * 6 + v * 11) * Math.sin(v * Math.PI) * 0.45 +
      Math.sin(v * 39 + Math.cos(angle) * 8) * (1 - v) ** 2 * 0.55 +
      Math.sin(angle * 8) * Math.sin(v * Math.PI) ** 2 * 0.18 +
      // Diagonal tension from the shoulder and compressed fabric at the hem.
      Math.sin(angle * 5 - v * 17) * Math.exp(-(((v - 0.78) / 0.18) ** 2)) * 0.3 +
      Math.sin(angle * 3 + v * 23) * Math.exp(-(((v - 0.12) / 0.12) ** 2)) * 0.32;
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

/** Pectorals and shoulder blades shape the jersey itself; they never add
 * separate muscle meshes or move the neck/waist attachment landmarks. */
export function athleticTorsoSurface(
  geometry: THREE.BufferGeometry,
  width: number,
  height: number,
) {
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / width;
    const y = (positions.getY(i) + height * 0.04) / height;
    const z = positions.getZ(i);
    const envelope = Math.sin(THREE.MathUtils.clamp(y, 0, 1) * Math.PI) ** 2;
    const pectoral = Math.exp(-(((Math.abs(x) - 0.46) / 0.31) ** 2) - ((y - 0.69) / 0.17) ** 2);
    const sternum = Math.exp(-((x / 0.12) ** 2) - ((y - 0.7) / 0.22) ** 2);
    const scapula = Math.exp(-(((Math.abs(x) - 0.48) / 0.3) ** 2) - ((y - 0.72) / 0.2) ** 2);
    const clavicle = Math.exp(-(((Math.abs(x) - 0.4) / 0.38) ** 2) - ((y - 0.88) / 0.065) ** 2);
    const oblique = Math.exp(-(((Math.abs(x) - 0.7) / 0.21) ** 2) - ((y - 0.37) / 0.23) ** 2);
    const lat = Math.exp(-(((Math.abs(x) - 0.72) / 0.24) ** 2) - ((y - 0.56) / 0.23) ** 2);
    const deltoid = Math.exp(-(((Math.abs(x) - 0.93) / 0.2) ** 2) - ((y - 0.8) / 0.12) ** 2);
    // Shoulder cap and latissimus meet the ribcage as continuous surfaces.
    // The player's deterministic proportions and all bind pivots are retained.
    positions.setX(
      i,
      positions.getX(i) + Math.sign(x) * width * envelope * (deltoid * 0.027 + lat * 0.016),
    );
    positions.setZ(
      i,
      z +
        width *
          envelope *
          (z > 0
            ? pectoral * 0.045 + clavicle * 0.018 - sternum * 0.012 - oblique * 0.012
            : -scapula * 0.035 - lat * 0.012),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Tapered phalanges with a soft fingertip and articulated knuckle rings. */
export function anatomicalFinger(radius: number, length: number) {
  return anatomicalSection(
    [
      { y: -length * 0.5 - radius * 0.7, width: radius * 0.15, depth: radius * 0.18 },
      { y: -length * 0.5, width: radius * 0.82, depth: radius * 0.8 },
      { y: -length * 0.16, width: radius * 0.91, depth: radius * 0.83 },
      { y: length * 0.12, width: radius, depth: radius * 0.95 },
      { y: length * 0.42, width: radius * 0.98, depth: radius * 0.88 },
      { y: length * 0.5 + radius * 0.5, width: radius * 0.32, depth: radius * 0.35 },
    ],
    8,
  );
}

/** A continuous last with a fitted heel, instep and flattened toe box. */
export function footballBoot(
  length: number,
  height: number,
  radial = 12,
  sole = false,
  subdivisions?: number,
) {
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
    1,
    true,
    subdivisions,
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

function smoothRingSeams(geometry: THREE.BufferGeometry, radial: number) {
  const normal = geometry.getAttribute("normal");
  const rows = Math.floor(geometry.getAttribute("position").count / (radial + 1));
  const n = new THREE.Vector3();
  for (let row = 0; row < rows; row++) {
    const a = row * (radial + 1),
      b = a + radial;
    n.set(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, n.x, n.y, n.z);
    normal.setXYZ(b, n.x, n.y, n.z);
  }
}

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
  subdivisions?: number,
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
      [0.46, 0.84, 0.75],
      [0.8, 0.61, 0.52],
      [1, 0.55, 0.43],
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
    subdivisions,
  );
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const u = -position.getY(i) / length;
    const envelope = Math.sin(THREE.MathUtils.clamp(u, 0, 1) * Math.PI) ** 2;
    const x = position.getX(i),
      z = position.getZ(i);
    const front = z >= 0 ? 1 : -1;
    const bulge =
      kind === "upperArm"
        ? (front > 0 ? 0.13 : 0.09) * Math.exp(-(((u - 0.48) / 0.24) ** 2))
        : kind === "thigh"
          ? (front > 0 ? 0.13 : 0.075) * Math.exp(-(((u - 0.5) / 0.3) ** 2))
          : kind === "calf"
            ? (front > 0 ? 0.025 : 0.12) * Math.exp(-(((u - 0.37) / 0.23) ** 2))
            : 0.065 * Math.exp(-(((u - 0.32) / 0.3) ** 2));
    const angular = Math.abs(z) / Math.max(radius * 0.1, Math.hypot(x, z));
    position.setZ(i, z + front * radius * bulge * envelope * angular);
    // Tibial ridge, two gastrocnemius heads and the lateral forearm muscle
    // remove the round tube silhouette without separate overlapping meshes.
    const lateral = Math.abs(x) / Math.max(radius * 0.1, Math.hypot(x, z));
    if (kind === "calf") {
      const shin = Math.exp(-(((u - 0.62) / 0.3) ** 2)) * (1 - lateral) ** 3;
      const heads = Math.exp(-(((u - 0.33) / 0.19) ** 2)) * lateral * (1 - lateral) * 4;
      position.setZ(
        i,
        position.getZ(i) + radius * envelope * (front > 0 ? shin * 0.027 : -heads * 0.034),
      );
    } else if (kind === "forearm") {
      position.setX(i, x * (1 + envelope * lateral * 0.055 * Math.exp(-(((u - 0.3) / 0.23) ** 2))));
    } else if (kind === "thigh" && front > 0) {
      const teardrop = Math.exp(-(((u - 0.79) / 0.12) ** 2)) * lateral;
      const rectus = Math.exp(-(((u - 0.48) / 0.26) ** 2)) * (1 - lateral) ** 2;
      position.setZ(i, position.getZ(i) + radius * envelope * (teardrop * 0.065 + rectus * 0.025));
    } else if (kind === "upperArm") {
      const deltoid = Math.exp(-(((u - 0.2) / 0.17) ** 2));
      position.setX(i, x * (1 + envelope * lateral * deltoid * 0.065));
    }
    // Two heads of the calf/quadriceps avoid a uniformly circular cylinder.
    if (kind === "thigh" || kind === "calf")
      position.setX(
        i,
        position.getX(i) * (1 + envelope * 0.035 * Math.exp(-(((u - 0.43) / 0.25) ** 2))),
      );
  }
  geometry.computeVertexNormals();
  smoothRingSeams(geometry, radial);
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

/** Cloth samples the already sculpted limb, including its muscle bulges.
 * Interpolate the opening ring so every sock height stays fitted to the calf. */
export function fittedLimbCover(
  kind: LimbProfile,
  length: number,
  radius: number,
  radial: number,
  from: number,
  offset = 0.002,
  to = 1.035,
  subdivisions?: number,
) {
  const limb = anatomicalLimb(kind, length, radius, radial, false, subdivisions);
  const source = limb.getAttribute("position");
  const rows = source.count / (radial + 1);
  const opening = -length * from;
  const bottom = -length * to;
  const heights = [bottom];
  for (let row = 0; row < rows; row++) {
    const y = source.getY(row * (radial + 1));
    if (y < opening - 1e-6 && y > bottom + 1e-6) heights.push(y);
  }
  heights.push(opening);
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (const y of heights) {
    let lower = 0;
    while (lower < rows - 2 && source.getY((lower + 1) * (radial + 1)) < y) lower++;
    const aY = source.getY(lower * (radial + 1));
    const bY = source.getY((lower + 1) * (radial + 1));
    const t = THREE.MathUtils.clamp((y - aY) / (bY - aY), 0, 1);
    for (let side = 0; side <= radial; side++) {
      const a = lower * (radial + 1) + side,
        b = a + radial + 1;
      const x = THREE.MathUtils.lerp(source.getX(a), source.getX(b), t);
      const z = THREE.MathUtils.lerp(source.getZ(a), source.getZ(b), t);
      const r = Math.max(1e-6, Math.hypot(x, z));
      positions.push(x + (x / r) * offset, y, z + (z / r) * offset);
      uv.push(side / radial, (y - bottom) / (opening - bottom));
    }
  }
  for (let row = 0; row < heights.length - 1; row++)
    for (let side = 0; side < radial; side++) {
      const a = row * (radial + 1) + side,
        b = a + radial + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  limb.dispose();
  const cover = new THREE.BufferGeometry();
  cover.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  cover.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  cover.setIndex(indices);
  cover.computeVertexNormals();
  smoothRingSeams(cover, radial);
  return cover;
}

/** Libera as geometrias criadas pelo merge (materiais são compartilhados). */
export function disposeRigMeshes(meshes: RigMesh[]): void {
  for (const mesh of meshes) mesh.geometry.dispose();
}

/** Conta malhas de um rig mesclado (usado em teste de orçamento). */
export function countRigMeshes(meshes: RigMesh[]): number {
  return meshes.length;
}
