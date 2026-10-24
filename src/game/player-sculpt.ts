import {
  gauss,
  faceRing,
  headPoint,
  headComplexion,
  gridSurface,
  sculptedHead,
  sculptedHair,
} from "./sculpt/head";
import type { HeadShape } from "./sculpt/head";
export { headPoint, sculptedHead, sculptedHair } from "./sculpt/head";
import * as THREE from "three";
import type { PlayerLook, Proportions } from "./player-model";
import { makeLookRng } from "./player-model";
import { faceMorphology, skinAlbedo } from "./player-morphology";
import type { PlayerMaterials } from "./player-materials";
import { rigPart, type RigPart } from "./rig-geometry";
import {
  beardMaterial,
  beardAlbedo,
  eyeWhiteMaterial,
  goldMaterial,
  headbandMaterial,
  irisMaterial,
  pupilMaterial,
  skinDetailMaterial,
} from "./rig-materials";

export function faceSurfaceZ(P: HeadShape, x: number, y: number, seed = 0) {
  const ring = faceRing(y / P.headR, seed);
  const angle = Math.asin(THREE.MathUtils.clamp(x / (P.headW * ring.width), -0.999, 0.999));
  return headPoint(P, y / P.headR, angle, seed).z;
}

function curve(points: THREE.Vector3[], radius: number, segments = 14) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false);
}

/** Close hair keeps the existing five-sided lock budget. Broad woven relief
 * and a rounded, tapered tip change its silhouette instead of adding wisps,
 * materials or bones. Roots stay buried in the fitted scalp. */
function fittedHairLock(
  points: THREE.Vector3[],
  radius: number,
  segments: number,
  style: "ponytail" | "dreads" | "braids",
) {
  const path = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(path, segments, radius, 5, false);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const centre = new THREE.Vector3();
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    path.getPointAt(t, centre);
    const taper = 0.64 * (1 - THREE.MathUtils.smoothstep(t, 0.2, 0.9)) + 0.35;
    const root = 0.88 + THREE.MathUtils.smoothstep(t, 0, 0.18) * 0.12;
    for (let col = 0; col <= 5; col++) {
      const angle = (col / 5) * Math.PI * 2;
      // Woven pairs turn along a braid. Dreads retain a soft, irregular
      // cylindrical body; the ponytail narrows as one gathered bundle.
      const braid = style === "braids" ? 0.87 + Math.cos(angle * 2 - t * Math.PI * 4) * 0.13 : 1;
      const fibre = style === "dreads" ? 1 + Math.sin(t * Math.PI * 5) * 0.045 : 1;
      const r = radius * taper * root * braid * fibre;
      const i = row * 6 + col;
      positions.setXYZ(
        i,
        centre.x -
          geometry.normals[row]!.x * Math.cos(angle) * r +
          geometry.binormals[row]!.x * Math.sin(angle) * r,
        centre.y -
          geometry.normals[row]!.y * Math.cos(angle) * r +
          geometry.binormals[row]!.y * Math.sin(angle) * r,
        centre.z -
          geometry.normals[row]!.z * Math.cos(angle) * r +
          geometry.binormals[row]!.z * Math.sin(angle) * r,
      );
      // A scalp alpha atlas cannot cut the circumference of a tubular lock.
      uv.setY(i, 0.16 + uv.getY(i) * 0.68);
    }
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  const average = new THREE.Vector3();
  for (let row = 0; row <= segments; row++) {
    const start = row * 6;
    average
      .set(
        normals.getX(start) + normals.getX(start + 5),
        normals.getY(start) + normals.getY(start + 5),
        normals.getZ(start) + normals.getZ(start + 5),
      )
      .normalize();
    normals.setXYZ(start, average.x, average.y, average.z);
    normals.setXYZ(start + 5, average.x, average.y, average.z);
  }
  return geometry;
}

/** A narrow crest follows the crown and nape rather than floating as an
 * ellipsoid. Its broad cut locks occupy fewer triangles than the old sphere. */
function fittedMohawk(P: Proportions, seed: number) {
  return gridSurface(8, 18, (u, v) => {
    const t = u * 2 - 1;
    const crown = Math.sin(v * Math.PI);
    const height = crown * 1.14 + (0.57 * (1 - v) - 0.35 * v) * (1 - crown);
    const centre = headPoint(P, height, v <= 0.5 ? 0 : Math.PI, seed);
    const cut = Math.sin(v * Math.PI * 7 + (seed % 17)) * 0.014 * crown;
    return new THREE.Vector3(
      P.headR * t * (0.018 + crown ** 0.45 * 0.105),
      centre.y + P.headR * (0.28 + cut) * crown ** 0.65 * (1 - Math.abs(t) ** 0.72),
      centre.z,
    );
  });
}

/** The existing bun sphere becomes a gathered knot with shallow coiled
 * lobes. It keeps the same triangle budget and the same attachment point. */
function gatheredBun(radius: number, seed: number) {
  const geometry = new THREE.SphereGeometry(radius, 12, 10);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const gather = Math.sin(v * Math.PI) ** 2;
    const coil = 1 + Math.cos(u * Math.PI * 10 + v * Math.PI * 3 + (seed % 13)) * gather * 0.09;
    positions.setXYZ(
      i,
      positions.getX(i) * coil,
      positions.getY(i) * (1 - gather * 0.045),
      positions.getZ(i) * coil,
    );
    uv.setY(i, 0.16 + v * 0.68);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function orbitalArch(u: number, portrait: boolean) {
  // An elliptical palpebral opening has a fuller arc than a pointed sine
  // lens. Shared sampling closes the upper/lower corners exactly.
  const relaxed = Math.sin(u * Math.PI) ** 0.78;
  return portrait
    ? THREE.MathUtils.lerp(relaxed, Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)), 0.3)
    : relaxed;
}

