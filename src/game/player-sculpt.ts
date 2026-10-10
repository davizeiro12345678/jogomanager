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

// Chin, jaw angle, cheekbones, temples and crown. Radii are interpolated
// into ONE surface; the face is no longer a pile of intersecting spheres.
const HEAD_PROFILE = [
  [-1.14, 0.012, 0.012, 0.2],
  // A narrower jaw and a gently recessed lower face prevent the portrait
  // silhouette from becoming a round toy head while retaining enough volume
  // for strong and wide athlete variants.
  [-1.08, 0.31, 0.36, 0.17],
  [-0.96, 0.57, 0.54, 0.12],
  [-0.78, 0.72, 0.67, 0.075],
  [-0.52, 0.78, 0.74, 0.035],
  [-0.25, 0.85, 0.86, -0.005],
  [0, 0.9, 0.92, -0.045],
  [0.24, 0.87, 0.9, -0.038],
  [0.48, 0.84, 0.86, -0.025],
  [0.7, 0.8, 0.81, -0.035],
  [0.9, 0.66, 0.67, -0.055],
  [1.06, 0.37, 0.39, -0.065],
  [1.14, 0.006, 0.006, -0.07],
] as const;

function profile(y: number) {
  const row = Math.max(0, HEAD_PROFILE.findIndex((r) => r[0] >= y) - 1);
  const a = HEAD_PROFILE[row]!;
  const b = HEAD_PROFILE[Math.min(row + 1, HEAD_PROFILE.length - 1)]!;
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  // Catmull-Rom tangents give smooth cheeks without a ledge at every ring.
  const previous = HEAD_PROFILE[Math.max(0, row - 1)]!;
  const next = HEAD_PROFILE[Math.min(HEAD_PROFILE.length - 1, row + 2)]!;
  const sample = (column: 1 | 2 | 3) => {
    const span = b[0] - a[0];
    const m0 = (b[column] - previous[column]) / (b[0] - previous[0]);
    const m1 = (next[column] - a[column]) / (next[0] - a[0]);
    return (
      (2 * t * t * t - 3 * t * t + 1) * a[column] +
      (t * t * t - 2 * t * t + t) * span * m0 +
      (-2 * t * t * t + 3 * t * t) * b[column] +
      (t * t * t - t * t) * span * m1
    );
  };
  return {
    width: Math.max(0.006, sample(1)),
    depth: Math.max(0.006, sample(2)),
    center: sample(3),
  };
}

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

// Concentrate vertices around eyes, nose and mouth; the back of the skull
// needs fewer samples. This adds detail without multiplying every head ring.
const headAngle = (u: number) => u * Math.PI * 2 - Math.sin(u * Math.PI * 2) * 0.6;

/** The hair shell and a few portrait-only roots need the same irregular,
 * receded hairline.  Sharing this curve prevents a strand from floating under
 * the fitted scalp when a player changes style in the studio. */
function fittedHairlineY(angle: number, face: ReturnType<typeof faceMorphology>, detail: boolean) {
  const front = Math.max(0, Math.cos(angle));
  const temples = Math.abs(Math.sin(angle));
  const edgeNoise = detail
    ? 0.012 * Math.sin(angle * 11 + face.parting * 2.7) +
      0.004 * Math.sin(angle * 23 - face.parting * 4.1)
    : 0;
  return (
    -0.385 +
    // Pull the frontal edge back slightly further than the temples. That
    // exposes a forehead plane instead of forming a heavy close-up fringe.
    0.055 * front ** 3 +
    (0.925 + face.hairline) * front ** 1.72 +
    0.078 * temples ** 5.5 * front -
    0.022 * Math.cos(angle * 3 + face.parting) +
    edgeNoise * front ** 3
  );
}

/** The same surface sampler positions facial details and the fitted hair. */
type HeadShape = Pick<Proportions, "headR" | "headW" | "headD">;

