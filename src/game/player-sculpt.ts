import * as THREE from "three";
import type { PlayerLook, Proportions } from "./player-model";
import { makeLookRng } from "./player-model";
import { faceMorphology } from "./player-morphology";
import type { PlayerMaterials } from "./player-materials";
import { rigPart, type RigPart } from "./rig-geometry";
import {
  beardMaterial,
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
  [-1.08, 0.3, 0.36, 0.16],
  [-0.96, 0.55, 0.54, 0.105],
  [-0.78, 0.67, 0.65, 0.078],
  [-0.52, 0.74, 0.75, 0.045],
  [-0.25, 0.9, 0.9, -0.005],
  [0, 0.94, 0.96, -0.045],
  [0.24, 0.9, 0.93, -0.038],
  [0.48, 0.84, 0.86, -0.02],
  [0.7, 0.77, 0.76, -0.032],
  [0.9, 0.62, 0.59, -0.06],
  [1.06, 0.36, 0.35, -0.065],
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

function faceRing(y: number, seed: number) {
  const ring = profile(y);
  const face = faceMorphology(seed);
  ring.width *=
    1 +
    (face.jaw - 1) * Math.exp(-(((y + 0.74) / 0.28) ** 2)) +
    (face.cheek - 1) * Math.exp(-(((y + 0.06) / 0.36) ** 2)) +
    (face.temple - 1) * Math.exp(-(((y - 0.5) / 0.25) ** 2));
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
  const noseBridge = f.noseProjection * 0.35 * gauss(noseX, y, 0, -0.005, f.noseWidth * 0.58, 0.36);
  const noseTip = f.noseProjection * 0.74 * gauss(noseX, y, 0, -0.21, f.noseWidth * 0.9, 0.13);
  const alar =
    0.052 *
    (gauss(Math.abs(noseX), y, f.noseWidth * 0.78, -0.235, 0.055, 0.07) +
      gauss(Math.abs(noseX), y, f.noseWidth * 0.58, -0.305, 0.045, 0.055));
  const nasalRoot = -0.027 * gauss(noseX, y, 0, 0.22, f.noseWidth * 0.72, 0.1);
  const columella = 0.022 * gauss(noseX, y, 0, -0.33, f.noseWidth * 0.42, 0.075);
  const nose = noseBridge + noseTip + alar + nasalRoot + columella;
  const sockets =
    -0.078 *
    (gauss(x, y, f.eyeSpacing, 0.14, 0.215, 0.155) +
      gauss(x, y, -f.eyeSpacing, 0.14, 0.215, 0.155));
  const brows =
    0.032 *
    (gauss(x, y, f.eyeSpacing, 0.31, 0.24, 0.09) + gauss(x, y, -f.eyeSpacing, 0.31, 0.24, 0.09));
  const cheeks =
    0.054 *
    (gauss(x, y, 0.5, -0.11, 0.3, 0.2) * (1 + f.cheekAsymmetry) +
      gauss(x, y, -0.5, -0.11, 0.3, 0.2) * (1 - f.cheekAsymmetry));
  const muzzle = 0.032 * gauss(x, y, 0, -0.49, 0.32, 0.14);
  const philtrum = -0.024 * gauss(x, y, 0, -0.365, 0.042, 0.065);
  const chin = 0.045 * gauss(x, y, 0, -0.85, 0.28, 0.15);
  const nasolabial = -0.022 * gauss(Math.abs(x), y, 0.305, -0.43, 0.058, 0.19);
  const lipFossa = -0.016 * gauss(x, y, 0, -0.66, 0.3, 0.06);
  const temples = -0.025 * gauss(Math.abs(x), y, 0.75, 0.28, 0.13, 0.25);
  const lowerOrbit = -0.019 * gauss(Math.abs(x), y, f.eyeSpacing, -0.005, 0.2, 0.042);
  const jawAngle = 0.022 * gauss(Math.abs(x), y, 0.65, -0.7, 0.12, 0.14);
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
          jawAngle)) *
      P.headD,
  );
}