function eyePatch(P: Proportions, side: number, seed: number, portrait = false) {
  const f = faceMorphology(seed);
  // An almond shaped lens fitted into the socket; no protruding eyeball.
  const geometry = gridSurface(20, 6, (u, v) => {
    const t = u * 2 - 1;
    const aperture = orbitalArch(u, portrait);
    const x = P.headW * (side * f.eyeSpacing + t * f.eyeWidth * 0.86);
    const y =
      P.headR * (0.14 + side * f.eyeAsymmetry + side * t * 0.012) +
      // Use the very same rim as the attached lids. The narrower old sclera
      // left a skin gap at its corners and exposed a complete circular iris.
      aperture * P.headR * (v * 0.74 - 0.42) * f.eyeOpening;
    return new THREE.Vector3(
      x,
      y,
      faceSurfaceZ(P, x, y, seed) +
        // The sclera sits in the socket. The corneal dome can then project
        // naturally without turning the whole eye into a white marble.
        P.headR *
          (0.003 +
            aperture * Math.sin(v * Math.PI) * 0.008 -
            // The canthi enter the orbital skin. Keeping even their zero-area
            // tips in front produced pale triangular stickers under side light.
            0.02 * (1 - aperture) ** 2),
    );
  });
  const uv = geometry.getAttribute("uv");
  const color = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const arch = orbitalArch(u, portrait);
    // Contact shade and the warm inner corner are baked into the existing
    // sclera. They survive flat fill light without a new occlusion pass/map.
    const shade =
      0.16 * Math.abs(v * 2 - 1) ** 1.4 * arch +
      0.24 * (1 - arch) +
      0.12 * THREE.MathUtils.smoothstep(v, 0.45, 1) * arch;
    const inner = side > 0 ? 1 - u : u;
    const warmth = 0.1 * THREE.MathUtils.smoothstep(inner, 0.7, 1);
    color.set([1 - shade * 0.7, 1 - shade - warmth * 0.3, 1 - shade - warmth * 0.55], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  return geometry;
}

/** A convex corneal surface follows the socket normal; highlights come from
 * the lighting rather than a painted white dot attached to the eye. */
export function irisDome(P: Proportions, x: number, y: number, seed: number, radius: number) {
  // Interior rings give the lens a convex profile with radial iris UVs.
  const lens = gridSurface(24, 5, (u, v) => {
    const angle = u * Math.PI * 2,
      r = v * radius;
    const px = x + Math.cos(angle) * r,
      py = y + Math.sin(angle) * r;
    return new THREE.Vector3(
      px,
      py,
      faceSurfaceZ(P, px, py, seed) + P.headR * (0.04 + 0.013 * (1 - v * v)),
    );
  });
  // The radial grid's winding points inward; reverse once at construction.
  const indices = lens.getIndex()!;
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i);
    indices.setX(i, indices.getX(i + 2));
    indices.setX(i + 2, a);
  }
  const uv = lens.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const angle = uv.getX(i) * Math.PI * 2,
      r = uv.getY(i) * 0.5;
    uv.setXY(i, 0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r);
  }
  lens.computeVertexNormals();
  smoothRadialNormals(lens, 24);
  return lens;
}

/** Polar UV grids duplicate their centre and seam. Share the same normal at
 * those vertices so a wet eye or ear cannot acquire a black triangular wedge. */
function smoothRadialNormals(geometry: THREE.BufferGeometry, columns: number) {
  const normal = geometry.getAttribute("normal"),
    sum = new THREE.Vector3();
  for (let i = 0; i <= columns; i++)
    sum.add(new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)));
  sum.normalize();
  for (let i = 0; i <= columns; i++) normal.setXYZ(i, sum.x, sum.y, sum.z);
  for (let row = columns + 1; row < normal.count; row += columns + 1) {
    const end = row + columns;
    sum
      .set(
        normal.getX(row) + normal.getX(end),
        normal.getY(row) + normal.getY(end),
        normal.getZ(row) + normal.getZ(end),
      )
      .normalize();
    normal.setXYZ(row, sum.x, sum.y, sum.z);
    normal.setXYZ(end, sum.x, sum.y, sum.z);
  }
}

