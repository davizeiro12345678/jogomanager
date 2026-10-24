import * as THREE from "three";
import type { PlayerLook, Proportions } from "../player-model";

import { faceMorphology, skinAlbedo } from "../player-morphology";

// Chin, jaw angle, cheekbones, temples and crown. Radii are interpolated
// into ONE surface; the face is no longer a pile of intersecting spheres.
export const HEAD_PROFILE = [
  [-1.14, 0.012, 0.012, 0.2],
  // Carry the mandibular body into the chin instead of collapsing the last
  // three rings into a pointed mask. Keep the seeded jaw variation and taper,
  // while broadening its continuous attachment to the upper neck.
  [-1.08, 0.34, 0.36, 0.17],
  [-0.96, 0.59, 0.55, 0.12],
  [-0.78, 0.75, 0.69, 0.075],
  [-0.52, 0.8, 0.76, 0.035],
  [-0.25, 0.85, 0.86, -0.005],
  [0, 0.9, 0.92, -0.045],
  [0.24, 0.87, 0.9, -0.038],
  [0.48, 0.84, 0.86, -0.025],
  [0.7, 0.8, 0.81, -0.035],
  [0.9, 0.66, 0.67, -0.055],
  [1.06, 0.37, 0.39, -0.065],
  [1.14, 0.006, 0.006, -0.07],
] as const;