/**
 * The stored facial landmarks describe the athlete and must remain stable for
 * existing saves.  The portrait renderer applies this small presentation
 * transform only when it builds the visible orbital surfaces: it keeps the
 * individual spacing while giving a relaxed adult eye aperture instead of
 * exposing a large, toy-like sclera in a studio close-up.
 */
function renderedEyeMetrics(face: ReturnType<typeof faceMorphology>) {
  return {
    width: face.eyeWidth * 0.91,
    opening: face.eyeOpening * 0.82,
  };
}

function faceRing(y: number, seed: number) {
  const ring = profile(y);
  const face = faceMorphology(seed);
  ring.width *=
    1 +
    (face.jaw - 1) * Math.exp(-(((y + 0.74) / 0.28) ** 2)) +
    (face.chinWidth - 1) * Math.exp(-(((y + 0.99) / 0.145) ** 2)) +
    (face.cheek - 1) * Math.exp(-(((y + 0.06) / 0.36) ** 2)) +
    (face.temple - 1) * Math.exp(-(((y - 0.5) / 0.25) ** 2));
  ring.depth *= 1 + (face.cranialDepth - 1) * Math.exp(-(((y - 0.16) / 0.85) ** 2));
  return ring;
}

export function headPoint(P: HeadShape, y: number, angle: number, seed = 0) {
  const ring = faceRing(THREE.MathUtils.clamp(y, -1.14, 1.14), seed);
  const f = faceMorphology(seed);
  const x = Math.sin(angle) * ring.width;
  const front = Math.max(0, Math.cos(angle));
  const noseX = x - f.noseDeviation;
  // Separate bridge, tip and alar cartilages read as an adult nose in a
  // three-quarter portrait.  The previous single round gaussian made the
  // centre of every face look like the same soft button.
  const noseBridge = f.noseProjection * 0.6 * gauss(noseX, y, 0, -0.005, f.noseWidth * 0.5, 0.34);
  const noseTip = f.noseProjection * 0.72 * gauss(noseX, y, 0, -0.215, f.noseWidth * 0.72, 0.1);
  const alar =
    0.041 *
    (gauss(Math.abs(noseX), y, f.noseWidth * 0.72, -0.235, 0.045, 0.063) +
      gauss(Math.abs(noseX), y, f.noseWidth * 0.54, -0.3, 0.038, 0.05));
  const nasalRoot = -0.031 * gauss(noseX, y, 0, 0.22, f.noseWidth * 0.62, 0.1);
  const columella = 0.018 * gauss(noseX, y, 0, -0.33, f.noseWidth * 0.36, 0.07);
  const nose = noseBridge + noseTip + alar + nasalRoot + columella;
  const sockets =
    -0.078 *
    (gauss(x, y, f.eyeSpacing, 0.14, 0.215, 0.155) +
      gauss(x, y, -f.eyeSpacing, 0.14, 0.215, 0.155));
  const brows =
    0.05 *
    (gauss(x, y, f.eyeSpacing, 0.31, 0.24, 0.09) + gauss(x, y, -f.eyeSpacing, 0.31, 0.24, 0.09));
  const cheeks =
    0.052 *
    (gauss(x, y, 0.5, -0.11, 0.3, 0.2) * (1 + f.cheekAsymmetry) +
      gauss(x, y, -0.5, -0.11, 0.3, 0.2) * (1 - f.cheekAsymmetry));
  const muzzle = 0.021 * gauss(x, y, 0, -0.49, 0.3, 0.13);
  const philtrum = -0.024 * gauss(x, y, 0, -0.365, 0.042, 0.065);
  const chin = 0.048 * f.chinProjection * gauss(x, y, 0, -0.85, 0.28 * f.chinWidth, 0.14);
  const nasolabial = -0.022 * gauss(Math.abs(x), y, 0.305, -0.43, 0.058, 0.19);
  const lipFossa = -0.016 * gauss(x, y, 0, -0.66, 0.3, 0.06);
  const temples = -0.025 * gauss(Math.abs(x), y, 0.75, 0.28, 0.13, 0.25);
  const lowerOrbit = -0.019 * gauss(Math.abs(x), y, f.eyeSpacing, -0.005, 0.2, 0.042);
  const jawAngle = 0.026 * gauss(Math.abs(x), y, 0.66, -0.7, 0.13, 0.15);
  const masseter = 0.018 * gauss(Math.abs(x), y, 0.64, -0.48, 0.16, 0.18);
  return new THREE.Vector3(
    x * P.headW,
    y * P.headR,
    (ring.center +
      (front > 0 ? front ** 0.88 : Math.cos(angle)) * ring.depth +
      front ** 4 *
        (nose +
          sockets +
          brows +
          cheeks +
          muzzle +
          philtrum +
          chin +
          nasolabial +
          lipFossa +
          temples +
          lowerOrbit +
          jawAngle +
          masseter)) *
      P.headD,
  );
}