/** Helix, antihelix, concha and lobe are one sculpted surface, sharing skin. */
export function sculptedEar(P: Proportions, side: number, detail: boolean, portrait = false) {
  const R = P.headR;
  const ear = gridSurface(detail ? 28 : 12, detail ? 10 : 5, (u, v) => {
    const a = u * Math.PI * 2,
      lobe = Math.max(0, -Math.sin(a)),
      upper = Math.max(0, Math.sin(a)),
      anterior = Math.max(0, Math.cos(a));
    // An auricle is a folded C, not concentric rings. The anterior helix
    // opens into the concha, the antihelix forks above it, and the soft lobe
    // hangs forward; all landmarks still occupy this single existing mesh.
    const helix = Math.exp(-(((v - 0.82) / 0.11) ** 2)) * (1 - anterior ** 4 * v * 0.68);
    const antihelix =
      Math.exp(-(((v - (0.48 + upper * 0.12)) / 0.1) ** 2)) *
      (0.35 + upper * 0.55 + (1 - anterior) * 0.18);
    const concha = Math.exp(-(((v - 0.26) / 0.23) ** 2)) * (0.6 + anterior * v * 0.4);
    const tragus = Math.exp(-(((v - 0.5) / 0.19) ** 2)) * anterior ** 10 * v;
    // Broad, shallow rolling keeps the profile's helix but avoids a frontal
    // fin. Leave the anterior tragus/lobe almost untouched; roll mainly the
    // posterior/superior edge and contract its silhouette slightly in-plane.
    const rimFade = portrait ? THREE.MathUtils.smoothstep(v, 0.55, 1) : 0;
    const rimMask = 0.2 + 0.8 * Math.max(upper, Math.max(0, -Math.cos(a)));
    const rimReturn = rimFade * rimMask * 0.03;
    const contourScale = 1 - rimFade * rimMask * 0.035;
    const depth =
      0.025 +
      v * 0.035 +
      helix * 0.094 +
      antihelix * v * 0.084 -
      concha * 0.034 +
      tragus * 0.083 +
      lobe * v * 0.035 -
      rimReturn;
    return new THREE.Vector3(
      // The root belongs inside the temporal side plane; a fixed outer
      // root left the entire auricle floating beside the portrait silhouette.
      side * (P.headW * (portrait ? 0.87 : 0.925) + R * depth),
      R * (-0.055 + (Math.sin(a) * v * (0.23 + upper * 0.028) - lobe * v * 0.013) * contourScale),
      R *
        (-0.025 -
          (portrait ? 0.035 : 0) +
          (Math.cos(a) * v * (0.13 - upper * 0.018) + lobe * v * 0.028) * contourScale),
    );
  });
  // Outward surface must face the corresponding side of the head.
  if (side < 0) {
    const index = ear.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, a);
    }
  }
  ear.computeVertexNormals();
  smoothRadialNormals(ear, detail ? 28 : 12);
  const uv = ear.getAttribute("uv"),
    colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const a = uv.getX(i) * Math.PI * 2,
      v = uv.getY(i);
    const cavity = Math.exp(-(((v - 0.27) / 0.23) ** 2)) * (0.6 + Math.max(0, Math.cos(a)) * 0.4);
    const shade = cavity * 0.15;
    colors.set([1 - shade * 0.65, 1 - shade - 0.035, 1 - shade - 0.045], i * 3);
  }
  ear.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return ear;
}

export function lipPatch(P: Proportions, seed: number, lower: boolean) {
  const f = faceMorphology(seed);
  const geometry = gridSurface(24, 6, (u, v) => {
    const t = u * 2 - 1;
    const x = t * P.headR * f.mouthWidth;
    const arch = Math.sin(u * Math.PI);
    const seam = -0.498 + 0.01 * (1 - t * t) + t * f.mouthTilt;
    const cupid = 0.026 * Math.exp(-(((Math.abs(t) - 0.28) / 0.17) ** 2));
    const cornerDip = 0.012 * THREE.MathUtils.smoothstep(Math.abs(t), 0.68, 1);
    const lipHeight = lower ? 0.064 : 0.027 + cupid;
    const y =
      P.headR * (seam + (lower ? -1 : 1) * arch * v * lipHeight - (lower ? 1 : -1) * cornerDip * v);
    return new THREE.Vector3(
      x,
      y,
      // The lip volume is already part of the shared continuous skull.
      // This is a flush pigment layer, with no second projected ridge.
      faceSurfaceZ(P, x, y, seed) + P.headR * 0.0008,
    );
  });
  // Lower lip rows run downward. Reverse their winding so the vermilion
  // surface faces the camera instead of disappearing behind backface culling.
  if (lower) {
    const index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const first = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, first);
    }
    geometry.computeVertexNormals();
  }
  const color = new Float32Array(geometry.getAttribute("position").count * 3);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < color.length; i += 3) {
    const u = uv.getX(i / 3),
      v = uv.getY(i / 3);
    const arch = Math.sin(u * Math.PI) ** 0.65;
    const pigment = arch * (1 - THREE.MathUtils.smoothstep(v, 0.55, 1));
    const seam = (1 - THREE.MathUtils.smoothstep(v, 0, 0.2)) * arch * 0.085;
    // Vermilion is warmer than the adjacent skin, rather than pale skin with
    // a white crest. Pigment fades into both corners and the outer attachment
    // while retaining the same complexion and shared skin material.
    color[i] = 1 - pigment * 0.025 - seam;
    color[i + 1] = 1 - pigment * (lower ? 0.25 : 0.3) - seam;
    color[i + 2] = 1 - pigment * (lower ? 0.18 : 0.22) - seam * 0.7;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  // The skull uses normals sampled from its continuous sculpt. An attached
  // lip patch used triangle averages instead, creating a bright horizontal
  // border even where its relief and pigment had already faded into skin.
  // Settle the outer tissue and mouth corners into the same facial normal;
  // keep the rolled vermilion's interior shading intact.
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const across = new THREE.Vector3();
  const vertical = new THREE.Vector3();
  const facialNormal = new THREE.Vector3();
  const patchNormal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const attachment = 1;
    const height = positions.getY(i) / P.headR;
    const ring = faceRing(height, seed);
    const angle = Math.asin(
      THREE.MathUtils.clamp(positions.getX(i) / (P.headW * ring.width), -0.999, 0.999),
    );
    across
      .copy(headPoint(P, height, angle + 0.0005, seed))
      .sub(headPoint(P, height, angle - 0.0005, seed));
    vertical
      .copy(headPoint(P, height + 0.0005, angle, seed))
      .sub(headPoint(P, height - 0.0005, angle, seed));
    facialNormal.crossVectors(across, vertical).normalize();
    patchNormal.fromBufferAttribute(normals, i).lerp(facialNormal, attachment).normalize();
    normals.setXYZ(i, patchNormal.x, patchNormal.y, patchNormal.z);
  }
  continueHeadComplexion(geometry, P);
  mapHeadSurfaceUv(geometry, P, seed);
  return geometry;
}