export function profile(y: number) {
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

/** Render-only spans preserve the seeded identity and centre landmarks. */
export const MOUTH_SPAN = 1.12;

export const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

// Concentrate vertices around eyes, nose and mouth; the back of the skull
// needs fewer samples. This adds detail without multiplying every head ring.
export const headAngle = (u: number) => u * Math.PI * 2 - Math.sin(u * Math.PI * 2) * 0.6;

/** The hair shell and a few portrait-only roots need the same irregular,
 * receded hairline.  Sharing this curve prevents a strand from floating under
 * the fitted scalp when a player changes style in the studio. */
export function fittedHairlineY(
  angle: number,
  face: ReturnType<typeof faceMorphology>,
  detail: boolean,
  style?: PlayerLook["hairStyle"],
) {
  const front = Math.max(0, Math.cos(angle));
  const temples = Math.abs(Math.sin(angle));
  const edgeNoise = detail
    ? 0.012 * Math.sin(angle * 11 + face.parting * 2.7) +
      0.004 * Math.sin(angle * 23 - face.parting * 4.1)
    : 0;
  const line =
    -0.385 +
    // Pull the frontal edge back slightly further than the temples. That
    // exposes a forehead plane instead of forming a heavy close-up fringe.
    0.03 * front ** 3 +
    (0.925 + face.hairline) * front ** 0.92 +
    0.12 * temples ** 6 +
    0.078 * temples ** 5.5 * front +
    // Preserve the seeded frontal hairline while turning the temple above the ear.
    0.3 * temples ** 4 +
    0.09 * temples ** 2 * front ** 0.7 -
    0.022 * Math.cos(angle * 3 + face.parting) +
    edgeNoise * front ** 3;
  if (style !== "short" && style !== "medium") return line;
  // Broad, seeded temporal recesses and a displaced forelock interrupt the
  // continuous bowl rim. The old microscopic noise could not change the
  // silhouette at a normal portrait distance.
  const signed = Math.atan2(Math.sin(angle), Math.cos(angle));
  const sweepSide = face.parting < 0 ? -1 : 1;
  const recess = 0.075 * Math.exp(-(((Math.abs(signed) - 0.73) / 0.28) ** 2));
  const fringe = 0.05 * Math.exp(-(((signed - sweepSide * 0.2) / 0.4) ** 2));
  return line + (recess - fringe) * front ** 2;
}

/** The same surface sampler positions facial details and the fitted hair. */
export type HeadShape = Pick<Proportions, "headR" | "headW" | "headD">;

export function faceRing(y: number, seed: number) {
  const ring = profile(y);
  return shapeFaceRing(ring, y, faceMorphology(seed));
}

function shapeFaceRing(
  ring: ReturnType<typeof profile>,
  y: number,
  face: ReturnType<typeof faceMorphology>,
) {
  ring.width *=
    1 +
    (face.jaw - 1) * Math.exp(-(((y + 0.74) / 0.28) ** 2)) +
    (face.chinWidth - 1) * Math.exp(-(((y + 0.99) / 0.145) ** 2)) +
    (face.cheek - 1) * Math.exp(-(((y + 0.06) / 0.36) ** 2)) +
    (face.temple - 1) * Math.exp(-(((y - 0.5) / 0.25) ** 2));
  ring.depth *= 1 + (face.cranialDepth - 1) * Math.exp(-(((y - 0.16) / 0.85) ** 2));
  return ring;
}

export function headPoint(
  P: HeadShape,
  y: number,
  angle: number,
  seed = 0,
  target = new THREE.Vector3(),
) {
  return sampleHeadPoint(P, y, angle, faceMorphology(seed), target);
}

/** Construction-scoped scratch is never retained by a mesh or shared across rigs. */
function sampleHeadPoint(
  P: HeadShape,
  y: number,
  angle: number,
  f: ReturnType<typeof faceMorphology>,
  out: THREE.Vector3,
  sampledRing?: ReturnType<typeof profile>,
) {
  const ringHeight = THREE.MathUtils.clamp(y, -1.14, 1.14);
  const ring = sampledRing ?? shapeFaceRing(profile(ringHeight), ringHeight, f);
  const x = Math.sin(angle) * ring.width;
  const front = Math.max(0, Math.cos(angle));
  // Facial relief has exactly zero weight on the back of the skull. Avoid
  // evaluating its Gaussian fields for those samples, including the four
  // finite-difference normal samples at every vertex. The continuous ring
  // remains identical and still supplies the fitted rear scalp/hair surface.
  if (front === 0)
    return out.set(
      x * P.headW,
      y * P.headR,
      (ring.center + Math.cos(angle) * ring.depth) * P.headD,
    );
  const noseX = x - f.noseDeviation;
  // Separate bridge, tip and alar cartilages read as an adult nose in a
  // three-quarter portrait.  The previous single round gaussian made the
  // centre of every face look like the same soft button.
  const noseBridge = f.noseProjection * 0.44 * gauss(noseX, y, 0, -0.005, f.noseWidth * 1.3, 0.36);
  const noseTip = f.noseProjection * 0.65 * gauss(noseX, y, 0, -0.225, f.noseWidth * 1.2, 0.16);
  const alar =
    0.047 * gauss(Math.abs(noseX), y, f.noseWidth * 1.05, -0.265, 0.09, 0.105) +
    0.018 * gauss(Math.abs(noseX), y, f.noseWidth * 0.7, -0.32, 0.08, 0.085);
  const nasalRoot = -0.018 * gauss(noseX, y, 0, 0.22, f.noseWidth * 0.8, 0.12);
  const columella = 0.005 * gauss(noseX, y, 0, -0.34, f.noseWidth * 0.6, 0.12);
  const nose = noseBridge + noseTip + alar + nasalRoot + columella;
  const sockets =
    -0.04 *
    (gauss(x, y, f.eyeSpacing, 0.14, 0.215, 0.155) +
      gauss(x, y, -f.eyeSpacing, 0.14, 0.215, 0.155));
  const brows =
    0.04 *
    (gauss(x, y, f.eyeSpacing, 0.27, 0.26, 0.12) + gauss(x, y, -f.eyeSpacing, 0.27, 0.26, 0.12));
  const cheeks =
    0.07 *
    (gauss(x, y, 0.49, -0.06, 0.33, 0.25) * (1 + f.cheekAsymmetry) +
      gauss(x, y, -0.49, -0.06, 0.33, 0.25) * (1 - f.cheekAsymmetry));
  // The maxilla supports the upper lip all the way from the nasal base.
  // A narrow muzzle and deep philtrum left a pinched shadow under the tip.
  const muzzle = 0.05 * gauss(x, y, 0, -0.44, 0.4, 0.23);
  const philtrum = -0.005 * gauss(x, y, 0, -0.39, 0.075, 0.1);
  // Resting vermilion belongs to the continuous facial surface. Separate
  // projected upper/lower patches plus a tube seam formed three lit bars.
  // Their seeded width and tilt are retained; the patches now only pigment
  // this soft rolled tissue and the jaw still drives the lower face.
  const mouthT = x / ((P.headR / P.headW) * f.mouthWidth * MOUTH_SPAN);
  const mouthEnvelope = Math.max(0, 1 - mouthT * mouthT) ** 1.3;
  const mouthSeam = -0.498 + 0.01 * (1 - mouthT * mouthT) + mouthT * f.mouthTilt;
  const lipVolume =
    mouthEnvelope *
    (0.006 * Math.exp(-(((y - mouthSeam - 0.023) / 0.03) ** 2)) +
      0.009 * Math.exp(-(((y - mouthSeam + 0.03) / 0.038) ** 2)) -
      0.0025 * Math.exp(-(((y - mouthSeam) / 0.015) ** 2)));
  const chin = 0.052 * f.chinProjection * gauss(x, y, 0, -0.85, 0.35 * f.chinWidth, 0.18);
  // Soft tissue turns around the muzzle; a narrow deep trench reads as an
  // incised puppet cheek in grazing light rather than a relaxed adult fold.
  const nasolabial = -0.005 * gauss(Math.abs(x), y, 0.305, -0.43, 0.11, 0.21);
  const lipFossa = -0.009 * gauss(x, y, 0, -0.66, 0.3, 0.085);
  const temples = -0.025 * gauss(Math.abs(x), y, 0.75, 0.28, 0.13, 0.25);
  const lowerOrbit = -0.006 * gauss(Math.abs(x), y, f.eyeSpacing, -0.005, 0.24, 0.105);
  // Broad masseter tissue bridges cheek and jaw. Narrow isolated bumps made
  // the lower face look pinched under stadium side light.
  const jawAngle = 0.029 * gauss(Math.abs(x), y, 0.66, -0.7, 0.2, 0.22);
  const masseter = 0.025 * gauss(Math.abs(x), y, 0.63, -0.47, 0.27, 0.29);
  // A broad zygomatic shelf turning into a shallow buccal plane reads in
  // grazing stadium light without engraving a fold into the mouth corners.
  const zygomatic = 0.018 * gauss(Math.abs(x), y, 0.52, 0.015, 0.23, 0.13);
  const buccal = -0.018 * gauss(Math.abs(x), y, 0.52, -0.34, 0.22, 0.23);
  return out.set(
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
          lipVolume +
          chin +
          nasolabial +
          lipFossa +
          temples +
          lowerOrbit +
          jawAngle +
          masseter +
          zygomatic +
          buccal)) *
      P.headD,
  );
}

