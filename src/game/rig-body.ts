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
  anatomicalSection,
  clothSurface,
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
  /** Staff actors reuse the athlete skeleton with full-length cloth trousers. */
  trousers?: boolean;
  /** materiais compartilhados do atleta (pele, camisa, calção, meião…) */
  mats: PlayerMaterials;
  /** cor de alto contraste para o número nas costas */
  jerseyInk: string;
  /** raio da mão (luva engrossa) */
  handR: number;
  /** material da mão: luva do goleiro ou pele */
  handMat: THREE.Material;
}

/** Malhas de cada junta; `face`, `jaw` e `blink` ficam em grupos animados. */
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
  blink: RigMesh[];
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
      anatomicalSection(
        [
          { y: -P.hipH * 0.75, width: P.hipW * 0.54, depth: P.chestD * 0.82 },
          { y: 0, width: P.hipW * 0.62, depth: P.chestD * 0.9 },
          { y: P.hipH * 0.5, width: P.hipW * 0.59, depth: P.chestD * 0.85 },
        ],
        segs.radial,
      ),
      shorts,
      undefined,
      cast,
    ),
    rigPart(new THREE.CylinderGeometry(P.hipW * 0.62, P.hipW * 0.62, 0.014, segs.radial), shorts, {
      position: [0, P.hipH * 0.5, 0],
    }),
  ];

  const spine: RigPart[] = [
    rigPart(
      shirtUv(
        clothSurface(
          anatomicalSection(
            [
              { y: -P.hipH * 0.12, width: P.hipW * 0.59, depth: P.chestD * 0.85 },
              { y: P.spineLen * 0.4, width: P.chestW * 0.82, depth: P.chestD * 0.89 },
              { y: P.spineLen * 1.06, width: P.chestW * 0.94, depth: P.chestD },
              { y: P.spineLen + P.chestLen * 0.4, width: P.chestW * 1.01, depth: P.chestD * 1.01 },
              {
                y: P.spineLen + P.chestLen * 0.8,
                width: P.shoulderW * 0.53,
                depth: P.chestD * 0.88,
              },
              { y: P.spineLen + P.chestLen, width: P.neckR * 1.55, depth: P.neckR * 1.35 },
            ],
            Math.max(12, segs.radial + 4),
            0.88,
          ),
        ),
      ),
      jersey,
      undefined,
      cast,
    ),
  ];

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
  // A numeração já faz parte da textura do uniforme; um disco opaco aqui
  // cobria a camisa e aparecia como círculo branco em jogadores próximos.

  const neck: RigPart[] = [
    rigPart(
      anatomicalSection(
        [
          { y: 0, width: P.neckR, depth: P.neckR * 0.92 },
          { y: P.neckLen * 0.65, width: P.neckR * 0.83, depth: P.neckR * 0.8 },
          { y: P.neckLen * 1.25, width: P.neckR * 0.93, depth: P.neckR * 0.86 },
        ],
        segs.radial,
      ),
      skin,
      undefined,
      cast,
    ),
  ];

  /* --------------------------------------------------------------- rosto */

  const sculpt = buildSculptedFace(P, look, mats, hi);
  const { head, face, eyes, jaw, blink } = sculpt;
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
    const sleeveMat = look.sleeves === "long" ? jerseyPlain : skin;

    /* Muscle volumes taper into elbows and wrists rather than overlapping
       separate spheres. Cloth, tape and tattoos follow that same surface. */
    arm.push(
      rigPart(
        anatomicalLimb("upperArm", P.upperArm, P.armR, segs.radial),
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
                { y: -P.upperArm * 0.48, width: P.armR * 1.11, depth: P.armR * 1.12 },
                { y: -P.upperArm * 0.24, width: P.armR * 1.15, depth: P.armR * 1.14 },
                { y: P.upperArm * 0.03, width: P.armR * 1.045, depth: P.armR * 1.01 },
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
        anatomicalLimb("forearm", P.foreArm, P.armR, segs.radial),
        sleeveMat,
        undefined,
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
          anatomicalSection(
            [
              { y: -P.foreArm * 0.81, width: P.armR * 0.617, depth: P.armR * 0.658 },
              { y: -P.foreArm * 0.46, width: P.armR * 0.852, depth: P.armR * 0.812 },
              { y: -P.foreArm * 0.25, width: P.armR * 0.912, depth: P.armR * 0.87 },
            ],
            segs.radial,
          ),
          tattooMaterial(look.seed + (isLeft ? 7 : 29)),
        ),
      );

    /* A flattened palm, four separate fingers and an opposed thumb. */
    hand.push(
      rigPart(
        anatomicalSection(
          [
            { y: -handR * 1.5, width: handR * 0.67, depth: handR * 0.27 },
            { y: -handR * 0.85, width: handR * 0.77, depth: handR * 0.34 },
            { y: -handR * 0.25, width: handR * 0.59, depth: handR * 0.32 },
            { y: handR * 0.08, width: handR * 0.54, depth: handR * 0.31 },
          ],
          segs.radial,
          0.8,
        ),
        handMat,
        undefined,
        cast,
      ),
    );
    thumb.push(
      rigPart(
        new THREE.CapsuleGeometry(handR * 0.19, handR * 0.5, 3, 6),
        handMat,
        {
          position: [-side * handR * 0.08, -handR * 0.27, handR * 0.08],
          rotation: [0.18, 0, -side * 0.55],
        },
        cast,
      ),
    );
    for (let i = 0; i < 4; i++)
      handDetail.push(
        rigPart(
          new THREE.CapsuleGeometry(handR * 0.15, handR * FINGER_LENGTHS[i]!, 3, 6),
          handMat,
          {
            position: [fingerX(i, handR), -handR * FINGER_CENTERS_Y[i]!, handR * 0.05],
            rotation: [0.28, 0, (i - 1.5) * 0.035],
          },
        ),
      );

    /* Athletic quadriceps and tailored short legs with thin sewn hems. */
    leg.push(
      rigPart(
        anatomicalLimb("thigh", P.thigh, P.legR, segs.radial),
        ctx.trousers ? shorts : skin,
        undefined,
        cast,
      ),
      rigPart(
        clothSurface(
          anatomicalSection(
            [
              { y: -P.thigh * 0.51, width: P.legR * 1.21, depth: P.legR * 1.16 },
              { y: -P.thigh * 0.25, width: P.legR * 1.32, depth: P.legR * 1.24 },
              { y: P.hipH * 0.18, width: P.legR * 1.25, depth: P.legR * 1.18 },
            ],
            segs.radial,
            0.91,
          ),
          0.0014,
        ),
        shorts,
        undefined,
        cast,
      ),
      rigPart(new THREE.CylinderGeometry(P.legR * 1.22, P.legR * 1.22, 0.009, segs.radial), trim, {
        position: [0, -P.thigh * 0.5, 0],
        scale: [1, 1, 0.96],
      }),
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
    const sockRings = [sockTop, ...[0.22, 0.4, 0.74, 1].filter((u) => u > sockTop), 1.035]
      .map((u) => {
        const [w, d] = calfAt(Math.min(1, u));
        return { y: -P.shin * u, width: P.legR * w! + 0.002, depth: P.legR * d! + 0.002 };
      })
      .reverse();
    knee.push(
      rigPart(
        anatomicalLimb("calf", P.shin, P.legR, segs.radial),
        ctx.trousers ? shorts : skin,
        undefined,
        cast,
      ),
      rigPart(
        anatomicalSection(sockRings, segs.radial),
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
    for (let i = 0; i < 3; i += 1) {
      ankle.push(
        rigPart(
          new THREE.BoxGeometry(P.footH * 0.5, P.footH * 0.06, P.footLen * 0.04),
          bootAccent,
          {
            position: [0, -P.footH * 0.12, P.footLen * (0.1 + i * 0.09)],
            rotation: [0.12, 0, 0],
          },
        ),
      );
    }
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
    blink: mergeRigParts(blink),
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

  const all: RigMesh[] = [];
  for (const meshes of Object.values(merged)) all.push(...meshes);
  return { ...merged, all };
}

/** Malhas visíveis no LOD 0 (todas) — usado no teste de orçamento. */
export function countRigBody(body: RigBody): number {
  return body.all.length;
}