/** Multiply local vermilion/waterline pigment by the same continuous skin
 * field as the underlying skull; attachments now match albedo as well as UVs. */
function continueHeadComplexion(geometry: THREE.BufferGeometry, P: HeadShape) {
  const position = geometry.getAttribute("position");
  const color = geometry.getAttribute("color");
  const pigment = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    headComplexion(P, position.getX(i), position.getY(i), position.getZ(i), pigment);
    color.setXYZ(
      i,
      color.getX(i) * pigment.r,
      color.getY(i) * pigment.g,
      color.getZ(i) * pigment.b,
    );
  }
}

/** Match the skull's skin-map scale on an attached facial patch. A full 0–1
 * pore/sweat atlas stretched across each tiny lip produced unrelated bumps
 * and bright stripes. Signed frontal U keeps the centre continuous through
 * the repeating scalp atlas instead of interpolating across its 0/1 seam. */
function mapHeadSurfaceUv(geometry: THREE.BufferGeometry, P: HeadShape, seed: number) {
  const points = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv");
  for (let i = 0; i < points.count; i++) {
    const y = points.getY(i) / P.headR;
    const ring = faceRing(y, seed);
    const angle = Math.asin(
      THREE.MathUtils.clamp(points.getX(i) / (P.headW * ring.width), -0.999, 0.999),
    );
    let u = angle / (Math.PI * 2);
    let centered = y / 1.14;
    for (let iteration = 0; iteration < 4; iteration++) {
      const theta = u * Math.PI * 2;
      u -= (theta - Math.sin(theta) * 0.6 - angle) / (Math.PI * 2 * (1 - Math.cos(theta) * 0.6));
      centered -=
        (centered * (0.7 + centered * centered * 0.3) - y / 1.14) /
        (0.7 + centered * centered * 0.9);
    }
    uv.setXY(i, u, (centered + 1) * 0.5);
  }
}

/** A shallow oral cavity lives behind the two lip surfaces.  It gives an
 * opened jaw real depth during a shout, sprint or reaction instead of showing
 * the background through a flat lip seam.  It shares the existing pupil
 * material, so it adds no material allocation per athlete. */
function mouthInterior(P: Proportions, seed: number) {
  const f = faceMorphology(seed);
  return gridSurface(20, 3, (u, v) => {
    const t = u * 2 - 1;
    const arch = Math.sin(u * Math.PI);
    const x = t * P.headR * f.mouthWidth * 0.88;
    // A relaxed mouth has a narrow seam. The jaw exposes this interior while
    // speaking; a permanently tall cavity made a neutral face look grimacing.
    const y = P.headR * (-0.497 + t * f.mouthTilt + (v - 0.5) * arch * 0.016);
    return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) - P.headR * 0.003);
  });
}

/** A shallow crease replaces the cylinder that outlined the whole mouth.
 * Its colour and width fade into the commissures, while the oral cavity is
 * actually recessed behind it until the existing jaw opens. */
function relaxedMouthCrease(P: Proportions, seed: number) {
  const f = faceMorphology(seed);
  const geometry = gridSurface(24, 2, (u, v) => {
    const t = u * 2 - 1;
    const arch = Math.sin(u * Math.PI);
    const x = t * P.headR * f.mouthWidth;
    const y = P.headR * (-0.498 + 0.01 * (1 - t * t) + t * f.mouthTilt + (v - 0.5) * arch * 0.004);
    return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.0011);
  });
  const uv = geometry.getAttribute("uv");
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const crease = Math.sin(uv.getX(i) * Math.PI) ** 0.65 * Math.sin(uv.getY(i) * Math.PI);
    colors.set([1 - crease * 0.5, 1 - crease * 0.61, 1 - crease * 0.58], i * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  continueHeadComplexion(geometry, P);
  mapHeadSurfaceUv(geometry, P, seed);
  return geometry;
}

/** Facial hair follows the jaw and cheek landmarks with a separate chin
 * volume. The softened texture border uses the same UVs in every detail tier. */
export function sculptedBeard(P: HeadShape, look: PlayerLook, detail = true) {
  const moustache = look.beard === "moustache";
  if (moustache) return sculptedMoustache(P, look, detail);
  const full = look.beard === "full";
  const geometry = gridSurface(detail ? 40 : 16, detail ? 18 : 8, (u, v) => {
    const angle = (u - 0.5) * (look.beard === "goatee" ? 0.78 : 3.02);
    const side = Math.abs(Math.sin(angle));
    const bottom = -1.075 + side * 0.12;
    // A smooth, tapered cheek line with a restrained seeded break-up avoids
    // the ruler-straight mask that made every beard look painted on.
    const edge = detail
      ? Math.sin(angle * 7 + (look.seed % 31)) * 0.005 +
        Math.sin(angle * 17 - (look.seed % 19)) * 0.002
      : 0;
    // Keep growth below the lower vermilion at the centre, then rise along
    // the jaw toward the sideburns. The former flat central edge crossed the
    // relaxed mouth and turned the lower face into a dark hemispherical cap.
    const cheekRise = (full ? 0.385 : 0.345) * side ** 1.7;
    const top = -0.605 + cheekRise + edge;
    const p = headPoint(P, bottom + (top - bottom) * v, angle, look.seed);
    const chin = Math.max(0, Math.cos(angle)) ** 2;
    const taper = 1 - THREE.MathUtils.smoothstep(v, 0.7, 1);
    const lift = full
      ? taper * (0.005 + chin * Math.sin(Math.PI * v) * 0.022)
      : look.beard === "stubble"
        ? 0.0008
        : 0.003;
    p.x += P.headR * lift * Math.sin(angle);
    p.z += P.headR * (lift + 0.002) * Math.cos(angle);
    if (full) p.y -= P.headR * chin * (1 - v) ** 2 * 0.016;
    return p;
  });
  return tintBeardSurface(geometry, look, (u, v) => {
    const side = Math.abs(u * 2 - 1);
    return Math.max(
      THREE.MathUtils.smoothstep(v, 0.68, 1),
      THREE.MathUtils.smoothstep(side, 0.88, 1) * 0.85,
    );
  });
}

