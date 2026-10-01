import * as THREE from "three";
import type { PlayerLook, Proportions } from "./player-model";
import { makeLookRng } from "./player-model";
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
  [-1.08, 0.3, 0.35, 0.19],
  [-0.96, 0.53, 0.53, 0.12],
  [-0.78, 0.71, 0.7, 0.07],
  [-0.52, 0.82, 0.83, 0.015],
  [-0.25, 0.91, 0.9, -0.015],
  [0, 0.94, 0.96, -0.035],
  [0.24, 0.91, 0.94, -0.035],
  [0.48, 0.92, 0.9, -0.025],
  [0.7, 0.85, 0.79, -0.035],
  [0.9, 0.66, 0.62, -0.055],
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

/** The same surface sampler positions facial details and the fitted hair. */
type HeadShape = Pick<Proportions, "headR" | "headW" | "headD">;

export function headPoint(P: HeadShape, y: number, angle: number, seed = 0) {
  const ring = profile(THREE.MathUtils.clamp(y, -1.14, 1.14));
  const x = Math.sin(angle) * ring.width;
  const front = Math.max(0, Math.cos(angle));
  const nose =
    0.27 * gauss(x, y, 0, -0.13, 0.115, 0.16) +
    0.09 * gauss(x, y, 0, 0.1, 0.07, 0.27) +
    0.065 * gauss(x, y, 0, -0.22, 0.2, 0.06);
  const sockets =
    -0.105 * (gauss(x, y, 0.36, 0.14, 0.22, 0.115) + gauss(x, y, -0.36, 0.14, 0.22, 0.115));
  const brows = 0.05 * (gauss(x, y, 0.36, 0.3, 0.26, 0.07) + gauss(x, y, -0.36, 0.3, 0.26, 0.07));
  const cheeks =
    0.04 * (gauss(x, y, 0.54, -0.17, 0.21, 0.2) + gauss(x, y, -0.54, -0.17, 0.21, 0.2));
  const chin = 0.085 * gauss(x, y, 0, -0.88, 0.35, 0.15);
  const variation = 1 + ((seed % 13) - 6) * 0.002;
  return new THREE.Vector3(
    x * P.headW,
    y * P.headR,
    (ring.center +
      Math.cos(angle) * ring.depth +
      front ** 4 * (nose * variation + sockets + brows + cheeks + chin)) *
      P.headD,
  );
}

export function faceSurfaceZ(P: Proportions, x: number, y: number, seed = 0) {
  const ring = profile(y / P.headR);
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

export function sculptedHead(P: HeadShape, seed = 0, detail = true) {
  const columns = detail ? 40 : 18;
  const geometry = gridSurface(columns, detail ? 38 : 20, (u, v) =>
    headPoint(P, -1.14 + v * 2.28, u * Math.PI * 2, seed),
  );
  // Average the duplicated UV seam rather than leaving a visible stripe.
  const normal = geometry.getAttribute("normal");
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
export function sculptedHair(P: HeadShape, look: PlayerLook, detail = true) {
  const style = look.hairStyle;
  return gridSurface(detail ? 40 : 18, detail ? 22 : 10, (u, v) => {
    const angle = u * Math.PI * 2;
    const front = Math.max(0, Math.cos(angle));
    const hairline = -0.38 + 0.94 * front ** 1.6 + 0.02 * Math.sin(angle * 11 + look.seed);
    const y = hairline + (1.14 - hairline) * v;
    const p = headPoint(P, y, angle, look.seed);
    const fade = THREE.MathUtils.smoothstep(v, 0, 0.22);
    const textured = style === "curly" || style === "afro";
    const volume =
      style === "buzz" || style === "braids" || style === "mohawk"
        ? 0.008
        : style === "afro"
          ? 0.28
          : style === "curly"
            ? 0.14
            : style === "medium"
              ? 0.08
              : 0.05;
    const strands = detail
      ? textured
        ? 0.02 * Math.sin(angle * 19 + v * 53) * Math.sin(v * 41 - angle * 13)
        : 0.004 * Math.sin(angle * 58 + v * 17)
      : 0;
    const shell = 1 + (0.008 + (volume * look.hairVolume + strands) * fade);
    p.x *= shell;
    p.z *= shell;
    p.y +=
      P.headR *
      (volume * fade +
        (style === "short" || style === "medium" ? 0.11 * front * v * (1 - v) * 4 : 0));
    p.x += P.headR * 0.045 * Math.sin(v * Math.PI) * front * fade;
    return p;
  });
}

function curve(points: THREE.Vector3[], radius: number, segments = 14) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false);
}

function eyePatch(P: Proportions, side: number, seed: number, blink = false) {
  // An almond shaped lens fitted into the socket; no protruding eyeball.
  return gridSurface(20, 6, (u, v) => {
    const t = u * 2 - 1;
    const x = P.headW * side * 0.36 + t * P.headR * 0.165;
    const y = P.headR * 0.14 + Math.sin(u * Math.PI) * P.headR * (v - 0.5) * 0.13;
    return new THREE.Vector3(
      x,
      blink ? y - P.headR * 0.14 : y,
      faceSurfaceZ(P, x, y, seed) +
        P.headR *
          (0.018 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.025 + (blink ? 0.014 : 0)),
    );
  });
}

