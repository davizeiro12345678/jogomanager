// ============================================================================
//  rig-body.ts
//  Corpo do atleta em malha mesclada por junta.
//
//  Esta é a tradução fiel do rig que vivia inline no JSX de `PlayerRig.tsx`.
//  Cada volume continua existindo — com a mesma posição, rotação, escala,
//  material e comportamento de sombra — mas as peças que compartilham a mesma
//  junta e o mesmo material são cozidas numa malha só (`mergeRigParts`).
//
//  Um atleta sai de ~117 malhas para ~45 em LOD 0 (e ~30 nas LODs distantes,
//  onde rosto/dedos/cadarços ficam ocultos). A animação não muda: as juntas
//  continuam sendo os mesmos grupos, com os mesmos pivôs.
//
//  Função pura: não cria contexto WebGL e pode ser testada em Node.
// ============================================================================

import * as THREE from "three";

import type { Proportions, PlayerLook } from "./player-model";
import type { PlayerMaterials } from "./player-materials";
import { buildSculptedFace } from "./player-sculpt";
import { footballShorts } from "./player-shorts";
import { FINGER_CENTERS_Y, FINGER_LENGTHS, fingerX } from "./player-hands";
import {
  armbandMaterial,
  studMaterial,
  tapeMaterial,
  tattooMaterial,
  undershirtMaterial,
} from "./rig-materials";
import {
  anatomicalLimb,
  anatomicalFinger,
  anatomicalNail,
  tailoredSleeve,
  anatomicalSection,
  neckSurface,
  palmSurface,
  athleticTorsoSurface,
  clothSurface,
  fittedLimbCover,
  forearmTattooSurface,
  footballBoot,
  mergeRigParts,
  rigPart,
  type RigMesh,
  type RigPart,
} from "./rig-geometry";

/** Segmentação por qualidade, como no rig original. */
export interface RigSegments {
  radial: number;
  cap: number;
}

export interface RigBodyContext {
  P: Proportions;
  look: PlayerLook;
  segs: RigSegments;
  /** qualidade alta: detalhes finos de rosto, músculos e mechas de cabelo */
  hi: boolean;
  portrait?: boolean;
  /** Staff actors reuse the athlete skeleton with full-length cloth trousers. */
  trousers?: boolean;
  staffStyle?: "jacket" | "polo" | undefined;
  /** materiais compartilhados do atleta (pele, camisa, calção, meião…) */
  mats: PlayerMaterials;
  /** cor de alto contraste para o número nas costas */
  jerseyInk: string;
  /** raio da mão (luva engrossa) */
  handR: number;
  /** material da mão: luva do goleiro ou pele */
  handMat: THREE.Material;
}

/** Malhas de cada junta; rosto, mandíbula e quatro pálpebras ficam em grupos animados. */
export interface RigBody {
  hips: RigMesh[];
  spine: RigMesh[];
  chest: RigMesh[];
  neck: RigMesh[];
  head: RigMesh[];
  hair: RigMesh[];
  face: RigMesh[];
  eyes: RigMesh[];
  jaw: RigMesh[];
  eyelidUpperL: RigMesh[];
  eyelidLowerL: RigMesh[];
  eyelidUpperR: RigMesh[];
  eyelidLowerR: RigMesh[];
  armL: RigMesh[];
  armR: RigMesh[];
  foreL: RigMesh[];
  foreR: RigMesh[];
  handL: RigMesh[];
  handR: RigMesh[];
  handDetailL: RigMesh[];
  handDetailR: RigMesh[];
  thumbL: RigMesh[];
  thumbR: RigMesh[];
  legL: RigMesh[];
  legR: RigMesh[];
  kneeL: RigMesh[];
  kneeR: RigMesh[];
  ankleL: RigMesh[];
  ankleR: RigMesh[];
  bootDetailL: RigMesh[];
  bootDetailR: RigMesh[];
  /** lista plana, para dispose e contagem */
  all: RigMesh[];
}

const SIDES = [-1, 1] as const;

/**
 * A tubular garment edge reads as a stitched hem under studio light, yet it
 * stays inside the material/joint that already owns the cloth.  The torus is
 * authored in the XZ plane so it can follow an elliptical waist, sleeve or
 * leg opening without a separate draw call.
 */
