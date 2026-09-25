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
import { shade } from "./player-model";
import type { PlayerMaterials } from "./player-materials";
import {
  armbandMaterial,
  eyeWhiteMaterial,
  headbandMaterial,
  irisMaterial,
  pupilMaterial,
  skinDetailMaterial,
  studMaterial,
  undershirtMaterial,
} from "./rig-materials";
import { mergeRigParts, rigPart, type RigMesh, type RigPart } from "./rig-geometry";

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
  const shorts = mats.shorts;
  const socks = mats.socks;
  const trim = mats.trim;
  const hair = mats.hair;
  const boot = mats.boot;
  const bootAccent = mats.bootAccent;
  const sole = mats.sole;
  const cast = true;

  /* ------------------------------------------------------------- tronco */

  const hips: RigPart[] = [
    rigPart(
      new THREE.CapsuleGeometry(P.hipW * 0.62, P.hipH * 0.6, segs.cap, segs.radial),
      shorts,
      undefined,
      cast,
    ),
    rigPart(new THREE.CylinderGeometry(P.hipW * 0.66, P.hipW * 0.64, 0.045, segs.radial), trim, {
      position: [0, P.hipH * 0.5, 0],
    }),
  ];

  const spine: RigPart[] = [
    rigPart(
      new THREE.CapsuleGeometry(P.chestW * 0.5, P.spineLen * 0.7, segs.cap, segs.radial),
      jersey,
      { position: [0, P.spineLen * 0.5, 0], scale: [1, 1, 0.82] },
      cast,
    ),
  ];

  const chest: RigPart[] = [
    rigPart(
      new THREE.CapsuleGeometry(P.chestW * 0.58, P.chestLen * 0.62, segs.cap, segs.radial),
      jersey,
      {
        position: [0, P.chestLen * 0.46, 0],
        scale: [1, 1, P.chestD / (P.chestW * 0.58)],
      },
      cast,
    ),
    // linha dos ombros
    rigPart(
      new THREE.CapsuleGeometry(P.armR * 1.3, P.shoulderW * 0.8, 3, segs.radial),
      jersey,
      { position: [0, P.chestLen * 0.84, 0], rotation: [0, 0, Math.PI / 2] },
      cast,
    ),
    // gola
    rigPart(
      new THREE.TorusGeometry(
        P.neckR * (look.collar === "polo" ? 1.62 : 1.5),
        P.neckR * (look.collar === "polo" ? 0.36 : 0.28),
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
      new THREE.CapsuleGeometry(P.neckR, P.neckLen * 0.8, 3, segs.radial),
      look.undershirt ? undershirtMaterial(look.undershirtColor) : mats.skinDark,
      { position: [0, P.neckLen * 0.5, 0] },
      cast,
    ),
  ];

  /* --------------------------------------------------------------- rosto */

  const head: RigPart[] = [
    rigPart(new THREE.SphereGeometry(P.headR, 16, 16), skin, { scale: [1, 1.14, 1.02] }, cast),
    rigPart(
      new THREE.SphereGeometry(P.headR, 12, 12),
      skin,
      { position: [0, -P.headR * 0.5, P.headR * 0.12], scale: [0.82, 0.6, 0.9] },
      cast,
    ),
  ];

  const face: RigPart[] = [];
  const blink: RigPart[] = [];
  const jaw: RigPart[] = [];

  for (const s of [-1, 1] as const) {
    face.push(
      // esclera
      rigPart(
        new THREE.SphereGeometry(P.headR * 0.15, hi ? 12 : 8, hi ? 12 : 8),
        eyeWhiteMaterial(),
        { position: [s * P.headR * 0.36, P.headR * 0.1, P.headR * 0.82] },
      ),
      // íris
      rigPart(new THREE.SphereGeometry(P.headR * 0.085, 10, 10), irisMaterial(look.eyeColor), {
        position: [s * P.headR * 0.36, P.headR * 0.1, P.headR * 0.9],
      }),
      // pupila
      rigPart(new THREE.SphereGeometry(P.headR * 0.045, 8, 8), pupilMaterial(), {
        position: [s * P.headR * 0.36, P.headR * 0.1, P.headR * 0.94],
      }),
      // sobrancelha
      rigPart(new THREE.BoxGeometry(P.headR * 0.36, P.headR * 0.08, P.headR * 0.1), hair, {
        position: [s * P.headR * 0.36, P.headR * 0.32, P.headR * 0.84],
        rotation: [0, 0, s * 0.12],
      }),
      // orelha
      rigPart(new THREE.SphereGeometry(P.headR * 0.3, 8, 8), skin, {
        position: [s * P.headR * 0.94, 0, -P.headR * 0.05],
        scale: [0.4, 1, 0.7],
      }),
    );
    if (hi) {
      face.push(
        rigPart(new THREE.SphereGeometry(P.headR * 0.045, 6, 6), skinDetailMaterial(look.skin), {
          position: [s * P.headR * 0.09, -P.headR * 0.17, P.headR * 0.98],
        }),
      );
    }
    // pálpebra (grupo que pisca)
    blink.push(
      rigPart(new THREE.BoxGeometry(P.headR * 0.34, P.headR * 0.3, P.headR * 0.08), skin, {
        position: [s * P.headR * 0.36, P.headR * 0.16, P.headR * 0.84],
        scale: [1, 0.001, 1],
      }),
    );
    // maçãs do rosto
    face.push(
      rigPart(new THREE.SphereGeometry(P.headR * 0.26, 8, 8), skin, {
        position: [s * P.headR * 0.5, -P.headR * 0.16, P.headR * 0.66],
        scale: [1, 0.8, 0.6],
      }),
    );
  }

  if (hi) {
    face.push(
      rigPart(new THREE.SphereGeometry(P.headR * 0.6, 10, 10), skin, {
        position: [0, P.headR * 0.26, P.headR * 0.7],
        scale: [1, 0.35, 0.5],
      }),
    );
  }
  // nariz
  face.push(
    rigPart(new THREE.ConeGeometry(P.headR * 0.16, P.headR * 0.34, hi ? 10 : 6), skin, {
      position: [0, -P.headR * 0.05, P.headR * 0.95],
      rotation: [0.3, 0, 0],
    }),
  );
  // mandíbula articulada
  if (hi) {
    jaw.push(
      rigPart(new THREE.SphereGeometry(P.headR * 0.9, 12, 12), skin, {
        position: [0, -P.headR * 0.48, P.headR * 0.2],
        scale: [0.94, 0.5, 0.94],
      }),
    );
  }
  jaw.push(
    rigPart(new THREE.SphereGeometry(P.headR * 0.24, 8, 8), skin, {
      position: [0, -P.headR * 0.55, P.headR * 0.78],
      scale: [0.9, 0.6, 0.7],
    }),
  );
  if (hi) {
    face.push(
      rigPart(new THREE.SphereGeometry(P.headR * 0.2, 8, 8), skinDetailMaterial(look.skin), {
        position: [0, -P.headR * 0.36, P.headR * 0.84],
        scale: [1, 0.45, 0.6],
      }),
    );
  }
  face.push(
    rigPart(
      new THREE.BoxGeometry(P.headR * 0.34, P.headR * 0.07, P.headR * 0.06),
      skinDetailMaterial(look.skin),
      { position: [0, -P.headR * 0.45, P.headR * 0.84] },
    ),
  );

  /* -------------------------------------------------------------- barba */

  const beard: RigPart[] = [];
  if (look.beard === "moustache") {
    beard.push(
      rigPart(new THREE.BoxGeometry(P.headR * 0.44, P.headR * 0.1, P.headR * 0.12), hair, {
        position: [0, -P.headR * 0.3, P.headR * 0.86],
      }),
    );
  } else if (look.beard === "goatee") {
    beard.push(
      rigPart(new THREE.SphereGeometry(P.headR * 0.3, 8, 8), hair, {
        position: [0, -P.headR * 0.62, P.headR * 0.66],
        scale: [0.7, 1, 0.7],
      }),
    );
  } else if (look.beard === "stubble" || look.beard === "full") {
    beard.push(
      rigPart(
        new THREE.SphereGeometry(
          P.headR * 0.98,
          12,
          12,
          0,
          Math.PI * 2,
          Math.PI * 0.42,
          Math.PI * 0.4,
        ),
        hair,
        {
          position: [0, -P.headR * 0.35, P.headR * 0.12],
          scale: [1.01, look.beard === "full" ? 0.85 : 0.6, 1.01],
        },
      ),
    );
  }

  /* ------------------------------------------------------------- cabelo */

  const hairParts: RigPart[] = [];
  const style = look.hairStyle;
  if (style !== "bald") {
    const capHeight = (style === "buzz" ? 0.96 : style === "short" ? 1.02 : 1.06) * look.hairVolume;
    const capWide = 1.02 + (look.hairVolume - 1) * 0.5;
    hairParts.push(
      rigPart(
        new THREE.SphereGeometry(P.headR * 0.99, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
        hair,
        {
          position: [0, P.headR * 0.16, -P.headR * 0.04],
          scale: [capWide, capHeight, capWide + 0.02],
        },
      ),
    );
    if (hi && style !== "buzz") {
      for (let i = 0; i < 5; i += 1) {
        const t = (i - 2) / 2;
        hairParts.push(
          rigPart(
            new THREE.CapsuleGeometry(P.headR * 0.1, P.headR * 0.42 * look.hairVolume, 2, 6),
            hair,
            {
              position: [t * P.headR * 0.62, P.headR * 0.5, P.headR * 0.78],
              rotation: [0.85 + Math.abs(t) * 0.12, t * 0.35, t * 0.2],
            },
          ),
        );
      }
      hairParts.push(
        rigPart(
          new THREE.CapsuleGeometry(P.headR * 0.42, P.headR * 0.3 * look.hairVolume, 3, 10),
          hair,
          { position: [0, P.headR * 0.12, -P.headR * 0.82], rotation: [-0.35, 0, 0] },
        ),
      );
      for (const sx of [-1, 1] as const) {
        hairParts.push(
          rigPart(new THREE.CapsuleGeometry(P.headR * 0.22, P.headR * 0.28, 2, 8), hair, {
            position: [sx * P.headR * 0.86, P.headR * 0.08, P.headR * 0.1],
            scale: [0.5, 1, 1],
          }),
        );
      }
    }
    if (style === "mohawk") {
      hairParts.push(
        rigPart(
          new THREE.SphereGeometry(P.headR * 0.62, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.7),
          hair,
          { position: [0, P.headR * 0.95, 0], scale: [0.24, 1, 1.05] },
        ),
      );
    }
    if (style === "afro" || style === "curly") {
      hairParts.push(
        rigPart(new THREE.SphereGeometry(P.headR * (style === "afro" ? 1.24 : 1.1), 12, 12), hair, {
          position: [0, P.headR * 0.42, -P.headR * 0.02],
        }),
      );
    }
    if (style === "bun") {
      hairParts.push(
        rigPart(new THREE.SphereGeometry(P.headR * 0.34, 10, 10), hair, {
          position: [0, P.headR * 0.62, -P.headR * 0.95],
        }),
      );
    }
    if (style === "ponytail") {
      hairParts.push(
        rigPart(new THREE.CapsuleGeometry(P.headR * 0.16, P.headR * 0.8, 3, 8), hair, {
          position: [0, P.headR * 0.2, -P.headR * 1.05],
          rotation: [0.6, 0, 0],
        }),
      );
    }
    if (style === "dreads" || style === "braids") {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        hairParts.push(
          rigPart(new THREE.CapsuleGeometry(P.headR * 0.09, P.headR * 0.9, 2, 6), hair, {
            position: [Math.cos(a) * P.headR * 0.7, P.headR * 0.1, Math.sin(a) * P.headR * 0.7],
            rotation: [0.25, 0, 0],
          }),
        );
      }
    }
    if (look.headband) {
      hairParts.push(
        rigPart(
          new THREE.TorusGeometry(P.headR * 0.94, P.headR * 0.11, 6, 16),
          headbandMaterial(look.headbandColor),
          { position: [0, P.headR * 0.42, 0], rotation: [Math.PI / 2, 0, 0] },
        ),
      );
    }
  }

  /* --------------------------------------------------------- braços/pernas */

  const armL: RigPart[] = [];
  const armR: RigPart[] = [];
  const foreL: RigPart[] = [];
  const foreR: RigPart[] = [];
  const handL: RigPart[] = [];
  const handRig: RigPart[] = [];
  const handDetailL: RigPart[] = [];
  const handDetailR: RigPart[] = [];
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
    const leg = isLeft ? legL : legR;
    const knee = isLeft ? kneeL : kneeR;
    const ankle = isLeft ? ankleL : ankleR;
    const bootDetail = isLeft ? bootDetailL : bootDetailR;
    const sleeveMat = look.sleeves === "long" ? jersey : skin;

    /* braço */
    arm.push(
      rigPart(
        new THREE.SphereGeometry(P.armR * 1.35, segs.radial, segs.radial),
        jersey,
        undefined,
        cast,
      ),
    );
    if (hi) {
      arm.push(
        rigPart(
          new THREE.SphereGeometry(P.armR * 1.12, segs.radial, segs.radial),
          jersey,
          {
            position: [side * P.armR * 0.28, -P.upperArm * 0.1, 0],
            scale: [1, 1.18, 0.92],
          },
          cast,
        ),
      );
    }
    arm.push(
      rigPart(
        new THREE.CapsuleGeometry(P.armR, P.upperArm * 0.78, segs.cap, segs.radial),
        sleeveMat,
        { position: [0, -P.upperArm * 0.5, 0] },
        cast,
      ),
    );
    if (hi && look.sleeves !== "long") {
      arm.push(
        rigPart(
          new THREE.SphereGeometry(P.armR * 0.78, segs.radial, segs.radial),
          skin,
          {
            position: [0, -P.upperArm * 0.58, P.armR * 0.12],
            scale: [0.9, 1.35, 0.9],
          },
          cast,
        ),
      );
    }
    if (look.sleeves === "short") {
      arm.push(
        rigPart(
          new THREE.CapsuleGeometry(P.armR * 1.22, P.upperArm * 0.3, 2, segs.radial),
          jersey,
          { position: [0, -P.upperArm * 0.24, 0] },
          cast,
        ),
      );
    }
    if (look.captain && side === 1) {
      arm.push(
        rigPart(
          new THREE.CylinderGeometry(P.armR * 1.28, P.armR * 1.28, 0.05, segs.radial),
          armbandMaterial(),
          { position: [0, -P.upperArm * 0.42, 0] },
        ),
      );
    }

    /* antebraço e mão */
    fore.push(
      rigPart(
        new THREE.CapsuleGeometry(P.armR * 0.88, P.foreArm * 0.76, segs.cap, segs.radial),
        sleeveMat,
        { position: [0, -P.foreArm * 0.5, 0] },
        cast,
      ),
    );
    hand.push(
      rigPart(new THREE.SphereGeometry(handR, segs.radial, segs.radial), handMat, undefined, cast),
    );
    for (let i = 0; i < 4; i += 1) {
      handDetail.push(
        rigPart(new THREE.CapsuleGeometry(handR * 0.2, handR * 0.7, 2, 5), handMat, {
          position: [(i - 1.5) * handR * 0.45, -handR * 0.85, 0],
          rotation: [0.15, 0, 0],
        }),
      );
    }

    /* perna */
    leg.push(
      rigPart(
        new THREE.CapsuleGeometry(P.legR, P.thigh * 0.72, segs.cap, segs.radial),
        skin,
        { position: [0, -P.thigh * 0.5, 0] },
        cast,
      ),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 0.72, P.thigh * 0.3, segs.cap, segs.radial),
        skin,
        {
          position: [0, -P.thigh * 0.62, P.legR * 0.24],
          scale: [0.9, 1, 0.7],
        },
        cast,
      ),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 1.3, P.thigh * 0.24, 2, segs.radial),
        shorts,
        { position: [0, -P.thigh * 0.32, 0] },
        cast,
      ),
      rigPart(new THREE.CylinderGeometry(P.legR * 1.31, P.legR * 1.28, 0.02, segs.radial), trim, {
        position: [0, -P.thigh * 0.44, 0],
      }),
    );

    /* joelho e canela */
    knee.push(
      rigPart(new THREE.SphereGeometry(P.legR * 0.94, segs.radial, segs.radial), skin),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 0.86, P.shin * 0.66, segs.cap, segs.radial),
        skin,
        { position: [0, -P.shin * 0.5, 0] },
        cast,
      ),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 0.68, P.shin * 0.26, segs.cap, segs.radial),
        skin,
        {
          position: [0, -P.shin * 0.34, -P.legR * 0.22],
          scale: [0.85, 1, 0.75],
        },
        cast,
      ),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 0.94, P.shin * 0.44, segs.cap, segs.radial),
        socks,
        { position: [0, -P.shin * 0.62, 0] },
        cast,
      ),
      rigPart(
        new THREE.CapsuleGeometry(P.legR * 0.7, P.shin * 0.3, 2, segs.radial),
        socks,
        {
          position: [0, -P.shin * 0.55, P.legR * 0.5],
          scale: [0.8, 1, 0.35],
        },
        cast,
      ),
      rigPart(new THREE.CylinderGeometry(P.legR * 1.02, P.legR * 0.98, 0.045, segs.radial), trim, {
        position: [0, -P.shin * 0.36, 0],
      }),
    );
    if (look.sockTape) {
      knee.push(
        rigPart(
          new THREE.CylinderGeometry(P.legR * 1.03, P.legR * 1.03, 0.035, segs.radial),
          trim,
          { position: [0, -P.shin * 0.46, 0] },
        ),
      );
    }

    /* tornozelo e chuteira */
    ankle.push(
      rigPart(new THREE.CapsuleGeometry(P.legR * 0.72, P.footH * 0.2, 2, segs.radial), socks, {
        position: [0, P.footH * 0.12, 0],
      }),
      rigPart(
        new THREE.CapsuleGeometry(P.footH * 0.5, P.footLen * 0.45, 3, segs.radial),
        boot,
        { position: [0, -P.footH * 0.32, P.footLen * 0.16] },
        cast,
      ),
      rigPart(
        new THREE.SphereGeometry(P.footH * 0.46, segs.radial, segs.radial),
        boot,
        {
          position: [0, -P.footH * 0.45, P.footLen * 0.42],
          scale: [0.85, 0.7, 1],
        },
        cast,
      ),
      rigPart(new THREE.SphereGeometry(P.footH * 0.44, segs.radial, segs.radial), boot, {
        position: [0, -P.footH * 0.24, -P.footLen * 0.16],
        scale: [0.85, 1, 0.7],
      }),
      rigPart(new THREE.BoxGeometry(P.footH * 1.04, P.footH * 0.12, P.footLen * 0.4), bootAccent, {
        position: [0, -P.footH * 0.34, P.footLen * 0.18],
        rotation: [0, 0, 0.1],
      }),
      rigPart(new THREE.BoxGeometry(P.footH * 1.0, P.footH * 0.16, P.footLen * 0.86), sole, {
        position: [0, -P.footH * 0.62, P.footLen * 0.1],
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
    hair: mergeRigParts([...hairParts, ...beard]),
    face: mergeRigParts(face),
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