export function buildSculptedFace(
  P: Proportions,
  look: PlayerLook,
  mats: PlayerMaterials,
  hi: boolean,
) {
  const head: RigPart[] = [rigPart(sculptedHead(P, look.seed, hi), mats.skin, undefined, true)];
  const face: RigPart[] = [],
    eyes: RigPart[] = [],
    jaw: RigPart[] = [],
    blink: RigPart[] = [],
    hair: RigPart[] = [];
  const R = P.headR;
  for (const side of [-1, 1]) {
    // A single outer ear and its recessed concha replaces duplicate ears.
    head.push(
      rigPart(
        new THREE.SphereGeometry(R * 0.22, hi ? 12 : 8, 10),
        mats.skin,
        { position: [side * P.headW * 0.94, -R * 0.07, -R * 0.025], scale: [0.34, 1, 0.61] },
        true,
      ),
    );
    if (hi)
      face.push(
        rigPart(new THREE.SphereGeometry(R * 0.12, 8, 8), skinDetailMaterial(look.skin), {
          position: [side * P.headW * 1.008, -R * 0.06, R * 0.014],
          scale: [0.15, 1, 0.6],
        }),
      );
    const x = side * P.headW * 0.36,
      y = R * 0.14;
    const z = faceSurfaceZ(P, x, y, look.seed) + R * 0.045;
    face.push(rigPart(eyePatch(P, side, look.seed), eyeWhiteMaterial()));
    eyes.push(
      rigPart(new THREE.SphereGeometry(R * 0.061, 12, 10), irisMaterial(look.eyeColor), {
        position: [x, y, z],
        scale: [1, 1, 0.2],
      }),
      rigPart(new THREE.SphereGeometry(R * 0.027, 10, 8), pupilMaterial(), {
        position: [x, y, z + R * 0.013],
        scale: [1, 1, 0.16],
      }),
    );
    blink.push(rigPart(eyePatch(P, side, look.seed, true), mats.skin));
    const upper: THREE.Vector3[] = [],
      lower: THREE.Vector3[] = [],
      brow: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        px = x + (t * 2 - 1) * R * 0.168;
      const py = y + Math.sin(t * Math.PI) * R * 0.066;
      upper.push(new THREE.Vector3(px, py, faceSurfaceZ(P, px, py, look.seed) + R * 0.023));
      const ly = y - Math.sin(t * Math.PI) * R * 0.064;
      lower.push(new THREE.Vector3(px, ly, faceSurfaceZ(P, px, ly, look.seed) + R * 0.02));
      const by = R * (0.3 + Math.sin(t * Math.PI) * 0.023 + side * (t - 0.5) * 0.03);
      brow.push(new THREE.Vector3(px, by, faceSurfaceZ(P, px, by, look.seed) + R * 0.007));
    }
    face.push(
      rigPart(curve(upper, R * 0.014), mats.skin),
      rigPart(curve(lower, R * 0.009), mats.skin),
      rigPart(curve(brow, R * 0.013), skinDetailMaterial(look.skin)),
    );
    if (hi) {
      const nx = side * R * 0.082,
        ny = -R * 0.225;
      face.push(
        rigPart(new THREE.SphereGeometry(R * 0.027, 8, 8), skinDetailMaterial(look.skin), {
          position: [nx, ny, faceSurfaceZ(P, nx, ny, look.seed) + R * 0.006],
          scale: [1, 0.45, 0.22],
        }),
      );
    }
  }
  const lips: THREE.Vector3[] = [],
    lowerLip: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * 2 - 1,
      x = t * R * 0.24;
    const y = R * (-0.49 + 0.025 * (1 - t * t) - 0.023 * Math.exp(-((t / 0.2) ** 2)));
    lips.push(new THREE.Vector3(x, y, faceSurfaceZ(P, x, y, look.seed) + R * 0.015));
    const ly = -R * (0.525 + (1 - t * t) * 0.009);
    lowerLip.push(new THREE.Vector3(x, ly, faceSurfaceZ(P, x, ly, look.seed) + R * 0.012));
  }
  face.push(rigPart(curve(lips, R * 0.01), skinDetailMaterial(look.skin)));
  jaw.push(
    rigPart(curve(lowerLip, R * 0.015), skinDetailMaterial(look.skin), {
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
    const beard = gridSurface(hi ? 30 : 16, hi ? 14 : 8, (u, v) => {
      const angle = (u - 0.5) * (moustache ? 0.65 : look.beard === "goatee" ? 0.78 : 3.02);
      const side = Math.abs(Math.sin(angle));
      const bottom = moustache ? -0.42 : -1.07 + side * 0.12;
      const top = moustache ? -0.29 : -0.55 + side ** 2 * 0.57;
      const p = headPoint(P, bottom + (top - bottom) * v, angle, look.seed);
      const thickness = look.beard === "full" ? 0.014 : 0.002;
      p.x *= 1 + thickness;
      p.z += R * (thickness + 0.005);
      return p;
    });
    hair.push(
      rigPart(beard, beardMaterial(look.skin, look.hairColor, look.beard), undefined, true),
    );
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
    hair.push(rigPart(sculptedHair(P, look, hi), mats.hair, undefined, true));
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
        const angle = (i / 12) * Math.PI * 2;
        const p = headPoint(P, 0.7, angle, look.seed);
        const end = p
          .clone()
          .setY(-R * (0.35 + rng() * 0.6))
          .multiply(new THREE.Vector3(1.1, 1, 1.08));
        hair.push(
          rigPart(
            curve(
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
            ),
            mats.hair,
            undefined,
            true,
          ),
        );
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
  return { head, face, eyes, jaw, blink, hair };
}