function ellipticalGarmentRing(
  radiusX: number,
  radiusZ: number,
  tubeRadius: number,
  radial: number,
  tubular: number,
) {
  const safeRadius = Math.max(radiusX, 0.0001);
  const ring = new THREE.TorusGeometry(safeRadius, Math.max(tubeRadius, 0.0005), tubular, radial);
  ring.rotateX(Math.PI / 2);
  ring.scale(1, 1, radiusZ / safeRadius);
  return ring;
}

/**
 * `footballShorts` owns an opening-leg attribute so the two hems deform with
 * their respective femurs.  Construction rings need the same attribute or
 * merging would either split the draw or make the inner hem follow the wrong
 * leg during a stride.
 */
function withOpeningLeg(geometry: THREE.BufferGeometry, side: -1 | 1) {
  geometry.setAttribute(
    "openingLeg",
    new THREE.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count).fill(side),
      1,
    ),
  );
  return geometry;
}

/**
 * A construction stitch must still use the owning garment material so it
 * merges into that joint's existing draw. A restrained vertex tint makes the
 * seam legible under a close camera without turning it into a second kit trim.
 */
function garmentTopstitch(geometry: THREE.BufferGeometry, value: number) {
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count * 3).fill(value),
      3,
    ),
  );
  return geometry;
}