export function faceSurfaceZ(P: Proportions, x: number, y: number, seed = 0) {
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
  const columns = sampling?.columns ?? (detail ? (portrait ? 96 : 56) : 18);
  const geometry = gridSurface(
    columns,
    sampling?.rows ?? (detail ? (portrait ? 72 : 48) : 20),
    (u, v) => headPoint(P, -1.14 + v * 2.28, headAngle(u), seed),
  );
  // Average the duplicated UV seam rather than leaving a visible stripe.
  const normal = geometry.getAttribute("normal");
  const positions = geometry.getAttribute("position");
  const complexion = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / P.headW;
    const y = positions.getY(i) / P.headR;
    const front = Math.max(0, positions.getZ(i) / P.headD);
    // Subtle blood flow in cheeks/nose, cooler sockets and warmer temples.
    // Baked linear multipliers preserve every skin tone and add no draw calls.
    const cheek = Math.exp(-(((Math.abs(x) - 0.52) / 0.25) ** 2) - ((y + 0.18) / 0.28) ** 2);
    const nose = Math.exp(-((x / 0.17) ** 2) - ((y + 0.24) / 0.18) ** 2);
    const socket = Math.exp(-(((Math.abs(x) - 0.35) / 0.2) ** 2) - ((y - 0.09) / 0.18) ** 2);
    const warmth = (cheek * 0.055 + nose * 0.035) * Math.min(1, front);
    const shade = socket * 0.06 * Math.min(1, front);
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
  return gridSurface(
    sampling?.columns ?? (detail ? 56 : 18),
    sampling?.rows ?? (detail ? 28 : 10),
    (u, v) => {
      const angle = headAngle(u);
      const front = Math.max(0, Math.cos(angle));
      const temples = Math.abs(Math.sin(angle));
      const hairline = fittedHairlineY(angle, f, detail);
      const y = hairline + (1.14 - hairline) * v;
      const p = headPoint(P, y, angle, look.seed);
      const minimumRadius = Math.hypot(p.x, p.z) + P.headR * 0.024;
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
                : 0.024;
      const strands = detail
        ? textured
          ? 0.022 * Math.sin(angle * 17 + v * 37) * Math.sin(v * 31 - angle * 11)
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
      const templeTaper = 1 - front * temples ** 1.35 * (style === "afro" ? 0.1 : 0.36);
      const foreheadInset =
        style === "afro" ? 0 : 0.018 * front ** 2 * THREE.MathUtils.smoothstep(v, 0.12, 0.72);
      const shell =
        1 +
        Math.max(
          0.004,
          0.007 +
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
          (style === "short" || style === "medium" ? 0.018 * front * v * (1 - v) * 4 : 0));
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
}

function curve(points: THREE.Vector3[], radius: number, segments = 14) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false);
}

function eyePatch(P: Proportions, side: number, seed: number) {
  const f = faceMorphology(seed);
  // An almond shaped lens fitted into the socket; no protruding eyeball.
  return gridSurface(20, 6, (u, v) => {
    const t = u * 2 - 1;
    const aperture = Math.sin(u * Math.PI) ** 0.78;
    const x = P.headW * side * f.eyeSpacing + t * P.headW * f.eyeWidth * 0.82;
    const y =
      P.headR * (0.14 + side * f.eyeAsymmetry + side * t * 0.012) +
      aperture * P.headR * (v - 0.5) * f.eyeOpening * 0.49;
    return new THREE.Vector3(
      x,
      y,
      faceSurfaceZ(P, x, y, seed) +
        // The sclera sits in the socket. The corneal dome can then project
        // naturally without turning the whole eye into a white marble.
        P.headR * (0.011 + aperture * Math.sin(v * Math.PI) * 0.019),
    );
  });
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

function lipPatch(P: Proportions, seed: number, lower: boolean) {
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
        P.headR * (0.004 + arch * Math.sin(v * Math.PI) * (f.lipVolume + (lower ? 0.008 : 0.003))),
    );
  });
  const color = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let i = 0; i < color.length; i += 3) {
    const v = geometry.getAttribute("uv").getY(i / 3);
    const pigment = Math.sin(v * Math.PI) * (lower ? 0.15 : 0.19);
    // The material stays the player's skin material, so this remains valid
    // across every complexion. The multiplier gives the vermilion border and
    // lower-lip hydration enough contrast to survive the studio close-up.
    color[i] = lower ? 0.98 : 0.91;
    color[i + 1] = 0.86 - pigment;
    color[i + 2] = 0.82 - pigment * 0.72;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  return geometry;
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
    const y = P.headR * (-0.497 + t * f.mouthTilt + (v - 0.5) * arch * 0.082);
    return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.0025);
  });
}

/** Facial hair follows the jaw and cheek landmarks with a separate chin
 * volume. The softened texture border uses the same UVs in every detail tier. */