export function gridSurface(
  columns: number,
  rows: number,
  point: (u: number, v: number, column: number, row: number) => THREE.Vector3,
  normals: "triangles" | "surface" = "triangles",
) {
  const vertexCount = (rows + 1) * (columns + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const indices =
    vertexCount - 1 >= 65535
      ? new Uint32Array(rows * columns * 6)
      : new Uint16Array(rows * columns * 6);
  let vertex = 0;
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows,
        p = point(u, v, col, row);
      positions[vertex * 3] = p.x;
      positions[vertex * 3 + 1] = p.y;
      positions[vertex * 3 + 2] = p.z;
      uv[vertex * 2] = u;
      uv[vertex * 2 + 1] = v;
      vertex++;
    }
  let index = 0;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col,
        b = a + columns + 1;
      indices[index++] = a;
      indices[index++] = a + 1;
      indices[index++] = b;
      indices[index++] = a + 1;
      indices[index++] = b + 1;
      indices[index++] = b;
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (normals === "triangles") geometry.computeVertexNormals();
  else
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3),
    );
  return geometry;
}

/** Continuous linear skin pigment/contact field shared by the skull and its
 * attached tissues. Author once in head space so a lid/lip cannot become a
 * pale sticker where its own pigment fades out. No texture or frame cost. */