/** Constrói o corpo completo. Devolve malhas já mescladas por junta. */
export function buildRigBody(ctx: RigBodyContext): RigBody {
  const { P, look, segs, hi, mats, handR, handMat } = ctx;
  const skin = mats.skin;
  const jersey = mats.jersey;
  const jerseyPlain = mats.jerseyPlain;
  const shorts = mats.shorts;
  const socks = mats.socks;
  const trim = mats.trim;
  const boot = mats.boot;
  const bootAccent = mats.bootAccent;
  const sole = mats.sole;
  const cast = true;
  const torsoBottom = -P.hipH * 0.12;
  const torsoHeight = P.spineLen + P.chestLen - torsoBottom;
  const shirtUv = (geometry: THREE.BufferGeometry, offset = 0) => {
    const positions = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        uv.getX(i) + 0.25,
        Math.max(0, Math.min(1, (positions.getY(i) + offset - torsoBottom) / torsoHeight)),
      );
    }
    return geometry;
  };

  /* ------------------------------------------------------------- tronco */

  const hips: RigPart[] = [
    rigPart(
      ctx.trousers
        ? anatomicalSection(
            [
              { y: -P.hipH * 0.75, width: P.hipW * 0.54, depth: P.chestD * 0.82 },
              { y: 0, width: P.hipW * 0.62, depth: P.chestD * 0.9 },
              { y: P.hipH * 0.5, width: P.hipW * 0.59, depth: P.chestD * 0.85 },
            ],
            segs.radial,
          )
        : footballShorts(P, segs.radial),
      shorts,
      undefined,
      cast,
    ),
  ];
  if (!ctx.trousers) {
    // A real waistband and two rolled leg openings break the flat, painted-on
    // shorts silhouette.  They reuse `shorts`, therefore they are baked into
    // the existing hips mesh rather than becoming three new draw calls.
    hips.push(
      rigPart(
        withOpeningLeg(
          ellipticalGarmentRing(
            P.hipW * 0.62,
            P.chestD * 0.87,
            Math.max(P.hipH * 0.024, 0.002),
            Math.max(12, segs.radial),
            hi ? 5 : 4,
          ),
          1,
        ),
        shorts,
        { position: [0, P.hipH * 0.49, 0] },
        cast,
      ),
    );
    const shortsHemY = -P.hipH * 0.4 - P.thigh * 0.49;
    const shortsHemTube = Math.max(P.legR * 0.026, 0.0016);
    for (const side of SIDES)
      hips.push(
        rigPart(
          withOpeningLeg(
            ellipticalGarmentRing(
              P.legR * 1.21 + 0.002,
              P.legR * 1.29 + 0.002,
              shortsHemTube,
              Math.max(10, segs.radial),
              hi ? 5 : 4,
            ),
            side,
          ),
          shorts,
          // Sit just above the authored opening: it reads as a rolled edge
          // but leaves the garment's true lowest ring available to the
          // leg-skinning contract and its inner-hem probes.
          { position: [side * P.hipW * 0.36, shortsHemY + shortsHemTube * 1.25, 0] },
          cast,
        ),
      );
    if (hi)
      for (const side of SIDES) {
        // A short curved outseam anchors the waistband to each leg opening.
        // It is marked with the same femur identity as the opening, so a
        // stride carries the stitch with its own shorts panel rather than
        // shearing it through the centre seam.
        const outseam = withOpeningLeg(
          garmentTopstitch(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3([
                new THREE.Vector3(side * P.hipW * 0.48, P.hipH * 0.42, P.chestD * 0.76),
                new THREE.Vector3(side * P.hipW * 0.53, -P.hipH * 0.15, P.legR * 1.24),
                new THREE.Vector3(
                  side * (P.hipW * 0.36 + P.legR * 0.9),
                  shortsHemY + shortsHemTube * 1.5,
                  P.legR * 1.19,
                ),
              ]),
              6,
              Math.max(P.hipH * 0.007, 0.0008),
              3,
              false,
            ),
            0.86,
          ),
          side,
        );
        hips.push(rigPart(outseam, shorts, undefined, cast));
      }
  }

  const spine: RigPart[] = [
    rigPart(
      shirtUv(
        clothSurface(
          athleticTorsoSurface(
            anatomicalSection(
              [
                { y: -P.hipH * 0.12, width: P.hipW * 0.59, depth: P.chestD * 0.85 },
                { y: P.spineLen * 0.4, width: P.chestW * 0.73, depth: P.chestD * 0.9 },
                { y: P.spineLen * 1.06, width: P.chestW * 0.98, depth: P.chestD * 1.025 },
                {
                  y: P.spineLen + P.chestLen * 0.4,
                  width: P.chestW * 1.08,
                  depth: P.chestD * 1.065,
                },
                {
                  y: P.spineLen + P.chestLen * 0.8,
                  width: P.shoulderW * 0.65,
                  depth: P.chestD * 0.91,
                },
                {
                  y: P.spineLen + P.chestLen * 0.9,
                  width: P.shoulderW * 0.49,
                  depth: P.chestD * 0.77,
                },
                {
                  y: P.spineLen + P.chestLen * 0.95,
                  width: P.shoulderW * 0.32,
                  depth: P.chestD * 0.59,
                },
                { y: P.spineLen + P.chestLen, width: P.neckR * 1.55, depth: P.neckR * 1.35 },
              ],
              Math.max(12, segs.radial + (hi ? 8 : 4)),
              0.94,
            ),
            P.chestW,
            torsoHeight,
          ),
          0.003,
        ),
      ),
      jersey,
      undefined,
      cast,
    ),
  ];
  // The shirt gets a tangible lower fold in every profile.  The high profile
  // also gets subtle construction seams on its front-side panels: enough to
  // catch a close camera or rim light without imposing a contrasting stripe
  // on every club kit.
  spine.push(
    rigPart(
      ellipticalGarmentRing(
        P.hipW * 0.605,
        P.chestD * 0.865,
        Math.max(P.hipH * 0.021, 0.0019),
        Math.max(12, segs.radial),
        hi ? 5 : 4,
      ),
      jersey,
      { position: [0, torsoBottom + P.hipH * 0.012, 0] },
      cast,
    ),
  );
  if (hi) {
    for (const side of SIDES) {
      const seam = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * P.hipW * 0.6, torsoBottom + P.hipH * 0.018, P.chestD * 0.33),
          new THREE.Vector3(side * P.chestW * 0.76, P.spineLen * 0.4, P.chestD * 0.36),
          new THREE.Vector3(side * P.chestW * 1.0, P.spineLen + P.chestLen * 0.3, P.chestD * 0.4),
          new THREE.Vector3(
            side * P.shoulderW * 0.58,
            P.spineLen + P.chestLen * 0.72,
            P.chestD * 0.31,
          ),
        ]),
        8,
        Math.max(P.hipH * 0.012, 0.0012),
        3,
        false,
      );
      spine.push(rigPart(garmentTopstitch(seam, 0.87), jersey, undefined, cast));
    }
  }

  const chest: RigPart[] = [
    // gola
    rigPart(
      new THREE.TorusGeometry(
        P.neckR * (look.collar === "polo" ? 1.62 : 1.5),
        P.neckR * (look.collar === "polo" ? 0.14 : 0.085),
        6,
        14,
      ),
      trim,
      { position: [0, P.chestLen * 0.98, 0], rotation: [Math.PI / 2, 0, 0] },
    ),
  ];
  if (look.collar === "v") {
    chest.push(
      rigPart(new THREE.BoxGeometry(P.neckR * 1.1, P.neckR * 1.1, P.neckR * 0.16), trim, {
        position: [0, P.chestLen * 0.78, P.chestD * 0.5],
        rotation: [0, 0, Math.PI / 4],
      }),
    );
  }
  if (look.collar === "polo") {
    chest.push(
      rigPart(new THREE.BoxGeometry(P.neckR * 2.1, P.neckR * 0.9, P.neckR * 0.14), trim, {
        position: [0, P.chestLen * 0.9, P.chestD * 0.46],
        rotation: [-0.5, 0, 0],
      }),
    );
  }
  if (ctx.staffStyle === "jacket") {
    // Shirt inset and lapels follow the chest surface and reuse existing draws.
    const shirt = new THREE.BufferGeometry();
    shirt.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -P.neckR * 0.7,
          P.chestLen * 0.97,
          P.neckR * 1.38 + 0.004,
          -P.neckR * 0.57,
          P.chestLen * 0.76,
          P.chestD * 1.01,
          -P.neckR * 0.3,
          P.chestLen * 0.54,
          P.chestD * 1.055,
          0,
          P.chestLen * 0.36,
          P.chestD * 1.055,
          P.neckR * 0.3,
          P.chestLen * 0.54,
          P.chestD * 1.055,
          P.neckR * 0.57,
          P.chestLen * 0.76,
          P.chestD * 1.01,
          P.neckR * 0.7,
          P.chestLen * 0.97,
          P.neckR * 1.38 + 0.004,
        ],
        3,
      ),
    );
    shirt.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [0, 1, 0.15, 0.7, 0.3, 0.3, 0.5, 0, 0.7, 0.3, 0.85, 0.7, 1, 1],
        2,
      ),
    );
    shirt.setIndex([0, 1, 6, 6, 1, 5, 1, 2, 5, 5, 2, 4, 2, 3, 4]);
    shirt.computeVertexNormals();
    chest.push(rigPart(shirt, mats.trim));
    for (const side of SIDES) {
      const lapel = new THREE.BufferGeometry();
      lapel.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            side * P.neckR * 1.44,
            P.chestLen * 0.91,
            P.neckR * 1.4,
            side * P.neckR * 0.48,
            P.chestLen * 0.28,
            P.chestD * 1.03,
            side * P.neckR * 1.75,
            P.chestLen * 0.56,
            P.chestD * 1.04,
          ],
          3,
        ),
      );
      lapel.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0.5, 0, 1, 0.5], 2));
      lapel.setIndex(side === 1 ? [0, 1, 2] : [0, 2, 1]);
      lapel.computeVertexNormals();
      chest.push(rigPart(lapel, mats.sole));
    }
  }
  // A numeração já faz parte da textura do uniforme; um disco opaco aqui
  // cobria a camisa e aparecia como círculo branco em jogadores próximos.

  const neck: RigPart[] = [
    rigPart(
      neckSurface(
        anatomicalSection(
          [
            { y: 0, width: P.neckR * 1.19, depth: P.neckR * 0.98 },
            { y: P.neckLen * 0.65, width: P.neckR * 0.87, depth: P.neckR * 0.82 },
            { y: P.neckLen * 1.25, width: P.neckR * 0.93, depth: P.neckR * 0.86 },
          ],
          segs.radial,
        ),
        P.neckR,
        P.neckLen,
      ),
      skin,
      undefined,
      cast,
    ),
  ];

  /* --------------------------------------------------------------- rosto */

  const sculpt = buildSculptedFace(P, look, mats, hi, ctx.portrait ?? true);
  const { head, face, eyes, jaw, eyelidUpperL, eyelidLowerL, eyelidUpperR, eyelidLowerR } = sculpt;
  const hairParts = sculpt.hair;

  /* --------------------------------------------------------- braços/pernas */

  const armL: RigPart[] = [];
  const armR: RigPart[] = [];
  const foreL: RigPart[] = [];
  const foreR: RigPart[] = [];
  const handL: RigPart[] = [];
  const handRig: RigPart[] = [];
  const handDetailL: RigPart[] = [];
  const handDetailR: RigPart[] = [];
  const thumbL: RigPart[] = [];
  const thumbR: RigPart[] = [];
  const legL: RigPart[] = [];
  const legR: RigPart[] = [];
  const kneeL: RigPart[] = [];
  const kneeR: RigPart[] = [];
  const ankleL: RigPart[] = [];
  const ankleR: RigPart[] = [];
  const bootDetailL: RigPart[] = [];
  const bootDetailR: RigPart[] = [];
  // A compression layer replaces the exposed lower-arm skin only when the
  // generated outfit asks for it.  It reuses the former skin owner, so the
  // thermal shirt is visible below a short sleeve without adding rig groups.
  const shortSleeveBase =
    look.sleeves === "short" && look.undershirt ? undershirtMaterial(look.undershirtColor) : skin;

  for (const side of SIDES) {
    const isLeft = side === 1;
    const arm = isLeft ? armL : armR;
    const fore = isLeft ? foreL : foreR;
    const hand = isLeft ? handL : handRig;
    const handDetail = isLeft ? handDetailL : handDetailR;
    const thumb = isLeft ? thumbL : thumbR;
    const leg = isLeft ? legL : legR;
    const knee = isLeft ? kneeL : kneeR;
    const ankle = isLeft ? ankleL : ankleR;
    const bootDetail = isLeft ? bootDetailL : bootDetailR;
    const sleeveMat = look.sleeves === "long" ? jerseyPlain : shortSleeveBase;

    /* Muscle volumes taper into elbows and wrists rather than overlapping
       separate spheres. Cloth, tape and tattoos follow that same surface. */
    arm.push(
      rigPart(
        look.sleeves === "short"
          ? fittedLimbCover("upperArm", P.upperArm, P.armR, segs.radial, 0.44, 0, 1)
          : tailoredSleeve(P.upperArm, P.armR, segs.radial),
        sleeveMat,
        undefined,
        cast,
      ),
    );
    if (look.sleeves === "short")
      arm.push(
        rigPart(
          clothSurface(
            anatomicalSection(
              [
                { y: -P.upperArm * 0.48, width: P.armR * 1.1, depth: P.armR * 1.1 },
                { y: -P.upperArm * 0.26, width: P.armR * 1.11, depth: P.armR * 1.09 },
                { y: -P.upperArm * 0.06, width: P.armR * 1.06, depth: P.armR * 1.02 },
                { y: P.upperArm * 0.015, width: P.armR * 0.7, depth: P.armR * 0.68 },
                { y: P.upperArm * 0.035, width: P.armR * 0.24, depth: P.armR * 0.24 },
              ],
              segs.radial,
            ),
            0.001,
          ),
          jerseyPlain,
          undefined,
          cast,
        ),
      );
    if (look.sleeves === "short")
      arm.push(
        rigPart(
          ellipticalGarmentRing(
            P.armR * 1.08,
            P.armR * 0.98,
            Math.max(P.armR * 0.026, 0.0012),
            Math.max(10, segs.radial),
            hi ? 5 : 4,
          ),
          jerseyPlain,
          { position: [0, -P.upperArm * 0.475, 0] },
          cast,
        ),
      );
    if (look.captain && isLeft)
      arm.push(
        rigPart(
          new THREE.CylinderGeometry(P.armR * 1.16, P.armR * 1.15, 0.04, segs.radial),
          armbandMaterial(),
          { position: [0, -P.upperArm * 0.39, 0] },
        ),
      );
    fore.push(
      rigPart(
        anatomicalLimb("forearm", P.foreArm, P.armR, segs.radial, false, undefined, side),
        sleeveMat,
        undefined,
        cast,
      ),
    );
    if (look.sleeves === "long")
      fore.push(
        rigPart(
          ellipticalGarmentRing(
            P.armR * 0.59,
            P.armR * 0.48,
            Math.max(P.armR * 0.02, 0.001),
            Math.max(8, segs.radial),
            hi ? 5 : 4,
          ),
          jerseyPlain,
          { position: [0, -P.foreArm * 0.91, 0] },
          cast,
        ),
      );
    const taped = (isLeft && look.wristTape === "left") || (!isLeft && look.wristTape === "right");
    if (taped)
      fore.push(
        rigPart(
          new THREE.CylinderGeometry(P.armR * 0.64, P.armR * 0.58, 0.032, segs.radial),
          tapeMaterial(),
          { position: [0, -P.foreArm * 0.89, 0] },
        ),
      );
    const inked =
      look.sleeves !== "long" &&
      ((isLeft && look.tattoo === "foreL") || (!isLeft && look.tattoo === "foreR"));
    if (inked)
      fore.push(
        rigPart(
          forearmTattooSurface(P.foreArm, P.armR, segs.radial, side),
          tattooMaterial(look.seed + (isLeft ? 7 : 29)),
        ),
      );

    /* A flattened palm, four separate fingers and an opposed thumb. */
    hand.push(
      rigPart(
        palmSurface(
          anatomicalSection(
            [
              { y: -handR * 1.5, width: handR * 0.67, depth: handR * 0.27 },
              { y: -handR * 0.85, width: handR * 0.77, depth: handR * 0.34 },
              { y: -handR * 0.25, width: handR * 0.59, depth: handR * 0.32 },
              {
                y: handR * 0.08,
                width: P.armR * (look.gloves ? 0.6 : 0.55),
                depth: P.armR * (look.gloves ? 0.48 : 0.43),
              },
              ...(look.gloves
                ? [
                    { y: handR * 0.22, width: P.armR * 0.61, depth: P.armR * 0.49 },
                    { y: handR * 0.34, width: P.armR * 0.6, depth: P.armR * 0.48 },
                  ]
                : []),
            ],
            segs.radial,
            look.gloves ? 0.9 : 0.8,
            "bottom",
          ),
          handR,
          side,
        ),
        handMat,
        undefined,
        cast,
      ),
    );
    if (look.gloves) {
      // Latex backhand padding and the wrist closure share the glove draw.
      hand.push(
        rigPart(
          anatomicalSection(
            [
              {
                y: -handR * 1.28,
                width: handR * 0.55,
                depth: handR * 0.17,
                centerDepth: -handR * 0.25,
              },
              {
                y: -handR * 0.85,
                width: handR * 0.69,
                depth: handR * 0.22,
                centerDepth: -handR * 0.24,
              },
              {
                y: -handR * 0.4,
                width: handR * 0.52,
                depth: handR * 0.16,
                centerDepth: -handR * 0.24,
              },
            ],
            8,
          ),
          handMat,
        ),
      );
    }
    const thumbTransform = {
      position: [-side * handR * 0.08, -handR * 0.27, handR * 0.08] as const,
      rotation: [0.18, 0, -side * 0.55] as const,
    };
    // The old capsule made every thumb look like a smooth peg beside the
    // articulated fingers. Reuse the tapered phalanx and its normal detail;
    // it stays inside the existing thumb joint/material draw.
    thumb.push(
      rigPart(anatomicalFinger(handR * 0.195, handR * 0.62), handMat, thumbTransform, cast),
    );
    if (hi && !look.gloves)
      thumb.push(
        rigPart(anatomicalNail(handR * 0.195, handR * 0.62), handMat, thumbTransform, cast),
      );
    for (let i = 0; i < 4; i++) {
      handDetail.push(
        rigPart(anatomicalFinger(handR * 0.15, handR * FINGER_LENGTHS[i]!), handMat, {
          position: [fingerX(i, handR), -handR * FINGER_CENTERS_Y[i]!, handR * 0.05],
          rotation: [0.28, 0, (i - 1.5) * 0.035],
        }),
      );
      if (hi && !look.gloves)
        handDetail.push(
          rigPart(anatomicalNail(handR * 0.15, handR * FINGER_LENGTHS[i]!), handMat, {
            position: [fingerX(i, handR), -handR * FINGER_CENTERS_Y[i]!, handR * 0.05],
            rotation: [0.28, 0, (i - 1.5) * 0.035],
          }),
        );
    }

    /* Covered upper-thigh faces cannot pierce the waistband during a raised
       femur. Bare skin starts just inside the hem, retaining overlap. */
    leg.push(
      rigPart(
        ctx.trousers
          ? anatomicalLimb("thigh", P.thigh, P.legR, segs.radial, false, undefined, side)
          : fittedLimbCover("thigh", P.thigh, P.legR, segs.radial, 0.43, 0, 1.035, undefined, side),
        ctx.trousers ? shorts : skin,
        undefined,
        cast,
      ),
    );

    /* Socks follow the real calf and taper into the ankle, including the
       low/mid/high options. They do not add another capsule around the leg. */
    const sockTop = ctx.trousers
      ? 0
      : look.sockHeight === "low"
        ? 0.62
        : look.sockHeight === "high"
          ? 0.15
          : 0.38;
    const calfProfile = [
      [0, 0.76, 0.78],
      [0.22, 0.84, 0.94],
      [0.4, 0.86, 1.02],
      [0.74, 0.56, 0.63],
      [1, 0.41, 0.5],
    ];
    const calfAt = (u: number) => {
      const i = Math.max(0, calfProfile.findIndex((r) => r[0]! >= u) - 1);
      const a = calfProfile[i]!,
        b = calfProfile[Math.min(i + 1, calfProfile.length - 1)]!;
      const t = THREE.MathUtils.clamp((u - a[0]!) / (b[0]! - a[0]!), 0, 1);
      return [a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
    };
    knee.push(
      rigPart(
        anatomicalLimb("calf", P.shin, P.legR, segs.radial, false, undefined, side),
        ctx.trousers ? shorts : skin,
        undefined,
        cast,
      ),
      rigPart(
        fittedLimbCover(
          "calf",
          P.shin,
          P.legR,
          segs.radial,
          sockTop,
          0.002,
          1.035,
          undefined,
          side,
        ),
        ctx.trousers ? shorts : socks,
        undefined,
        cast,
      ),
    );
    const [cuffW, cuffD] = calfAt(sockTop);
    knee.push(
      rigPart(
        new THREE.CylinderGeometry(
          P.legR * cuffW! + 0.003,
          P.legR * cuffW! + 0.003,
          0.012,
          segs.radial,
        ),
        ctx.trousers ? shorts : socks,
        { position: [0, -P.shin * sockTop, 0], scale: [1, 1, cuffD! / cuffW!] },
      ),
    );
    if (look.sockTape) {
      const [w, d] = calfAt(sockTop + 0.06);
      knee.push(
        rigPart(
          new THREE.CylinderGeometry(
            P.legR * w! + 0.0035,
            P.legR * w! + 0.0035,
            0.014,
            segs.radial,
          ),
          tapeMaterial(),
          { position: [0, -P.shin * (sockTop + 0.06), 0], scale: [1, 1, d! / w!] },
        ),
      );
    }

    /* The boot is one sculpted last rather than three spheres and a box. */
    ankle.push(
      rigPart(
        new THREE.SphereGeometry(P.legR * 0.45, segs.radial, 10),
        socks,
        { position: [0, P.footH * 0.06, 0], scale: [1, 0.62, 1.05] },
        cast,
      ),
      rigPart(footballBoot(P.footLen, P.footH, segs.radial), boot, undefined, cast),
      rigPart(footballBoot(P.footLen, P.footH, segs.radial, true), sole, undefined, cast),
    );
    if (hi) {
      // A padded tongue and an open heel-counter seam turn the sculpted last
      // into a recognisable football boot in close-ups.  Both use materials
      // the ankle already owns, keeping the visible draw count unchanged.
      ankle.push(
        rigPart(
          new THREE.CapsuleGeometry(P.footH * 0.14, P.footLen * 0.22, 2, 6),
          boot,
          {
            position: [0, -P.footH * 0.105, P.footLen * 0.16],
            rotation: [Math.PI / 2, 0, 0],
            scale: [1, 0.72, 1],
          },
          cast,
        ),
      );
      ankle.push(
        rigPart(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(-P.footH * 0.31, -P.footH * 0.37, -P.footLen * 0.2),
              new THREE.Vector3(-P.footH * 0.37, -P.footH * 0.17, -P.footLen * 0.245),
              new THREE.Vector3(0, -P.footH * 0.04, -P.footLen * 0.265),
              new THREE.Vector3(P.footH * 0.37, -P.footH * 0.17, -P.footLen * 0.245),
              new THREE.Vector3(P.footH * 0.31, -P.footH * 0.37, -P.footLen * 0.2),
            ]),
            8,
            Math.max(P.footH * 0.019, 0.001),
            4,
            false,
          ),
          bootAccent,
        ),
      );
    }
    for (const bootSide of [-1, 1])
      ankle.push(
        rigPart(new THREE.CapsuleGeometry(P.footH * 0.032, P.footLen * 0.28, 2, 5), bootAccent, {
          position: [bootSide * P.footH * 0.58, -P.footH * 0.43, P.footLen * 0.15],
          rotation: [Math.PI / 2, 0, bootSide * 0.3],
        }),
      );

    /*
      Cadarços entram na malha de acabamento da chuteira (mesmo material, mesma
      junta). Só as travas ficam no grupo de LOD: elas são as únicas peças que
      merecem desaparecer quando o pé está longe da câmera.
    */
    for (let i = 0; i < 5; i += 1) {
      const laceZ = P.footLen * (0.055 + i * 0.067);
      const laceY = -P.footH * (0.025 + i * 0.034);
      ankle.push(
        rigPart(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(-P.footH * 0.25, laceY - P.footH * 0.04, laceZ),
              new THREE.Vector3(0, laceY + P.footH * 0.025, laceZ + P.footLen * 0.012),
              new THREE.Vector3(P.footH * 0.25, laceY - P.footH * 0.04, laceZ),
            ]),
            8,
            P.footH * 0.022,
            4,
            false,
          ),
          bootAccent,
        ),
      );
    }
    // A shallow toe-cap seam catches a different highlight from the lace row.
    // It uses the existing accent material and ankle owner, so the premium
    // close-up gains boot construction detail without another material or draw.
    ankle.push(
      rigPart(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(-P.footH * 0.31, -P.footH * 0.11, P.footLen * 0.39),
            new THREE.Vector3(0, -P.footH * 0.02, P.footLen * 0.47),
            new THREE.Vector3(P.footH * 0.31, -P.footH * 0.11, P.footLen * 0.39),
          ]),
          8,
          P.footH * 0.015,
          4,
          false,
        ),
        bootAccent,
      ),
    );
    for (const [sx, sz] of [
      [-0.3, 0.36],
      [0.3, 0.36],
      [-0.32, 0.02],
      [0.32, 0.02],
      [0, -0.28],
    ] as const) {
      bootDetail.push(
        rigPart(new THREE.ConeGeometry(0.011, 0.022, 5), studMaterial(), {
          position: [sx * P.footH, -P.footH * 0.78, sz * P.footLen],
          rotation: [Math.PI, 0, 0],
        }),
      );
    }
  }

  /* ------------------------------------------------------------- merge */

  const merged = {
    hips: mergeRigParts(hips),
    spine: mergeRigParts(spine),
    chest: mergeRigParts(chest),
    neck: mergeRigParts(neck),
    head: mergeRigParts(head),
    // barba e cabelo estão na mesma junta rígida e usam o mesmo material:
    // uma malha só para os dois.
    hair: mergeRigParts(hairParts),
    face: mergeRigParts(face),
    eyes: mergeRigParts(eyes),
    jaw: mergeRigParts(jaw),
    eyelidUpperL: mergeRigParts(eyelidUpperL),
    eyelidLowerL: mergeRigParts(eyelidLowerL),
    eyelidUpperR: mergeRigParts(eyelidUpperR),
    eyelidLowerR: mergeRigParts(eyelidLowerR),
    armL: mergeRigParts(armL),
    armR: mergeRigParts(armR),
    foreL: mergeRigParts(foreL),
    foreR: mergeRigParts(foreR),
    handL: mergeRigParts(handL),
    handR: mergeRigParts(handRig),
    handDetailL: mergeRigParts(handDetailL),
    handDetailR: mergeRigParts(handDetailR),
    thumbL: mergeRigParts(thumbL),
    thumbR: mergeRigParts(thumbR),
    legL: mergeRigParts(legL),
    legR: mergeRigParts(legR),
    kneeL: mergeRigParts(kneeL),
    kneeR: mergeRigParts(kneeR),
    ankleL: mergeRigParts(ankleL),
    ankleR: mergeRigParts(ankleR),
    bootDetailL: mergeRigParts(bootDetailL),
    bootDetailR: mergeRigParts(bootDetailR),
  };

  if (look.gloves) {
    for (const meshes of [merged.handL, merged.handR])
      for (const mesh of meshes) {
        if (mesh.material !== mats.glove) continue;
        const positions = mesh.geometry.getAttribute("position");
        const colors = mesh.geometry.getAttribute("color");
        if (!colors) continue;
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i) / handR;
          const closure =
            THREE.MathUtils.smoothstep(y, -0.06, 0.015) *
            (1 - THREE.MathUtils.smoothstep(y, 0.22, 0.32));
          const value = 1 - closure * 0.48;
          colors.setXYZ(i, value, value, value);
        }
      }
  }
  const all: RigMesh[] = [];
  for (const meshes of Object.values(merged)) all.push(...meshes);
  return { ...merged, all };
}

/** Malhas visíveis no LOD 0 (todas) — usado no teste de orçamento. */
export function countRigBody(body: RigBody): number {
  return body.all.length;
}