export function faceSurfaceZ(P: HeadShape, x: number, y: number, seed = 0) {
  const ring = faceRing(y / P.headR, seed);
  const angle = Math.asin(THREE.MathUtils.clamp(x / (P.headW * ring.width), -0.999, 0.999));
  return headPoint(P, y / P.headR, angle, seed).z;
}

function gridSurface(
  columns: number,
  rows: number,
  point: (u: number, v: number) => THREE.Vector3,
) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows,
        p = point(u, v);
      positions.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col,
        b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function sculptedHead(
  P: HeadShape,
  seed = 0,
  detail = true,
  portrait = true,
  sampling?: { columns: number; rows: number },
) {
  // Around twice the original triangles, with rows concentrated over the
  // same seeded face shape so the brow, cheeks, nose and jaw gain real contour
  // instead of uniform, unused density at the back of the skull.
  const columns = sampling?.columns ?? (detail ? (portrait ? 136 : 80) : 18);
  const geometry = gridSurface(
    columns,
    sampling?.rows ?? (detail ? (portrait ? 102 : 68) : 20),
    (u, v) => {
      // Keep more rows across the eye line, nose and cheeks, where the sculpt
      // actually bends the surface; spend fewer at the smooth crown and nape.
      const centered = v * 2 - 1;
      const faceWeighted = centered * (0.7 + centered * centered * 0.3);
      return headPoint(P, faceWeighted * 1.14, headAngle(u), seed);
    },
  );
  // Sample the normal from the continuous sculpt instead of averaging the
  // surrounding triangle planes. The concentrated orbital grid has unequal
  // triangle areas; area-weighted normals made cheek and bridge lighting
  // depend on topology, especially when switching portrait/detail density.
  // This preserves every position/index and smooths the existing surface.
  const normal = geometry.getAttribute("normal");
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const tangentAngle = new THREE.Vector3(),
    tangentHeight = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const epsilon = 0.0005;
  const complexion = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const angle = headAngle(uv.getX(i)),
      height = positions.getY(i) / P.headR;
    tangentAngle
      .copy(headPoint(P, height, angle + epsilon, seed))
      .sub(headPoint(P, height, angle - epsilon, seed));
    tangentHeight
      .copy(headPoint(P, height + epsilon, angle, seed))
      .sub(headPoint(P, height - epsilon, angle, seed));
    surfaceNormal.crossVectors(tangentAngle, tangentHeight).normalize();
    normal.setXYZ(i, surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
    const x = positions.getX(i) / P.headW;
    const y = positions.getY(i) / P.headR;
    const front = Math.max(0, positions.getZ(i) / P.headD);
    // Subtle blood flow in cheeks/nose, cooler sockets and warmer temples.
    // Baked linear multipliers preserve every skin tone and add no draw calls.
    const cheek = Math.exp(-(((Math.abs(x) - 0.52) / 0.25) ** 2) - ((y + 0.18) / 0.28) ** 2);
    const nose = Math.exp(-((x / 0.17) ** 2) - ((y + 0.24) / 0.18) ** 2);
    const socket = Math.exp(-(((Math.abs(x) - 0.35) / 0.2) ** 2) - ((y - 0.09) / 0.18) ** 2);
    const warmth = (cheek * 0.055 + nose * 0.035) * Math.min(1, front);
    const nasalFold = gauss(Math.abs(x), y, 0.18, -0.28, 0.06, 0.09);
    const philtrum = gauss(x, y, 0, -0.37, 0.045, 0.075);
    const chinFossa = gauss(x, y, 0, -0.67, 0.26, 0.055);
    const shade =
      (socket * 0.06 + nasalFold * 0.028 + philtrum * 0.035 + chinFossa * 0.027) *
      Math.min(1, front);
    complexion.set([1 - shade, 1 - shade - warmth, 1 - shade - warmth * 1.3], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(complexion, 3));
  for (let a = 0; a < normal.count; a += columns + 1) {
    const b = a + columns;
    const n = new THREE.Vector3(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, n.x, n.y, n.z);
    normal.setXYZ(b, n.x, n.y, n.z);
  }
  return geometry;
}

/** Fitted hairline with a tapered fade, directional locks and matte volume. */
export function sculptedHair(
  P: HeadShape,
  look: PlayerLook,
  detail = true,
  sampling?: { columns: number; rows: number },
) {
  const style = look.hairStyle;
  const f = faceMorphology(look.seed);
  const geometry = gridSurface(
    // Spend the extra vertices on close athletes only. The scalp is one
    // continuous surface, so strand relief below does not add meshes/draws.
    sampling?.columns ?? (detail ? 120 : 18),
    sampling?.rows ?? (detail ? 72 : 10),
    (u, v) => {
      const angle = headAngle(u);
      const front = Math.max(0, Math.cos(angle));
      const temples = Math.abs(Math.sin(angle));
      const hairline = fittedHairlineY(angle, f, detail);
      const y = hairline + (1.14 - hairline) * v;
      const p = headPoint(P, y, angle, look.seed);
      // Clear the skin by a fraction of a millimetre. A constant radial
      // inflation at the pole turned the crown into a blunt helmet rim.
      const minimumRadius = Math.hypot(p.x, p.z) + P.headR * 0.003 * Math.sin(v * Math.PI);
      const fade = THREE.MathUtils.smoothstep(v, 0, 0.22);
      const textured = style === "curly" || style === "afro";
      const volume =
        style === "buzz" || style === "braids" || style === "mohawk"
          ? 0.008
          : style === "afro"
            ? 0.31
            : style === "curly"
              ? 0.115
              : style === "medium"
                ? 0.07
                : 0.016;
      const strands = detail
        ? textured
          ? 0.026 * Math.sin(angle * 17 + v * 37) * Math.sin(v * 31 - angle * 11) +
            0.007 * Math.sin(angle * 31 + v * 54 + f.parting * 4)
          : (style === "buzz" || style === "braids" ? 0.004 : 0.017) *
            Math.sin(angle * 19 + v * 9 + f.parting * 3) *
            Math.sin(v * Math.PI)
        : 0;
      // Taper the frontal temples and cut a shallow, seeded part through the
      // crown.  A uniform inflated sphere is what made short hair read as a
      // plastic helmet in the portrait camera.
      const crown = THREE.MathUtils.smoothstep(v, 0.16, 0.88);
      const partAngle = f.parting * 0.42;
      const wrappedPart = Math.atan2(Math.sin(angle - partAngle), Math.cos(angle - partAngle));
      const partGroove =
        detail && !textured && style !== "buzz"
          ? 0.024 * Math.exp(-((wrappedPart / 0.28) ** 2)) * crown
          : 0;
      // Directional lock relief is carved into the scalp shell itself. A
      // broad clump and two finer fibers catch the key light as separate
      // strands while preserving the single batched hair mesh.
      const grainFade = detail ? fade * THREE.MathUtils.smoothstep(v, 0.08, 0.3) : 0;
      const grainFlow = angle - partAngle + (1 - v) * (textured ? 0.16 : 0.3);
      const grain = textured
        ? 0
        : grainFade *
          (0.0075 * Math.cos(grainFlow * 34) +
            0.003 * Math.cos(grainFlow * 71 + v * 5) +
            0.009 * Math.cos(grainFlow * 15 + v * 2) +
            0.0025 * Math.cos(grainFlow * 108 + v * 9 + f.parting));
      const templeTaper = 1 - front * temples ** 1.35 * (style === "afro" ? 0.1 : 0.36);
      const foreheadInset =
        style === "afro" ? 0 : 0.018 * front ** 2 * THREE.MathUtils.smoothstep(v, 0.12, 0.72);
      const shell =
        1 +
        Math.max(
          0.004,
          0.007 +
            grain +
            (volume * look.hairVolume + strands) * fade * templeTaper -
            partGroove -
            foreheadInset,
        );
      p.x *= shell;
      p.z *= shell;
      const ordinaryLift = volume * (0.18 + crown * 0.32) * fade;
      const texturedLift = style === "afro" ? volume * fade : volume * fade * 0.68;
      p.y +=
        P.headR *
        ((textured ? texturedLift : ordinaryLift) +
          (style === "short" || style === "medium" ? 0.009 * front * v * (1 - v) * 4 : 0));
      p.x +=
        P.headR * (0.018 + f.parting * 0.028) * Math.sin(v * Math.PI) * front * fade * templeTaper;
      const radius = Math.hypot(p.x, p.z);
      if (radius < minimumRadius && radius > 1e-6) {
        p.x *= minimumRadius / radius;
        p.z *= minimumRadius / radius;
      }
      return p;
    },
  );
  // Directional locks carry their own contact tone. This remains a single
  // opaque hair draw and reads even when fine normal maps are not resident.
  const uv = geometry.getAttribute("uv");
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const angle = headAngle(uv.getX(i));
    const v = uv.getY(i);
    const lock = 0.92 + 0.08 * Math.cos(angle * 15 + (1 - v) * 4 + f.parting);
    const root = 1 - 0.1 * Math.exp(-((v / 0.16) ** 2));
    const value = detail ? lock * root : 1;
    colors.set([value, value, value], i * 3);
  }
  if (detail) geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function curve(points: THREE.Vector3[], radius: number, segments = 14) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false);
}