export function headComplexion(
  P: HeadShape,
  pointX: number,
  pointY: number,
  pointZ: number,
  out: THREE.Color,
) {
  const x = pointX / P.headW;
  const y = pointY / P.headR;
  const front = Math.max(0, pointZ / P.headD);
  // Subtle blood flow in cheeks/nose, cooler sockets and warmer temples.
  // Baked linear multipliers preserve every skin tone and add no draw calls.
  const cheek = Math.exp(-(((Math.abs(x) - 0.52) / 0.25) ** 2) - ((y + 0.18) / 0.28) ** 2);
  const nose = Math.exp(-((x / 0.17) ** 2) - ((y + 0.24) / 0.18) ** 2);
  const socket = Math.exp(-(((Math.abs(x) - 0.35) / 0.2) ** 2) - ((y - 0.09) / 0.18) ** 2);
  // Keep cheek variation visible on the retained narrower main skull,
  // including the low-resolution facial rings, without darkening the nose.
  const warmth = (cheek * 0.0565 + nose * 0.035) * Math.min(1, front);
  const nasalFold = gauss(Math.abs(x), y, 0.18, -0.28, 0.06, 0.09);
  const philtrum = gauss(x, y, 0, -0.37, 0.045, 0.075);
  const chinFossa = gauss(x, y, 0, -0.67, 0.26, 0.055);
  const shade =
    (socket * 0.1 + nasalFold * 0.028 + philtrum * 0.035 + chinFossa * 0.027) * Math.min(1, front);
  return out.setRGB(1 - shade, 1 - shade - warmth, 1 - shade - warmth * 1.3);
}

// Geometry construction is CPU-heavy but identical for the same seeded shape.
// Keep only a few immutable source geometries: every caller gets a deep clone,
// so mutating/disposal of a rig cannot affect a different rig or a later frame.
const HEAD_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();
const HAIR_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();
const MAX_CACHED_SURFACES = 6;

function surfaceFromCache(cache: Map<string, THREE.BufferGeometry>, key: string) {
  const source = cache.get(key);
  if (!source) return null;
  cache.delete(key);
  cache.set(key, source); // bounded LRU; recent roster/portrait variants survive
  return source.clone();
}

function rememberSurface(cache: Map<string, THREE.BufferGeometry>, key: string, surface: THREE.BufferGeometry) {
  cache.set(key, surface.clone()); // caller owns the original geometry
  if (cache.size > MAX_CACHED_SURFACES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.get(oldest)?.dispose();
      cache.delete(oldest);
    }
  }
  return surface;
}