/** Two tapered growth lobes fit the upper lip. This replaces the projected
 * tube, whose lit circular cross section looked like a yellow pencil across
 * the face. It uses fewer triangles and the beard's existing material. */
export function sculptedMoustache(P: HeadShape, look: PlayerLook, detail = true) {
  const f = faceMorphology(look.seed);
  const geometry = gridSurface(detail ? 22 : 12, 3, (u, v) => {
    const t = u * 2 - 1;
    const taper = Math.max(0.035, Math.sin(u * Math.PI) ** 0.75);
    const x = t * P.headR * (f.mouthWidth * 0.93);
    const split = Math.exp(-((t / 0.15) ** 2));
    // Taper the silhouette itself, not just its relief. The previous fixed
    // top/bottom edges left a dark rectangle at either side of the philtrum.
    const centre = -0.397 - Math.abs(t) * 0.004 + split * 0.008;
    const halfHeight = 0.044 * taper * (1 - split * 0.58) * (0.9 + Math.abs(t) * 0.2);
    const y = P.headR * (centre + (1 - v * 2) * halfHeight + t * f.mouthTilt * 0.45);
    return new THREE.Vector3(
      x,
      y,
      faceSurfaceZ(P, x, y, look.seed) + P.headR * (0.002 + taper * Math.sin(v * Math.PI) * 0.0065),
    );
  });
  // Rows run down the face, so their front-facing winding is reversed.
  const index = geometry.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const first = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, first);
  }
  geometry.computeVertexNormals();
  return tintBeardSurface(geometry, look, (u, v) => {
    const t = u * 2 - 1;
    const edge = Math.abs(v * 2 - 1);
    return (
      0.18 +
      0.82 *
        Math.max(
          THREE.MathUtils.smoothstep(edge, 0.35, 1) * 0.88,
          Math.exp(-((t / 0.14) ** 2)) * 0.9,
          THREE.MathUtils.smoothstep(Math.abs(t), 0.78, 1),
        )
    );
  });
}

function tintBeardSurface(
  geometry: THREE.BufferGeometry,
  look: PlayerLook,
  skinBlend: (u: number, v: number) => number,
) {
  const base = new THREE.Color(skinAlbedo(look.skin)),
    tone = beardAlbedo(look.skin, look.hairColor, look.beard);
  const color = new Float32Array(geometry.getAttribute("position").count * 3);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const edge = skinBlend(uv.getX(i), uv.getY(i));
    for (let c = 0; c < 3; c++) {
      const skin = c === 0 ? base.r : c === 1 ? base.g : base.b;
      const fibre = c === 0 ? tone.r : c === 1 ? tone.g : tone.b;
      color[i * 3 + c] = 1 + edge * (skin / Math.max(0.0001, fibre) - 1);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  return geometry;
}

/** Orbital tissue overlaps the limbus; a flat white eye patch alone reads as paint. */
export function eyelidSurface(
  P: Proportions,
  side: number,
  seed: number,
  upper: boolean,
  portrait = false,
) {
  const f = faceMorphology(seed);
  const geometry = gridSurface(24, 4, (u, v) => {
    const t = u * 2 - 1,
      arch = portrait ? orbitalArch(u, true) : Math.max(0.012, Math.sin(u * Math.PI) ** 0.8);
    const x = P.headW * (side * f.eyeSpacing + t * f.eyeWidth * 0.86);
    const rim = f.eyeOpening * (upper ? 0.32 : 0.42);
    const fold = upper ? 0.095 : 0.064;
    const y =
      P.headR *
      (0.14 +
        side * f.eyeAsymmetry +
        side * t * 0.012 +
        (upper ? 1 : -1) * arch * (rim + v * fold));
    return new THREE.Vector3(
      x,
      y,
      // The attached lid starts in front of the recessed sclera, then rolls
      // back into the orbital tissue. It reads as skin volume instead of a
      // second painted outline around the eye.
      faceSurfaceZ(P, x, y, seed) +
        P.headR *
          // The wet margin is a narrow ridge. Its projection falls rapidly
          // into the orbit instead of carrying a convex bag across the flap.
          THREE.MathUtils.lerp(
            0.037 * (1 - v) ** 2 * arch + (upper ? 0.002 : 0) * Math.sin(v * Math.PI) * arch,
            0.0008,
            THREE.MathUtils.smoothstep(v, 0.65, 1),
          ),
    );
  });
  if (!upper) {
    const index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const first = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, first);
    }
    geometry.computeVertexNormals();
  }
  {
    // Settle the flap's outer shading into the continuous face, rather than
    // lighting its last narrow triangle strip as a separate white rim.
    const position = geometry.getAttribute("position"),
      normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv"),
      n = new THREE.Vector3(),
      faceN = new THREE.Vector3();
    const epsilon = P.headR * 0.001;
    for (let i = 0; i < position.count; i++) {
      const blend = THREE.MathUtils.smoothstep(uv.getY(i), 0.4, 1);
      if (!blend) continue;
      const x = position.getX(i),
        y = position.getY(i);
      faceN
        .set(
          -(faceSurfaceZ(P, x + epsilon, y, seed) - faceSurfaceZ(P, x - epsilon, y, seed)) /
            (2 * epsilon),
          -(faceSurfaceZ(P, x, y + epsilon, seed) - faceSurfaceZ(P, x, y - epsilon, seed)) /
            (2 * epsilon),
          1,
        )
        .normalize();
      n.fromBufferAttribute(normal, i).lerp(faceN, blend).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
    }
  }
  const uv = geometry.getAttribute("uv");
  const color = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const arch = Math.sin(uv.getX(i) * Math.PI) ** 0.8;
    const rim = (1 - THREE.MathUtils.smoothstep(uv.getY(i), 0, 0.35)) * arch * 0.075;
    // A narrow warm waterline connects sclera to skin. The upper fold keeps
    // its contact shade even in the studio's broad ambient fill.
    const crease = upper
      ? gauss(uv.getY(i), 0, 0.72, 0, 0.18, 1) *
        arch *
        0.035 *
        (1 - THREE.MathUtils.smoothstep(uv.getY(i), 0.8, 1))
      : 0;
    color.set([1 - rim * 0.45 - crease, 1 - rim - crease, 1 - rim * 1.12 - crease], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  // Continue skull pores across the attachment instead of repeating the
  // complete skin atlas in each thin flap (which reads as a shiny sticker).
  continueHeadComplexion(geometry, P);
  mapHeadSurfaceUv(geometry, P, seed);
  return geometry;
}