export function sculptedBeard(P: HeadShape, look: PlayerLook, detail = true) {
  const moustache = look.beard === "moustache";
  const full = look.beard === "full";
  const geometry = gridSurface(detail ? 40 : 16, detail ? 18 : 8, (u, v) => {
    const angle = (u - 0.5) * (moustache ? 0.65 : look.beard === "goatee" ? 0.78 : 3.02);
    const side = Math.abs(Math.sin(angle));
    const bottom = moustache ? -0.42 : -1.075 + side * 0.12;
    // A smooth, tapered cheek line with a restrained seeded break-up avoids
    // the ruler-straight mask that made every beard look painted on.
    const edge = detail
      ? Math.sin(angle * 7 + (look.seed % 31)) * 0.005 +
        Math.sin(angle * 17 - (look.seed % 19)) * 0.002
      : 0;
    const cheekRise = full ? 0.245 * side ** 2.25 : 0.205 * side ** 2.1;
    const top = moustache ? -0.285 : -0.47 + cheekRise + edge;
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
  // Blend the upper beard into the complexion rather than a hard mask edge.
  const base = new THREE.Color(look.skin),
    hairTone = new THREE.Color(look.hairColor);
  const color = new Float32Array(geometry.getAttribute("position").count * 3);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const edge = THREE.MathUtils.smoothstep(uv.getY(i), 0.73, 1) * 0.82;
    for (let c = 0; c < 3; c++) {
      const skin = c === 0 ? base.r : c === 1 ? base.g : base.b;
      const hair = c === 0 ? hairTone.r : c === 1 ? hairTone.g : hairTone.b;
      color[i * 3 + c] =
        1 + edge * (Math.min(5, skin / Math.max(0.04, hair * 0.8 + skin * 0.2)) - 1);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  return geometry;
}

/** Orbital tissue overlaps the limbus; a flat white eye patch alone reads as paint. */
export function eyelidSurface(P: Proportions, side: number, seed: number, upper: boolean) {
  const f = faceMorphology(seed);
  const geometry = gridSurface(24, 4, (u, v) => {
    const t = u * 2 - 1,
      arch = Math.max(0.012, Math.sin(u * Math.PI) ** 0.8);
    const x = P.headW * (side * f.eyeSpacing + t * f.eyeWidth);
    const rim = f.eyeOpening * (upper ? 0.255 : 0.24);
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
      (upper ? 1 : -1) * (f.eyeOpening * (upper ? 0.255 : 0.24) + (upper ? 0.044 : 0.028)));
  return new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, seed) + P.headR * 0.028);
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
) {
  const head: RigPart[] = [
    rigPart(sculptedHead(P, look.seed, hi, portrait), mats.skin, undefined, true),
  ];
  const face: RigPart[] = [],
    eyes: RigPart[] = [],
    jaw: RigPart[] = [],
    eyelidUpperL: RigPart[] = [],
    eyelidLowerL: RigPart[] = [],
    eyelidUpperR: RigPart[] = [],
    eyelidLowerR: RigPart[] = [],
    hair: RigPart[] = [];
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
    const z = faceSurfaceZ(P, x, y, look.seed) + R * 0.04;
    // Keep the exported dome's measurement contract intact, then sink its
    // portrait instance into the eyelid aperture. The old placement put the
    // full corneal convexity ahead of both lids, reading as a marble glued to
    // the face in the Studio close-up.
    const irisGeometry = irisDome(P, x, y, look.seed, R * 0.035);
    irisGeometry.translate(0, 0, -R * 0.014);
    face.push(rigPart(eyePatch(P, side, look.seed), eyeWhite));
    eyes.push(
      rigPart(irisGeometry, iris),
      // A limbal ring keeps a small iris legible in the ordinary match
      // camera, where the old flat eye read as a single dark pixel.
      rigPart(new THREE.TorusGeometry(R * 0.035, R * 0.0022, hi ? 5 : 4, hi ? 18 : 12), pupil, {
        position: [x, y, faceSurfaceZ(P, x, y, look.seed) + R * 0.041],
      }),
      rigPart(new THREE.CircleGeometry(R * 0.014, hi ? 18 : 12), pupil, {
        position: [x, y, z],
      }),
      // A small physical catchlight is intentionally geometry instead of a
      // painted texture: it follows the animated eye bone and works with all
      // skin/eye combinations, including the medium detail model.
      rigPart(new THREE.SphereGeometry(R * 0.0058, hi ? 8 : 6, hi ? 6 : 5), eyeWhite, {
        position: [
          x - side * R * 0.011,
          y + R * 0.011,
          faceSurfaceZ(P, x, y, look.seed) + R * 0.045,
        ],
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
    const upper: THREE.Vector3[] = [],
      lower: THREE.Vector3[] = [],
      brow: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        px = x + (t * 2 - 1) * P.headW * f.eyeWidth;
      const tilt = side * (t * 2 - 1) * R * 0.012;
      const py = y + tilt + Math.sin(t * Math.PI) ** 0.8 * R * f.eyeOpening * 0.45;
      upper.push(new THREE.Vector3(px, py, faceSurfaceZ(P, px, py, look.seed) + R * 0.023));
      const ly = y + tilt - Math.sin(t * Math.PI) ** 0.8 * R * f.eyeOpening * 0.45;
      lower.push(new THREE.Vector3(px, ly, faceSurfaceZ(P, px, ly, look.seed) + R * 0.02));
      const by =
        R *
        (0.3 + side * f.browAsymmetry + Math.sin(t * Math.PI) * 0.023 + side * (t - 0.5) * 0.03);
      brow.push(new THREE.Vector3(px, by, faceSurfaceZ(P, px, by, look.seed) + R * 0.007));
    }
    const browGeometry = eyebrowSurface(P, side, look.seed);
    const detailMaterial = skinDetail as THREE.MeshStandardMaterial;
    const browColor = new THREE.Color(look.hairColor);
    const browColors = new Float32Array(browGeometry.getAttribute("position").count * 3);
    for (let i = 0; i < browColors.length; i += 3) {
      browColors[i] = Math.min(2, browColor.r / Math.max(0.01, detailMaterial.color.r));
      browColors[i + 1] = Math.min(2, browColor.g / Math.max(0.01, detailMaterial.color.g));
      browColors[i + 2] = Math.min(2, browColor.b / Math.max(0.01, detailMaterial.color.b));
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
    rigPart(curve(lips, R * 0.00235, hi ? 16 : 10), skinDetail),
  );
  // Nasolabial folds and the philtrum are restrained enough for the pitch
  // camera, but break the mask-like transition from nose to mouth in closeups.
  for (const side of [-1, 1]) {
    const noseX = f.noseDeviation * P.headW + side * R * f.noseWidth * 0.88;
    const cheekX = side * R * (f.mouthWidth * 0.72 + 0.09);
    const startY = -R * 0.225;
    const endY = -R * (0.43 - f.mouthTilt * side);
    face.push(
      rigPart(
        curve(
          [
            new THREE.Vector3(noseX, startY, faceSurfaceZ(P, noseX, startY, look.seed) + R * 0.008),
            new THREE.Vector3(
              cheekX,
              -R * 0.32,
              faceSurfaceZ(P, cheekX, -R * 0.32, look.seed) + R * 0.0065,
            ),
            new THREE.Vector3(
              side * R * f.mouthWidth * 0.88,
              endY,
              faceSurfaceZ(P, side * R * f.mouthWidth * 0.88, endY, look.seed) + R * 0.006,
            ),
          ],
          R * 0.0045,
          hi ? 12 : 8,
        ),
        skinDetail,
      ),
    );
  }
  const philtrumY = -R * 0.385;
  face.push(
    rigPart(
      curve(
        [
          new THREE.Vector3(
            f.noseDeviation * P.headW,
            -R * 0.305,
            faceSurfaceZ(P, f.noseDeviation * P.headW, -R * 0.305, look.seed) + R * 0.007,
          ),
          new THREE.Vector3(
            f.noseDeviation * P.headW * 0.78,
            philtrumY,
            faceSurfaceZ(P, f.noseDeviation * P.headW * 0.78, philtrumY, look.seed) + R * 0.007,
          ),
        ],
        R * 0.0035,
        hi ? 9 : 6,
      ),
      skinDetail,
    ),
  );
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
    head.push(
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
      const points = [];
      for (let i = 0; i <= 10; i++) {
        const x = ((i / 10) * 2 - 1) * R * 0.22,
          y = -R * (0.345 + Math.abs(i / 10 - 0.5) * 0.12);
        points.push(new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, look.seed) + R * 0.014));
      }
      hair.push(
        rigPart(curve(points, R * 0.016), beardMaterial(look.skin, look.hairColor, look.beard)),
      );
    }
  }
  if (look.hairStyle !== "bald") {
    // The fitted scalp remains fully lit in the beauty pass. Its thin shell
    // does not need to duplicate the head silhouette in the shadow map.
    hair.push(rigPart(sculptedHair(P, look, hi), mats.hair));
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
      hair.push(
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
          undefined,
          true,
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
      for (let i = 0; i < 12; i++) {
        let angle = ((i + 0.5) / 12) * Math.PI * 2;
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
        hair.push(rigPart(strand, mats.hair, undefined, true));
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
  };
}