export function sculptedHead(
  P: HeadShape,
  seed = 0,
  detail = true,
  portrait = true,
  sampling?: { columns: number; rows: number },
) {
  const columns = sampling?.columns ?? (detail ? (portrait ? 136 : 80) : 18);
  const rows = sampling?.rows ?? (detail ? (portrait ? 102 : 68) : 20);
  const key = `head:${P.headR}:${P.headW}:${P.headD}:${seed}:${columns}:${rows}`;
  const cached = surfaceFromCache(HEAD_GEOMETRY_CACHE, key);
  if (cached) return cached;
  // Around twice the original triangles, with rows concentrated over the
  // same seeded face shape so the brow, cheeks, nose and jaw gain real contour
  // instead of uniform, unused density at the back of the skull.
  const morphology = faceMorphology(seed);
  const sample = new THREE.Vector3();
  // Every angular vertex on a row uses the same seeded skull ring. Keep
  // these scalar rings for this construction only, including the two normal
  // derivative heights, rather than reinterpolating the profile per angle.
  const rings = new Map<number, ReturnType<typeof profile>>();
  const pointAt = (height: number, angle: number, out: THREE.Vector3) => {
    const ringHeight = THREE.MathUtils.clamp(height, -1.14, 1.14);
    let ring = rings.get(ringHeight);
    if (!ring) {
      ring = shapeFaceRing(profile(ringHeight), ringHeight, morphology);
      rings.set(ringHeight, ring);
    }
    return sampleHeadPoint(P, height, angle, morphology, out, ring);
  };
  const geometry = gridSurface(
    columns,
    rows,
    (u, v) => {
      // Keep more rows across the eye line, nose and cheeks, where the sculpt
      // actually bends the surface; spend fewer at the smooth crown and nape.
      const centered = v * 2 - 1;
      const faceWeighted = centered * (0.7 + centered * centered * 0.3);
      return pointAt(faceWeighted * 1.14, headAngle(u), sample);
    },
    "surface",
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
  const opposite = new THREE.Vector3();
  const epsilon = 0.0005;
  const complexion = new Float32Array(positions.count * 3);
  const pigment = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const angle = headAngle(uv.getX(i)),
      height = positions.getY(i) / P.headR;
    tangentAngle
      .copy(pointAt(height, angle + epsilon, sample))
      .sub(pointAt(height, angle - epsilon, opposite));
    tangentHeight
      .copy(pointAt(height + epsilon, angle, sample))
      .sub(pointAt(height - epsilon, angle, opposite));
    surfaceNormal.crossVectors(tangentAngle, tangentHeight).normalize();
    normal.setXYZ(i, surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
    headComplexion(P, positions.getX(i), positions.getY(i), positions.getZ(i), pigment);
    complexion[i * 3] = pigment.r;
    complexion[i * 3 + 1] = pigment.g;
    complexion[i * 3 + 2] = pigment.b;
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
  return rememberSurface(HEAD_GEOMETRY_CACHE, key, geometry);
}

function sweptCropFlow(angle: number, v: number, parting: number) {
  return (
    angle -
    parting * 0.42 +
    (1 - v) * 1.2 +
    Math.sin(angle * 3 + v * 5 + parting) * 0.12 * Math.sin(v * Math.PI)
  );
}

/** Fitted hairline with a tapered fade, directional locks and matte volume. */
export function sculptedHair(
  P: HeadShape,
  look: PlayerLook,
  detail = true,
  sampling?: { columns: number; rows: number },
) {
  const style = look.hairStyle;
  const sweptCrop = style === "short" || style === "medium";
  const f = faceMorphology(look.seed);
  const sample = new THREE.Vector3();
  const columns = sampling?.columns ?? (detail ? 120 : 18);
  const rows = sampling?.rows ?? (detail ? 72 : 10);
  const key = `hair:${P.headR}:${P.headW}:${P.headD}:${look.seed}:${style}:${look.skin}:${look.hairColor}:${detail}:${columns}:${rows}`;
  const cached = surfaceFromCache(HAIR_GEOMETRY_CACHE, key);
  if (cached) return cached;
  // Hairline and angular fields depend on the column, never its height.
  // Compute them once for this shell, with the same double-precision u as
  // gridSurface, rather than repeating their trigonometry along every row.
  const partAngle = f.parting * 0.42;
  const columnSamples = Array.from({ length: columns + 1 }, (_, column) => {
    const angle = headAngle(column / columns);
    const front = Math.max(0, Math.cos(angle));
    const temples = Math.abs(Math.sin(angle));
    const wrappedPart = Math.atan2(Math.sin(angle - partAngle), Math.cos(angle - partAngle));
    return {
      angle,
      front,
      hairline: fittedHairlineY(angle, f, detail, style),
      wrappedPart,
      templeTaper: 1 - front * temples ** 1.35 * (style === "afro" ? 0.1 : 0.36),
    };
  });
  const geometry = gridSurface(
    // Spend the extra vertices on close athletes only. The scalp is one
    // continuous surface, so strand relief below does not add meshes/draws.
    columns,
    rows,
    (_u, v, column) => {
      const { angle, front, hairline, wrappedPart, templeTaper } = columnSamples[column]!;
      const y = hairline + (1.14 - hairline) * v;
      const p = sampleHeadPoint(P, y, angle, f, sample);
      // A shaved cut is scalp stubble, not a short hairstyle with the same
      // swept forelock. Keep the shared seeded head and a submillimetre shell.
      if (style === "buzz") return p.multiplyScalar(1.002);
      const minimumRadius = Math.hypot(p.x, p.z) + P.headR * 0.006;
      const fade = THREE.MathUtils.smoothstep(v, 0, 0.22);
      const textured = style === "curly" || style === "afro";
      const volume =
        style === "braids" || style === "mohawk"
          ? 0.008
          : style === "afro"
            ? 0.31
            : style === "curly"
              ? 0.115
              : style === "medium"
                ? 0.15
                : style === "short"
                  ? 0.085
                  : 0.024;
      const strands = detail
        ? textured
          ? 0.026 * Math.sin(angle * 17 + v * 37) * Math.sin(v * 31 - angle * 11) +
            0.007 * Math.sin(angle * 31 + v * 54 + f.parting * 4)
          : (style === "braids" ? 0.001 : 0.006) *
            Math.sin(angle * 9 + v * 5 + f.parting * 3) *
            Math.sin(v * Math.PI)
        : 0;
      // Taper the frontal temples and cut a shallow, seeded part through the
      // crown.  A uniform inflated sphere is what made short hair read as a
      // plastic helmet in the portrait camera.
      const crown = THREE.MathUtils.smoothstep(v, 0.16, 0.88);
      const partGroove =
        detail && !textured ? 0.009 * Math.exp(-((wrappedPart / 0.28) ** 2)) * crown : 0;
      // Only broad locks belong in geometry. Fine frequencies above the
      // angular grid's Nyquist limit made metallic-looking saw teeth; fibre
      // maps supply that scale without aliasing the silhouette or normals.
      const grainFade = detail ? fade * THREE.MathUtils.smoothstep(v, 0.08, 0.3) : 0;
      const grainFlow = sweptCrop
        ? sweptCropFlow(angle, v, f.parting)
        : angle - partAngle + (1 - v) * (textured ? 0.16 : 0.65);
      const cropped = style === "braids" || style === "mohawk";
      const grain =
        textured || cropped
          ? 0
          : grainFade *
            (0.012 * Math.cos(grainFlow * 12 + v * 2) +
              0.003 * Math.cos(grainFlow * 24 + v * 3 + f.parting));
      const foreheadInset =
        style === "afro" ? 0 : 0.004 * front ** 2 * THREE.MathUtils.smoothstep(v, 0.12, 0.72);
      // Uneven broad locks break the profile silhouette without adding fibre
      // cards. Frequencies fit inside the existing angular grid; envelope
      // vanishes at the hairline and crown so the fitted seam stays closed.
      const clump =
        detail && (style === "short" || style === "medium")
          ? 0.055 * Math.sin(sweptCropFlow(angle, v, f.parting) * 5 + v * 7) * Math.sin(v * Math.PI)
          : 0;
      const shell =
        1 +
        Math.max(
          0.004,
          0.007 +
            grain +
            clump +
            (volume * look.hairVolume + strands) *
              fade *
              templeTaper *
              (sweptCrop ? 1 - 0.58 * (1 - front ** 2) * Math.sin(v * Math.PI) : 1) -
            partGroove -
            foreheadInset,
        );
      p.x *= shell;
      p.z *= shell;
      // A swept forelock and flatter temples break the uniform cap contour.
      const forelock = cropped
        ? 0
        : front ** 3 * Math.sin(v * Math.PI) * ((sweptCrop ? 0.15 : 0.055) + f.parting * 0.02);
      // Lift and sweep a broad crown mass rather than engraving deep regular
      // ridges into a fitted cap. Fibre maps still provide the small strands.
      const sweep =
        style === "short" || style === "medium"
          ? 0.095 * Math.sin(angle - partAngle) * front * Math.sin(v * Math.PI)
          : 0;
      const ordinaryLift =
        volume * (0.18 + crown * 0.32) * fade + forelock * fade + sweep * fade + clump * 0.65;
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
  if (style === "buzz") {
    const uv = geometry.getAttribute("uv"),
      positions = geometry.getAttribute("position");
    const skin = new THREE.Color(skinAlbedo(look.skin)),
      pigment = new THREE.Color(look.hairColor);
    const colors = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      const grain = Math.sin(u * Math.PI * 74) * Math.sin(v * 49 + u * 13) * 0.035;
      const density = THREE.MathUtils.smoothstep(v, 0, 0.19) * (0.58 + grain);
      const target = skin.clone().lerp(pigment, density);
      colors.set(
        [
          target.r / Math.max(0.001, skin.r),
          target.g / Math.max(0.001, skin.g),
          target.b / Math.max(0.001, skin.b),
        ],
        i * 3,
      );
      // Reuse the head's skin material and pore-map scale, including the
      // nonuniform axial sampling; no hair material, alpha map or new draw.
      const y = positions.getY(i) / (P.headR * 1.002);
      let centered = y / 1.14;
      for (let step = 0; step < 4; step++)
        centered -=
          (centered * (0.7 + centered * centered * 0.3) - y / 1.14) /
          (0.7 + centered * centered * 0.9);
      uv.setXY(i, u, (centered + 1) * 0.5);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  } else if (detail) {
    const uv = geometry.getAttribute("uv");
    const colors = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) {
      const angle = headAngle(uv.getX(i));
      const v = uv.getY(i);
      const flow = sweptCrop
        ? sweptCropFlow(angle, v, f.parting)
        : angle - f.parting * 0.42 + (1 - v) * 0.65;
      const locks =
        (Math.cos(flow * 12 + v * 2) + Math.cos(flow * 24 + v * 3 + f.parting) * 0.3) / 1.3;
      const root = (1 - THREE.MathUtils.smoothstep(v, 0, 0.23)) * 0.11;
      const clumpTone =
        style === "short" || style === "medium"
          ? Math.sin(sweptCropFlow(angle, v, f.parting) * 5 + v * 7) * Math.sin(v * Math.PI) * 0.075
          : 0;
      const tone = 0.94 + locks * 0.105 + clumpTone - root;
      colors[i * 3] = tone;
      colors[i * 3 + 1] = tone * 0.99;
      colors[i * 3 + 2] = tone * 0.97;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  // This UV seam runs through the centre of the forehead. The duplicated
  // vertices share positions but their independently averaged normals used
  // to put a hard illuminated stripe down otherwise continuous hair/scalp.
  const normals = geometry.getAttribute("normal");
  const average = new THREE.Vector3();
  for (let start = 0; start < normals.count; start += columns + 1) {
    const end = start + columns;
    average
      .set(
        normals.getX(start) + normals.getX(end),
        normals.getY(start) + normals.getY(end),
        normals.getZ(start) + normals.getZ(end),
      )
      .normalize();
    normals.setXYZ(start, average.x, average.y, average.z);
    normals.setXYZ(end, average.x, average.y, average.z);
  }
  return rememberSurface(HAIR_GEOMETRY_CACHE, key, geometry);
}