/**
 * The orbital hinge sits at the lid's attached edge, not at its geometric
 * centre. `buildSculptedFace` authors each lid relative to this point and
 * `rig-skin` installs the matching bone at the same point, preserving the
 * authored surface exactly in bind pose.
 */
export function eyelidPivot(P: Proportions, side: number, seed: number, upper: boolean) {
  const f = faceMorphology(seed);
  const x = P.headW * side * f.eyeSpacing;
  const y =
    P.headR *
    (0.14 +
      side * f.eyeAsymmetry +
      (upper ? 1 : -1) * (f.eyeOpening * (upper ? 0.32 : 0.42) + (upper ? 0.095 : 0.064)));
  return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.0008);
}

function eyebrowSurface(P: Proportions, side: number, seed: number) {
  const f = faceMorphology(seed);
  return gridSurface(20, 3, (u, v) => {
    const t = u * 2 - 1;
    const x = P.headW * (side * f.eyeSpacing + t * f.eyeWidth * 1.06);
    const taper = Math.max(0.04, Math.sin(u * Math.PI) ** 0.6);
    const outer = Math.max(0, side * t);
    const arch = 0.034 * Math.exp(-(((t + side * 0.18) / 0.63) ** 2));
    const tailDrop = 0.038 * THREE.MathUtils.smoothstep(outer, 0.18, 1);
    const y =
      P.headR *
      (0.3 +
        side * f.browAsymmetry +
        arch -
        tailDrop +
        side * (u - 0.5) * 0.017 +
        (v - 0.5) * 0.036 * taper);
    return new THREE.Vector3(
      x,
      y,
      faceSurfaceZ(P, x, y, seed) + P.headR * (0.014 + Math.sin(v * Math.PI) * 0.004),
    );
  });
}

