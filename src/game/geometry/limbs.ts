import * as THREE from "three";

/** Smooth elliptical rings: waist, ribcage and shoulders have distinct widths.
 * Closed caps and UVs keep this compatible with the existing kit materials. */
export function anatomicalSection(
  rings: readonly { y: number; width: number; depth: number; centerDepth?: number }[],
  radial = 12,
  roundness = 1,
  caps: boolean | "bottom" | "top" = true,
  // Keep extra axial samples exactly where the silhouette changes fastest:
  // high-detail torsos and limbs get twice the rings, medium actors get the
  // same refinement at their cheaper radial count, and distant low actors
  // keep their original budget.
  subdivisions = radial >= 12 ? 6 : radial >= 8 ? 4 : 2,
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
    // Caps need their own normals. Sharing the side ring tilted the garment
    // rim's normals towards its lid and created a swollen shoulder/waist edge.
    const edge = positions.length / 3;
    for (let side = 0; side <= radial; side++) {
      const source = (row * (radial + 1) + side) * 3;
      positions.push(positions[source]!, positions[source + 1]!, positions[source + 2]!);
      uvs.push(side / radial, reverse ? 0 : 1);
    }
    for (let side = 0; side < radial; side++) {
      const a = edge + side;
      indices.push(center, reverse ? a + 1 : a, reverse ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Preserve only the side seam pairs; cap vertices keep their hard rim
  // normals. Later anatomy/cloth sculpting must smooth these same pairs again.
  geometry.userData["surfaceSeams"] = rings.map((_, row) => [
    row * (radial + 1),
    row * (radial + 1) + radial,
  ]);
  refreshSurfaceNormals(geometry);
  return geometry;
}

/** Sculpting recomputes normals; a split UV seam must remain visually smooth
 * after that pass. This uses authored pairs instead of welding vertices, so
 * cloth UVs and the separate normals on capped openings remain intact. */
export function refreshSurfaceNormals(geometry: THREE.BufferGeometry) {
  geometry.computeVertexNormals();
  const pairs = geometry.userData["surfaceSeams"] as [number, number][] | undefined;
  if (!pairs) return;
  const normals = geometry.getAttribute("normal");
  const average = new THREE.Vector3();
  for (const [a, b] of pairs) {
    average
      .set(
        normals.getX(a) + normals.getX(b),
        normals.getY(a) + normals.getY(b),
        normals.getZ(a) + normals.getZ(b),
      )
      .normalize();
    normals.setXYZ(a, average.x, average.y, average.z);
    normals.setXYZ(b, average.x, average.y, average.z);
  }
}

export type LimbProfile = "upperArm" | "forearm" | "thigh" | "calf";

export function smoothRingSeams(geometry: THREE.BufferGeometry, radial: number) {
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
  side: -1 | 1 = 1,
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
      [0.2, 0.84, 0.8],
      [0.46, 0.74, 0.67],
      [0.8, 0.58, 0.49],
      [1, 0.55, 0.43],
    ],
    thigh: [
      [0, 1.18, 1.12],
      [0.24, 1.22, 1.16],
      [0.52, 1.08, 1.13],
      [0.85, 0.79, 0.84],
      [1, 0.69, 0.77],
    ],
    calf: [
      [0, 0.69, 0.77],
      [0.22, 0.8, 0.9],
      [0.4, 0.82, 0.96],
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
    // Tibial ridge, integrated patellar tendon, two gastrocnemius heads and
    // the lateral forearm muscle remove the round tube silhouette without
    // separate overlapping meshes. Keeping the knee landmark in the calf
    // surface avoids the small floating sphere that previously read as a
    // plastic cap during a close inspection.
    const lateral = Math.abs(x) / Math.max(radius * 0.1, Math.hypot(x, z));
    // Patella spans the femur/tibia boundary. Apply the same front-facing
    // lens to both seam rings instead of a sphere or a bulge that vanishes
    // at the knee itself. The tendon narrows into the tibial crest below it.
    if ((kind === "thigh" || kind === "calf") && front > 0) {
      const distance = kind === "thigh" ? 1 - u : u;
      const patella = Math.exp(-((distance / 0.095) ** 2));
      position.setZ(i, position.getZ(i) + radius * 0.11 * patella * angular ** 4);
    }
    if (kind === "calf") {
      const shin = Math.exp(-(((u - 0.62) / 0.3) ** 2)) * (1 - lateral) ** 3;
      const heads = Math.exp(-(((u - 0.33) / 0.19) ** 2)) * lateral * (1 - lateral) * 4;
      const soleus = Math.exp(-(((u - 0.58) / 0.22) ** 2)) * lateral * (1 - lateral) * 4;
      position.setZ(
        i,
        position.getZ(i) +
          radius * envelope * (front > 0 ? shin * 0.034 : -heads * 0.057 - soleus * 0.022) +
          (front > 0
            ? radius *
              0.125 *
              Math.sqrt(Math.max(0, Math.sin(Math.PI * THREE.MathUtils.clamp(u, 0, 1)))) *
              Math.exp(-(((u - 0.085) / 0.13) ** 2)) *
              angular ** 2
            : 0),
      );
    } else if (kind === "forearm") {
      position.setX(i, x * (1 + envelope * lateral * 0.055 * Math.exp(-(((u - 0.3) / 0.23) ** 2))));
    } else if (kind === "thigh" && front > 0) {
      const teardrop = Math.exp(-(((u - 0.79) / 0.12) ** 2)) * lateral;
      const rectus = Math.exp(-(((u - 0.48) / 0.26) ** 2)) * (1 - lateral) ** 2;
      const separation = Math.exp(-(((lateral - 0.56) / 0.11) ** 2) - ((u - 0.58) / 0.27) ** 2);
      const quadricepsTendon =
        Math.exp(-((x / Math.max(radius * 0.1, radius * 0.36)) ** 2) - ((u - 0.9) / 0.1) ** 2) *
        angular;
      position.setZ(
        i,
        position.getZ(i) +
          radius *
            envelope *
            angular *
            (teardrop * 0.128 + rectus * 0.069 + quadricepsTendon * 0.018 - separation * 0.034),
      );
    } else if (kind === "upperArm") {
      const deltoid = Math.exp(-(((u - 0.2) / 0.17) ** 2));
      position.setX(i, x * (1 + envelope * lateral * deltoid * 0.084));
    }
    // Medial quadriceps/calf heads and the forearm flexors mirror across the
    // body. Their envelope vanishes at both joints, preserving bind seams.
    const medial = THREE.MathUtils.clamp((-x * side) / radius, -1, 1);
    if (kind !== "upperArm") {
      const landmark = kind === "thigh" ? 0.72 : kind === "calf" ? 0.34 : 0.3;
      const relief = Math.exp(-(((u - landmark) / 0.22) ** 2));
      const reliefStrength = kind === "thigh" ? 0.045 : kind === "calf" ? 0.04 : 0.035;
      position.setZ(
        i,
        position.getZ(i) + radius * reliefStrength * envelope * relief * medial * angular,
      );
    }
    // Two heads of the calf/quadriceps avoid a uniformly circular cylinder.
    if (kind === "thigh" || kind === "calf")
      position.setX(
        i,
        position.getX(i) *
          (1 +
            envelope * (kind === "thigh" ? 0.065 : 0.055) * Math.exp(-(((u - 0.43) / 0.25) ** 2))),
      );
  }
  refreshSurfaceNormals(geometry);
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

/** A fitted, rear-facing ink patch sampled from the same sculpted forearm
 * surface. The angular limits keep a tattoo from reading as a bracelet, and
 * the small normal offset prevents z-fighting without changing the limb. */
export function forearmTattooSurface(
  length: number,
  radius: number,
  radial = 12,
  side: -1 | 1 = 1,
) {
  // Sample the same medial/lateral relief as the owning forearm. Otherwise a
  // right-side tattoo follows the left-side surface after the mirrored
  // flexor anatomy is applied.
  const arm = anatomicalLimb("forearm", length, radius, radial, false, undefined, side);
  const sourcePosition = arm.getAttribute("position") as THREE.BufferAttribute;
  const sourceNormal = arm.getAttribute("normal") as THREE.BufferAttribute;
  const sourceRows = sourcePosition.count / (radial + 1);
  const rows = 16;
  const columns = 16;
  const startY = -length * 0.82;
  const endY = -length * 0.24;
  const center = Math.PI + side * 0.11;
  const halfArc = 0.98;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const value = (
    attribute: THREE.BufferAttribute,
    y: number,
    angle: number,
    component: "x" | "y" | "z",
  ) => {
    let row = 0;
    while (row < sourceRows - 2 && sourcePosition.getY((row + 1) * (radial + 1)) < y) row++;
    const lowY = sourcePosition.getY(row * (radial + 1));
    const highY = sourcePosition.getY((row + 1) * (radial + 1));
    const rowT = THREE.MathUtils.clamp((y - lowY) / Math.max(1e-6, highY - lowY), 0, 1);
    const ringPosition = THREE.MathUtils.clamp(angle / (Math.PI * 2), 0, 1) * radial;
    const ring = Math.min(radial - 1, Math.floor(ringPosition));
    const ringT = ringPosition - ring;
    const get = (r: number, c: number) => {
      const index = r * (radial + 1) + c;
      return component === "x"
        ? attribute.getX(index)
        : component === "y"
          ? attribute.getY(index)
          : attribute.getZ(index);
    };
    const low = THREE.MathUtils.lerp(get(row, ring), get(row, ring + 1), ringT);
    const high = THREE.MathUtils.lerp(get(row + 1, ring), get(row + 1, ring + 1), ringT);
    return THREE.MathUtils.lerp(low, high, rowT);
  };

  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const y = THREE.MathUtils.lerp(startY, endY, v);
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const angle = center - halfArc + u * halfArc * 2;
      const normal = new THREE.Vector3(
        value(sourceNormal, y, angle, "x"),
        value(sourceNormal, y, angle, "y"),
        value(sourceNormal, y, angle, "z"),
      ).normalize();
      positions.push(
        value(sourcePosition, y, angle, "x") + normal.x * 0.0012,
        value(sourcePosition, y, angle, "y") + normal.y * 0.0012,
        value(sourcePosition, y, angle, "z") + normal.z * 0.0012,
      );
      uvs.push(u, v);
    }
  }
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  arm.dispose();
  const patch = new THREE.BufferGeometry();
  patch.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  patch.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  patch.setIndex(indices);
  patch.computeVertexNormals();
  return patch;
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
  side: -1 | 1 = 1,
) {
  const limb = anatomicalLimb(kind, length, radius, radial, false, subdivisions, side);
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