function eyePatch(P: Proportions, side: number, seed: number) {
  const f = faceMorphology(seed);
  const eye = renderedEyeMetrics(f);
  // An almond shaped lens fitted into the socket; no protruding eyeball.
  const geometry = gridSurface(20, 6, (u, v) => {
    const t = u * 2 - 1;
    const aperture = Math.sin(u * Math.PI) ** 0.78;
    const x = P.headW * (side * f.eyeSpacing + t * eye.width * 0.94);
    const y =
      P.headR * (0.14 + side * f.eyeAsymmetry + side * t * 0.012) +
      // Use the very same rim as the attached lids. The narrower old sclera
      // left a skin gap at its corners and exposed a complete circular iris.
      aperture * P.headR * (v * 0.96 - 0.5) * eye.opening;
    return new THREE.Vector3(
      x,
      y,
      faceSurfaceZ(P, x, y, seed) +
        // The sclera sits in the socket. The corneal dome can then project
        // naturally without turning the whole eye into a white marble.
        P.headR * (0.011 + aperture * Math.sin(v * Math.PI) * 0.019),
    );
  });
  const uv = geometry.getAttribute("uv");
  const color = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const arch = Math.sin(u * Math.PI) ** 0.78;
    // Contact shade and the warm inner corner are baked into the existing
    // sclera. They survive flat fill light without a new occlusion pass/map.
    const shade =
      0.16 * Math.abs(v * 2 - 1) ** 1.4 * arch +
      0.1 * (1 - arch) +
      0.075 * THREE.MathUtils.smoothstep(v, 0.55, 1) * arch;
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
export function sculptedEar(P: Proportions, side: number, detail: boolean) {
  const R = P.headR;
  const ear = gridSurface(detail ? 28 : 12, detail ? 10 : 5, (u, v) => {
    const a = u * Math.PI * 2,
      lobe = Math.max(0, -Math.sin(a));
    const helix = Math.exp(-(((v - 0.82) / 0.14) ** 2));
    const antihelix = Math.exp(-(((v - 0.46) / 0.14) ** 2)) * (0.6 + Math.sin(a) * 0.25);
    const depth = 0.019 + helix * 0.073 + antihelix * v * 0.036 + lobe * v * 0.018;
    return new THREE.Vector3(
      side * (P.headW * 0.925 + R * depth),
      R * (-0.065 + Math.sin(a) * v * (0.215 + lobe * 0.017)),
      R * (-0.025 + Math.cos(a) * v * 0.135),
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
      faceSurfaceZ(P, x, y, seed) +
        // A relaxed lip rolls out of the mouth seam and settles flush into
        // the face. The former half-sine projected by almost the lip's own
        // height, making two bright cylindrical ridges under the key light.
        P.headR *
          (0.0008 +
            arch *
              (0.007 * (1 - v) ** 2 +
                f.lipVolume * (lower ? 0.6 : 0.5) * Math.sin(v * Math.PI) * (1 - v))),
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
  mapHeadSurfaceUv(geometry, P, seed);
  return geometry;
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
    return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.0025);
  });
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
export function eyelidSurface(P: Proportions, side: number, seed: number, upper: boolean) {
  const f = faceMorphology(seed);
  const eye = renderedEyeMetrics(f);
  const geometry = gridSurface(24, 4, (u, v) => {
    const t = u * 2 - 1,
      arch = Math.max(0.012, Math.sin(u * Math.PI) ** 0.8);
    const x = P.headW * (side * f.eyeSpacing + t * eye.width * 0.94);
    const rim = eye.opening * (upper ? 0.46 : 0.5);
    const fold = upper ? 0.044 : 0.028;
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
      faceSurfaceZ(P, x, y, seed) + P.headR * (0.028 + (1 - v) ** 2 * arch * 0.02),
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
  const uv = geometry.getAttribute("uv");
  const color = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const arch = Math.sin(uv.getX(i) * Math.PI) ** 0.8;
    const rim = (1 - THREE.MathUtils.smoothstep(uv.getY(i), 0, 0.75)) * arch * 0.14;
    // A narrow warm waterline connects sclera to skin. The upper fold keeps
    // its contact shade even in the studio's broad ambient fill.
    const crease = upper ? gauss(uv.getY(i), 0, 0.72, 0, 0.18, 1) * arch * 0.035 : 0;
    color.set([1 - rim * 0.45 - crease, 1 - rim - crease, 1 - rim * 1.12 - crease], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
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
  const eye = renderedEyeMetrics(f);
  const x = P.headW * side * f.eyeSpacing;
  const y =
    P.headR *
    (0.14 +
      side * f.eyeAsymmetry +
      (upper ? 1 : -1) * (eye.opening * (upper ? 0.46 : 0.5) + (upper ? 0.044 : 0.028)));
  return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.028);
}

function eyebrowSurface(P: Proportions, side: number, seed: number) {
  const f = faceMorphology(seed);
  const eye = renderedEyeMetrics(f);
  return gridSurface(20, 3, (u, v) => {
    const t = u * 2 - 1;
    const x = P.headW * (side * f.eyeSpacing + t * eye.width * 1.08);
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
) {
  const headSampling = hi
    ? portrait
      ? { columns: 136, rows: 102 }
      : { columns: 80, rows: 68 }
    : undefined;
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
  const skinDetail = skinDetailMaterial(look.skin);
  for (const side of [-1, 1]) {
    head.push(rigPart(sculptedEar(P, side, hi), mats.skin, undefined, true));
    const x = side * P.headW * f.eyeSpacing,
      y = R * (0.14 + side * f.eyeAsymmetry);
    const socketZ = faceSurfaceZ(P, x, y, look.seed);
    const z = socketZ + R * 0.043;
    // Keep the exported dome's measurement contract intact, then sink its
    // portrait instance into the eyelid aperture. The old placement put the
    // full corneal convexity ahead of both lids, reading as a marble glued to
    // the face in the Studio close-up.
    // An adult iris is taller than the relaxed opening. Keep the peripheral
    // cornea underneath the lids, rather than shrinking the iris until the
    // upper/lower lid has nothing to occlude. The recessed rim leaves a
    // compact visible aperture in the studio instead of a toy-like disk.
    const irisRadius = R * 0.064;
    const irisGeometry = irisDome(P, x, y, look.seed, irisRadius);
    irisGeometry.translate(0, 0, -R * 0.014);
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
    const pupilGeometry = new THREE.CircleGeometry(R * 0.0145, hi ? 18 : 12);
    const pupilPosition = pupilGeometry.getAttribute("position");
    for (let i = 0; i < pupilPosition.count; i++) {
      const px = pupilPosition.getX(i),
        py = pupilPosition.getY(i);
      pupilPosition.setZ(i, faceSurfaceZ(P, x + px, y + py, look.seed) - socketZ);
    }
    pupilGeometry.computeVertexNormals();
    face.push(rigPart(eyePatch(P, side, look.seed), eyeWhite));
    eyes.push(
      rigPart(irisGeometry, iris),
      // A limbal ring keeps a small iris legible in the ordinary match
      // camera, where the old flat eye read as a single dark pixel.
      rigPart(limbus, pupil, {
        position: [x, y, socketZ + R * 0.031],
      }),
      rigPart(pupilGeometry, pupil, {
        position: [x, y, z],
      }),
      // A small physical catchlight is intentionally geometry instead of a
      // painted texture: it follows the animated eye bone and works with all
      // skin/eye combinations, including the medium detail model.
      rigPart(new THREE.SphereGeometry(R * 0.0019, hi ? 8 : 6, hi ? 6 : 5), eyeWhite, {
        position: [x - side * R * 0.011, y + R * 0.011, socketZ + R * 0.052],
        scale: [1, 1, 0.36],
      }),
    );
    const upperLid = eyelidSurface(P, side, look.seed, true);
    const lowerLid = eyelidSurface(P, side, look.seed, false);
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
      const skinBlend = 0.075 + edge * 0.925;
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
  const lips: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * 2 - 1,
      x = t * R * f.mouthWidth;
    const y = R * (-0.495 + 0.009 * (1 - t * t) + t * f.mouthTilt);
    lips.push(new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, look.seed) + R * 0.008));
  }
  face.push(
    rigPart(lipPatch(P, look.seed, false), mats.skin),
    rigPart(curve(lips, R * 0.00115, hi ? 16 : 10), skinDetail),
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
          hi ? (portrait ? { columns: 128, rows: 80 } : { columns: 96, rows: 56 }) : undefined,
        ),
        mats.hair,
      ),
    );
    if (look.hairStyle === "bun")
      hair.push(
        rigPart(
          new THREE.SphereGeometry(R * 0.3, 12, 10),
          mats.hair,
          { position: [0, R * 0.48, -R * 0.91], scale: [1, 0.88, 0.8] },
          true,
        ),
      );
    if (look.hairStyle === "ponytail")
      (hi ? hairSecondary : hair).push(
        rigPart(
          curve(
            [
              new THREE.Vector3(0, R * 0.37, -R * 0.92),
              new THREE.Vector3(0, 0, -R * 1.19),
              new THREE.Vector3(R * 0.09, -R * 0.6, -R * 1.2),
            ],
            R * 0.115,
            12,
          ),
          mats.hair,
        ),
      );
    if (look.hairStyle === "mohawk")
      hair.push(
        rigPart(
          new THREE.SphereGeometry(R * 0.75, 14, 12),
          mats.hair,
          { position: [0, R * 0.91, -R * 0.1], scale: [0.18, 0.43, 1.12] },
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
        const strand = curve(
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
        );
        // The scalp mask fades its hairline, but must not cut an open slice
        // through the circumference of a tubular lock using that same atlas.
        const strandUv = strand.getAttribute("uv");
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