export function buildSculptedFace(
  P: Proportions,
  look: PlayerLook,
  mats: PlayerMaterials,
  hi: boolean,
  portrait = true,
  topology: "standard" | "ultra" = "standard",
) {
  // The close-up tier deliberately spends most of its triangles on the two
  // silhouettes players recognise immediately: face and hair.  Combined with
  // the denser body rings passed by PlayerRig, this is a >3x mesh increase for
  // the featured athlete, while every distant athlete keeps the lighter rig.
  const headSampling = !hi
    ? undefined
    : topology === "ultra"
      ? portrait
        ? { columns: 256, rows: 192 }
        : { columns: 192, rows: 152 }
      : portrait
        ? { columns: 136, rows: 102 }
        : { columns: 80, rows: 68 };
  const head: RigPart[] = [
    rigPart(sculptedHead(P, look.seed, hi, portrait, headSampling), mats.skin, undefined, true),
  ];
  const face: RigPart[] = [],
    eyes: RigPart[] = [],
    jaw: RigPart[] = [],
    eyelidUpperL: RigPart[] = [],
    eyelidLowerL: RigPart[] = [],
    eyelidUpperR: RigPart[] = [],
    eyelidLowerR: RigPart[] = [],
    hair: RigPart[] = [],
    hairSecondary: RigPart[] = [];
  const R = P.headR;
  const f = faceMorphology(look.seed);
  // These are shared-detail cache entries. Keeping their identities stable
  // folds matching landmarks together instead of allocating one material or
  // draw per nostril, fold, ring or catchlight.
  const eyeWhite = eyeWhiteMaterial(hi);
  const iris = irisMaterial(look.eyeColor, hi);
  const pupil = pupilMaterial();
  const skinDetail = skinDetailMaterial(look.skin, hi);
  for (const side of [-1, 1]) {
    head.push(rigPart(sculptedEar(P, side, hi, portrait), mats.skin, undefined, true));
    const x = side * P.headW * f.eyeSpacing,
      y = R * (0.14 + side * f.eyeAsymmetry - (portrait ? f.eyeOpening * 0.05 : 0));
    const socketZ = faceSurfaceZ(P, x, y, look.seed);
    const z = socketZ + R * 0.026;
    // Keep the exported dome's measurement contract intact, then sink its
    // portrait instance into the eyelid aperture. The old placement put the
    // full corneal convexity ahead of both lids, reading as a marble glued to
    // the face in the Studio close-up.
    // Recess sclera, cornea, limbus and pupil together: moving only the lens
    // behind the old sclera would hide its rim and leave white eye patches.
    // The shallow ensemble lets orbital tissue settle into the face quickly.
    // An adult iris is taller than the relaxed opening: the attached lids
    // hide its upper/lower arcs instead of presenting a fully exposed marble.
    const irisRadius = R * 0.058;
    const irisGeometry = irisDome(P, x, y, look.seed, irisRadius);
    irisGeometry.translate(0, 0, -R * 0.028);
    const limbus = new THREE.TorusGeometry(irisRadius, R * 0.0011, hi ? 5 : 4, hi ? 18 : 12);
    const limbusPosition = limbus.getAttribute("position");
    for (let i = 0; i < limbusPosition.count; i++) {
      const px = limbusPosition.getX(i),
        py = limbusPosition.getY(i);
      limbusPosition.setZ(
        i,
        limbusPosition.getZ(i) + faceSurfaceZ(P, x + px, y + py, look.seed) - socketZ,
      );
    }
    limbus.computeVertexNormals();
    // The pupil also follows the local socket curvature. A flat disk whose
    // centre clears the dome can still disappear along one edge on a face
    // with a deeper socket or a broader nasal bridge.
    const pupilGeometry = new THREE.CircleGeometry(R * 0.0205, hi ? 18 : 12);
    const pupilPosition = pupilGeometry.getAttribute("position");
    for (let i = 0; i < pupilPosition.count; i++) {
      const px = pupilPosition.getX(i),
        py = pupilPosition.getY(i);
      pupilPosition.setZ(i, faceSurfaceZ(P, x + px, y + py, look.seed) - socketZ);
    }
    pupilGeometry.computeVertexNormals();
    face.push(rigPart(eyePatch(P, side, look.seed, portrait), eyeWhite));
    eyes.push(
      rigPart(irisGeometry, iris),
      // A limbal ring keeps a small iris legible in the ordinary match
      // camera, where the old flat eye read as a single dark pixel.
      rigPart(limbus, pupil, {
        position: [x, y, socketZ + R * 0.013],
      }),
      rigPart(pupilGeometry, pupil, {
        position: [x, y, z],
      }),
      // A small physical catchlight is intentionally geometry instead of a
      // painted texture: it follows the animated eye bone and works with all
      // skin/eye combinations, including the medium detail model.
      rigPart(new THREE.SphereGeometry(R * 0.0019, hi ? 8 : 6, hi ? 6 : 5), eyeWhite, {
        position: [x - side * R * 0.011, y + R * 0.011, socketZ + R * 0.029],
        scale: [1, 1, 0.36],
      }),
    );
    const upperLid = eyelidSurface(P, side, look.seed, true, portrait);
    const lowerLid = eyelidSurface(P, side, look.seed, false, portrait);
    const upperPivot = eyelidPivot(P, side, look.seed, true);
    const lowerPivot = eyelidPivot(P, side, look.seed, false);
    // Vertices move into their own hinge space. The matching bone restores
    // this exact location in bind pose, then rotates a real orbital flap.
    upperLid.translate(-upperPivot.x, -upperPivot.y, -upperPivot.z);
    lowerLid.translate(-lowerPivot.x, -lowerPivot.y, -lowerPivot.z);
    const upperParts = side > 0 ? eyelidUpperL : eyelidUpperR;
    const lowerParts = side > 0 ? eyelidLowerL : eyelidLowerR;
    upperParts.push(rigPart(upperLid, mats.skin));
    lowerParts.push(rigPart(lowerLid, mats.skin));
    // Eyelids and eyebrows now have fitted surfaces. Do not allocate the
    // abandoned tube paths or resample all their face landmarks at startup.
    const browGeometry = eyebrowSurface(P, side, look.seed);
    const detailMaterial = skinDetail as THREE.MeshStandardMaterial;
    const browColor = new THREE.Color(look.hairColor);
    const browSkin = new THREE.Color(skinAlbedo(look.skin));
    const browColors = new Float32Array(browGeometry.getAttribute("position").count * 3);
    const browUv = browGeometry.getAttribute("uv");
    for (let i = 0; i < browColors.length; i += 3) {
      const u = browUv.getX(i / 3),
        v = browUv.getY(i / 3);
      const edge = Math.max(
        THREE.MathUtils.smoothstep(Math.abs(v * 2 - 1), 0.3, 1),
        THREE.MathUtils.smoothstep(Math.abs(u * 2 - 1), 0.72, 1),
      );
      const skinBlend = 0.15 + edge * 0.85;
      browColors[i] =
        THREE.MathUtils.lerp(browColor.r, browSkin.r, skinBlend) /
        Math.max(0.001, detailMaterial.color.r);
      browColors[i + 1] =
        THREE.MathUtils.lerp(browColor.g, browSkin.g, skinBlend) /
        Math.max(0.001, detailMaterial.color.g);
      browColors[i + 2] =
        THREE.MathUtils.lerp(browColor.b, browSkin.b, skinBlend) /
        Math.max(0.001, detailMaterial.color.b);
    }
    browGeometry.setAttribute("color", new THREE.BufferAttribute(browColors, 3));
    face.push(rigPart(browGeometry, detailMaterial));
    // A recessed oval opening reads as a nostril; the old projected sphere
    // made two charcoal beads sit on the end of the nose in close-up.
    const nx = f.noseDeviation * P.headW + side * R * f.noseWidth * 0.76,
      ny = -R * 0.25;
    face.push(
      rigPart(new THREE.CircleGeometry(R * 0.0155, hi ? 10 : 7), skinDetail, {
        position: [nx, ny, faceSurfaceZ(P, nx, ny, look.seed) + R * 0.0045],
        scale: [1.28, 0.54, 1],
      }),
    );
  }
  face.push(
    rigPart(lipPatch(P, look.seed, false), mats.skin),
    rigPart(relaxedMouthCrease(P, look.seed), mats.skin),
  );
  // The integrated head surface already sculpts nasolabial folds and philtrum.
  // Overlay tubes intersected the skin and left dotted seams in close-ups.
  jaw.push(
    rigPart(mouthInterior(P, look.seed), pupil, {
      // Match the lower lip's authored face-space offset before the jaw bone
      // rotates, so it remains recessed behind the lips at rest.
      position: [0, R * 0.18, P.headD * 0.26],
    }),
    rigPart(lipPatch(P, look.seed, true), mats.skin, {
      // The hinge is behind the lower face; keep the authored lip in its rest
      // position while opening the jaw around that anatomical pivot.
      position: [0, R * 0.18, P.headD * 0.26],
    }),
  );
  if (hi && look.earring)
    face.push(
      rigPart(new THREE.SphereGeometry(R * 0.041, 8, 8), goldMaterial(), {
        position: [P.headW * 1.006, -R * 0.22, R * 0.005],
      }),
    );

  if (look.beard !== "none") {
    const moustache = look.beard === "moustache";
    const beard = sculptedBeard(P, look, hi);
    // The skull already contributes the macro shadow. Fine beard fibres do
    // not need their own shadow-map draw, which keeps a fully accessorized
    // portrait athlete inside the hero draw budget.
    hair.push(rigPart(beard, beardMaterial(look.skin, look.hairColor, look.beard)));
    if (!moustache) {
      hair.push(
        rigPart(
          sculptedMoustache(P, look, hi),
          beardMaterial(look.skin, look.hairColor, look.beard),
        ),
      );
    }
  }
  if (look.hairStyle !== "bald") {
    // The fitted scalp remains fully lit in the beauty pass. Its thin shell
    // does not need to duplicate the head silhouette in the shadow map.
    hair.push(
      rigPart(
        sculptedHair(
          P,
          look,
          hi,
          !hi
            ? undefined
            : topology === "ultra"
              ? portrait
                ? { columns: 256, rows: 160 }
                : { columns: 224, rows: 136 }
              : portrait
                ? { columns: 128, rows: 80 }
                : { columns: 96, rows: 56 },
        ),
        look.hairStyle === "buzz" ? mats.skin : mats.hair,
      ),
    );
    if (look.hairStyle === "bun")
      hair.push(
        rigPart(
          portrait ? gatheredBun(R * 0.3, look.seed) : new THREE.SphereGeometry(R * 0.3, 12, 10),
          mats.hair,
          { position: [0, R * 0.48, -R * 0.91], scale: [1, 0.88, 0.8] },
          true,
        ),
      );
    if (look.hairStyle === "ponytail")
      (hi ? hairSecondary : hair).push(
        rigPart(
          (portrait ? fittedHairLock : curve)(
            [
              new THREE.Vector3(0, R * 0.37, -R * 0.92),
              new THREE.Vector3(0, 0, -R * 1.19),
              new THREE.Vector3(R * 0.09, -R * 0.6, -R * 1.2),
            ],
            R * 0.115,
            12,
            "ponytail",
          ),
          mats.hair,
        ),
      );
    if (look.hairStyle === "mohawk")
      hair.push(
        rigPart(
          portrait ? fittedMohawk(P, look.seed) : new THREE.SphereGeometry(R * 0.75, 14, 12),
          mats.hair,
          portrait ? undefined : { position: [0, R * 0.91, -R * 0.1], scale: [0.18, 0.43, 1.12] },
          true,
        ),
      );
    if (look.hairStyle === "dreads" || look.hairStyle === "braids") {
      const rng = makeLookRng(look.seed);
      const lockCount = hi ? 18 : 12;
      for (let i = 0; i < lockCount; i++) {
        let angle = ((i + 0.5) / lockCount) * Math.PI * 2;
        const frontal = Math.cos(angle) > 0.4;
        if (frontal) angle = Math.sign(Math.sin(angle)) * (0.95 + Math.abs(Math.sin(angle)) * 0.25);
        const p = headPoint(P, 0.7, angle, look.seed);
        const end = p
          .clone()
          .setY(-R * (0.35 + rng() * (frontal ? 0.22 : 0.6)))
          .multiply(new THREE.Vector3(1.1, 1, 1.08));
        const strand = (portrait ? fittedHairLock : curve)(
          [
            p,
            p
              .clone()
              .multiplyScalar(1.09)
              .setY(R * 0.15),
            end,
          ],
          R * 0.055,
          9,
          look.hairStyle,
        );
        // The scalp mask fades its hairline, but must not cut an open slice
        // through the circumference of a tubular lock using that same atlas.
        const strandUv = strand.getAttribute("uv");
        if (!portrait)
          for (let vertex = 0; vertex < strandUv.count; vertex++)
            strandUv.setY(vertex, 0.16 + strandUv.getY(vertex) * 0.68);
        (hi ? hairSecondary : hair).push(rigPart(strand, mats.hair));
      }
    }
    if (look.headband)
      hair.push(
        rigPart(
          new THREE.TorusGeometry(R * 0.91, R * 0.038, 6, 24),
          headbandMaterial(look.headbandColor),
          {
            position: [0, R * 0.39, -R * 0.025],
            rotation: [Math.PI / 2, 0, 0],
            scale: [P.headW / R, 1, P.headD / R],
          },
        ),
      );
  }
  return {
    head,
    face,
    eyes,
    jaw,
    eyelidUpperL,
    eyelidLowerL,
    eyelidUpperR,
    eyelidLowerR,
    hair,
    hairSecondary,
  };
}
