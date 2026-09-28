// ============================================================================
//  ground-contact.ts
//  Plantio de pé no gramado e limites anatômicos das juntas.
//
//  Problema que este módulo resolve
//  --------------------------------
//  O `PlayerRig` posicionava o atleta com `position.y` fixo em 0 e confiava que
//  `P.hipY = thigh + shin + footH` colocaria a sola exatamente no gramado. Isso
//  só é verdade para um boneco perfeitamente ereto, com quadril sem offset e
//  sem inclinação de corpo. Na prática:
//
//    1. a raiz da perna nasce em `-hipH * 0.4` abaixo do quadril, então mesmo
//       parado a sola já ficava ~5 cm **enterrada** no gramado;
//    2. `pose.hipY` (agachar, saltar, cair) mexia o quadril sem que as pernas
//       compensassem — o atleta afundava ou flutuava;
//    3. a inclinação do corpo (`root.rotation.x/z`) gira em torno de um pivô no
//       nível do chão: quanto mais inclinado, mais um pé enterra e o outro sobe;
//    4. joelho e tornozelo dobrados encurtam a perna — ninguém devolvia essa
//       altura para a raiz, então o atleta "flutuava" em toda passada.
//
//  A solução é cinemática direta (FK): a partir das proporções reais do atleta
//  e da pose do quadro, calculamos onde a sola de cada pé realmente está em
//  espaço de mundo e devolvemos:
//
//    * `rootY`  — deslocamento vertical da raiz que planta o pé de apoio;
//    * `ankleLFix` / `ankleRFix` — correção de tornozelo para a sola ficar
//      paralela ao gramado no pé que está apoiado;
//    * `contactL` / `contactR` — quanto cada pé está de fato apoiado (0..1),
//      útil para poeira, som de passada e sombra de contato.
//
//  Tudo aqui é puro (sem three.js, sem React): dá para testar em Node e rodar
//  tanto no rig herói quanto nos jogadores instanciados.
// ============================================================================

import type { Pose } from "./animation-core";
import type { Proportions } from "./player-model";

/* -------------------------------------------------------------------------- */
/*  Vetores mínimos                                                           */
/* -------------------------------------------------------------------------- */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

/** rotação de um vetor por Euler XYZ intrínseco — a mesma ordem do three.js */
function rotateEulerXYZ(v: Vec3, rx: number, ry: number, rz: number, out: Vec3): Vec3 {
  let { x, y, z } = v;

  if (rx !== 0) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }
  if (ry !== 0) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const nx = x * c + z * s;
    const nz = -x * s + z * c;
    x = nx;
    z = nz;
  }
  if (rz !== 0) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx;
    y = ny;
  }

  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Limites anatômicos                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Amplitude articular máxima aceita pelo rig, em radianos. Os valores seguem a
 * amplitude real de um atleta (com folga de estilo), e existem porque as
 * camadas aditivas — clipe + transição + IK + olhar + cansaço + inclinação —
 * podem somar ângulos que nenhum corpo faz. Era daí que vinham os modelos
 * "deformados": joelho invertido, tornozelo dobrado 180°, ombro atravessando o
 * peito.
 *
 * Convenção de sinal do rig:
 *  - `kneeL/kneeR` são **negativos** ao flexionar (a canela vai para trás);
 *  - `legLPitch` positivo leva a coxa para a frente;
 *  - `ankle*` positivo aponta a ponta do pé para baixo.
 */
export const JOINT_LIMITS: Partial<Record<keyof Pose, readonly [number, number]>> = {
  hipY: [-0.62, 0.55],
  hipPitch: [-0.55, 0.75],
  hipRoll: [-0.45, 0.45],
  hipYaw: [-0.8, 0.8],
  spine: [-0.5, 0.95],
  chest: [-0.45, 0.8],
  headPitch: [-0.7, 0.7],
  headYaw: [-1.25, 1.25],
  armLPitch: [-2.9, 2.0],
  armRPitch: [-2.9, 2.0],
  armLRoll: [-0.35, 2.4],
  armRRoll: [-2.4, 0.35],
  elbowL: [-2.6, 0.12],
  elbowR: [-2.6, 0.12],
  legLPitch: [-1.15, 2.1],
  legRPitch: [-1.15, 2.1],
  legLRoll: [-0.55, 0.6],
  legRRoll: [-0.6, 0.55],
  kneeL: [-2.45, 0.05],
  kneeR: [-2.45, 0.05],
  ankleL: [-0.75, 0.85],
  ankleR: [-0.75, 0.85],
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Trava a pose dentro da amplitude anatômica. Mutação no lugar, sem alocar:
 * roda 22 vezes por atleta por quadro e precisa ser barato.
 *
 * Valores não-finitos (NaN de uma divisão por zero em algum clipe) são zerados
 * em vez de propagados — um NaN numa junta explode a matriz do osso e o atleta
 * some da cena ou vira um borrão esticado até o infinito.
 */
export function clampPoseAnatomy(pose: Pose): Pose {
  for (const key of Object.keys(JOINT_LIMITS) as (keyof Pose)[]) {
    const range = JOINT_LIMITS[key];
    if (!range) continue;
    const value = pose[key];
    if (!Number.isFinite(value)) {
      pose[key] = 0;
      continue;
    }
    pose[key] = clamp(value, range[0], range[1]);
  }
  return pose;
}

/**
 * Sinaliza se a pose passou por alguma trava. Usado em teste e no painel de
 * diagnóstico `/visual` para encontrar clipes que estouram amplitude.
 */
export function poseExceedsLimits(pose: Pose): (keyof Pose)[] {
  const out: (keyof Pose)[] = [];
  for (const key of Object.keys(JOINT_LIMITS) as (keyof Pose)[]) {
    const range = JOINT_LIMITS[key];
    if (!range) continue;
    const value = pose[key];
    if (!Number.isFinite(value) || value < range[0] - 1e-6 || value > range[1] + 1e-6) {
      out.push(key);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Cinemática direta das pernas                                              */
/* -------------------------------------------------------------------------- */

/** Offset vertical da raiz da perna em relação ao quadril (ver `rig-skin`). */
export const LEG_ROOT_DROP = 0.4;

export interface LegChainResult {
  /** posição do tornozelo em espaço de raiz do atleta */
  ankle: Vec3;
  /** posição da sola (ponto mais baixo do pé) em espaço de raiz */
  sole: Vec3;
  /** ângulo total do pé no plano sagital: hip + knee + ankle */
  footPitch: number;
}

const tmpA = vec();
const tmpB = vec();

/**
 * Resolve a cadeia quadril → joelho → tornozelo → sola de um lado, em espaço
 * local da raiz do atleta (antes da inclinação do corpo).
 *
 * As transformações replicam exatamente a hierarquia montada em `rig-skin.ts`:
 *
 *   hips   : posição (shiftX, P.hipY + pose.hipY, 0), rotação (hipPitch, hipYaw, hipRoll)
 *   legX   : posição (±hipW*0.46, -hipH*0.4, 0),      rotação (legPitch, 0, legRoll)
 *   kneeX  : posição (0, -thigh, 0),                  rotação (knee, 0, 0)
 *   ankleX : posição (0, -shin, 0),                   rotação (ankle, 0, 0)
 *   sola   : posição (0, -footH, 0) no espaço do tornozelo
 *
 * Se a hierarquia do rig mudar, este cálculo precisa mudar junto — o teste
 * `ground-contact.test.ts` compara os dois e falha se divergirem.
 */
export function solveLegChain(
  P: Proportions,
  pose: Pose,
  side: "L" | "R",
  hipShiftX = 0,
  out?: LegChainResult,
): LegChainResult {
  const result: LegChainResult = out ?? {
    ankle: vec(),
    sole: vec(),
    footPitch: 0,
  };

  const legPitch = side === "L" ? pose.legLPitch : pose.legRPitch;
  const legRoll = side === "L" ? pose.legLRoll : pose.legRRoll;
  const knee = side === "L" ? pose.kneeL : pose.kneeR;
  const ankle = side === "L" ? pose.ankleL : pose.ankleR;

  // --- origem do quadril no espaço da raiz
  const hipX = hipShiftX;
  const hipYWorld = P.hipY + pose.hipY;

  // --- raiz da perna, ainda no espaço do quadril
  const legRootLocal = vec(
    side === "L" ? P.hipW * 0.46 : -P.hipW * 0.46,
    -P.hipH * LEG_ROOT_DROP,
    0,
  );
  rotateEulerXYZ(legRootLocal, pose.hipPitch, pose.hipYaw, pose.hipRoll, tmpA);
  const legRootX = hipX + tmpA.x;
  const legRootY = hipYWorld + tmpA.y;
  const legRootZ = tmpA.z;

  // --- rotação acumulada da coxa: quadril ∘ perna
  // Composição exata de Euler daria trabalho; como `hipYaw` é pequeno e o resto
  // é praticamente sagital, somamos pitch/roll e mantemos o yaw do quadril.
  const thighPitch = pose.hipPitch + legPitch;
  const thighRoll = pose.hipRoll + legRoll;
  const yaw = pose.hipYaw;

  // coxa: do quadril até o joelho
  rotateEulerXYZ(vec(0, -P.thigh, 0), thighPitch, yaw, thighRoll, tmpA);
  const kneeX = legRootX + tmpA.x;
  const kneeY = legRootY + tmpA.y;
  const kneeZ = legRootZ + tmpA.z;

  // canela: do joelho até o tornozelo
  const shinPitch = thighPitch + knee;
  rotateEulerXYZ(vec(0, -P.shin, 0), shinPitch, yaw, thighRoll, tmpB);
  const ankleX = kneeX + tmpB.x;
  const ankleY = kneeY + tmpB.y;
  const ankleZ = kneeZ + tmpB.z;

  // sola: do tornozelo até o chão do pé
  const footPitch = shinPitch + ankle;
  rotateEulerXYZ(vec(0, -P.footH, 0), footPitch, yaw, thighRoll, tmpA);

  result.ankle.x = ankleX;
  result.ankle.y = ankleY;
  result.ankle.z = ankleZ;
  result.sole.x = ankleX + tmpA.x;
  result.sole.y = ankleY + tmpA.y;
  result.sole.z = ankleZ + tmpA.z;
  result.footPitch = footPitch;
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Contato com o gramado                                                     */
/* -------------------------------------------------------------------------- */

export interface GroundContactInput {
  /** proporções do atleta */
  P: Proportions;
  /** pose já misturada e travada pelos limites anatômicos */
  pose: Pose;
  /** deslocamento lateral do quadril aplicado no rig (transferência de peso) */
  hipShiftX?: number;
  /** inclinação do corpo em torno do pivô no gramado */
  leanX?: number;
  leanZ?: number;
  /** altura do gramado sob o atleta (relevo/desgaste); padrão 0 */
  groundY?: number;
  /**
   * 0 = totalmente apoiado, 1 = totalmente no ar (salto, carrinho, queda).
   * Em voo o solver não força a sola para o gramado, só impede que ela afunde.
   */
  airborne?: number;
  /** estado anterior de `rootY`, para suavizar o plantio entre quadros */
  previousRootY?: number;
  /** passo do quadro em segundos, usado na suavização */
  dt?: number;
}

export interface GroundContactResult {
  /** deslocamento vertical a aplicar em `root.position.y` */
  rootY: number;
  /** correção de tornozelo para a sola encostar paralela ao gramado */
  ankleLFix: number;
  ankleRFix: number;
  /** 0..1 de quanto cada pé está apoiado */
  contactL: number;
  contactR: number;
  /** altura da sola mais baixa antes da correção (diagnóstico) */
  lowestSole: number;
  /** distância entre as duas solas — base de apoio, usada pela sombra */
  stanceSpread: number;
}

/** margem de tolerância: abaixo disso o pé é considerado apoiado */
const CONTACT_BAND = 0.045;

const chainL: LegChainResult = { ankle: vec(), sole: vec(), footPitch: 0 };
const chainR: LegChainResult = { ankle: vec(), sole: vec(), footPitch: 0 };
const leanTmp = vec();

/**
 * Calcula o deslocamento de raiz que planta o atleta no gramado.
 *
 * Regra: **a sola mais baixa manda**. Depois de resolver as duas pernas, a raiz
 * sobe (ou desce) exatamente o quanto for preciso para essa sola tocar o
 * gramado. É o mesmo princípio de um "pelvis grounding" de engine comercial e
 * resolve de uma vez afundamento, flutuação e o degrau de 5 cm herdado de
 * `-hipH * 0.4`.
 *
 * Em voo (`airborne` ≈ 1) a correção só age para cima: o atleta pode estar
 * legitimamente no ar, mas nunca dentro do gramado.
 */
export function solveGroundContact(input: GroundContactInput): GroundContactResult {
  const {
    P,
    pose,
    hipShiftX = 0,
    leanX = 0,
    leanZ = 0,
    groundY = 0,
    airborne = 0,
    previousRootY,
    dt = 1 / 60,
  } = input;

  solveLegChain(P, pose, "L", hipShiftX, chainL);
  solveLegChain(P, pose, "R", hipShiftX, chainR);

  // A inclinação do corpo gira o atleta inteiro em torno do pivô da raiz, que
  // fica no gramado. Aplicá-la às solas antes de medir é o que impede o pé de
  // trás de subir no arranque e o pé de dentro de enterrar na curva.
  rotateEulerXYZ(chainL.sole, leanX, 0, leanZ, leanTmp);
  const soleLY = leanTmp.y;
  const soleLX = leanTmp.x;
  const soleLZ = leanTmp.z;

  rotateEulerXYZ(chainR.sole, leanX, 0, leanZ, leanTmp);
  const soleRY = leanTmp.y;
  const soleRX = leanTmp.x;
  const soleRZ = leanTmp.z;

  const lowestSole = Math.min(soleLY, soleRY);

  // Deslocamento bruto: leva a sola mais baixa exatamente ao gramado.
  let rootY = groundY - lowestSole;

  if (airborne > 0) {
    // No ar só corrigimos penetração. A parcela de plantio some junto com o
    // peso: um atleta em salto não deve ser "colado" no chão.
    const grounded = 1 - Math.min(1, Math.max(0, airborne));
    rootY = rootY > 0 ? rootY : rootY * grounded;
  }

  // Suavização temporal independente de FPS: evita o "solavanco" de um quadro
  // em que o clipe troca e a sola de apoio muda de pé.
  if (previousRootY !== undefined && Number.isFinite(previousRootY)) {
    const k = 1 - Math.exp(-26 * Math.max(dt, 1 / 240));
    rootY = previousRootY + (rootY - previousRootY) * k;
  }

  if (!Number.isFinite(rootY)) rootY = 0;
  // Trava de segurança: nenhum ajuste plausível passa de meio metro. Se passar,
  // a pose está corrompida e é melhor deixar o atleta no gramado do que vê-lo
  // disparar para o céu.
  rootY = clamp(rootY, -0.5, 0.9);

  // ---- nivelamento da sola
  // Um pé apoiado tem que ficar paralelo ao gramado; o `footPitch` acumulado do
  // clipe raramente fica. Corrigimos o tornozelo pela diferença, proporcional
  // a quanto o pé está de fato apoiado, para o pé no ar manter o desenho do
  // clipe (ponta esticada na passada, por exemplo).
  const heightL = soleLY + rootY - groundY;
  const heightR = soleRY + rootY - groundY;
  const contactL = 1 - Math.min(1, Math.max(0, heightL / CONTACT_BAND));
  const contactR = 1 - Math.min(1, Math.max(0, heightR / CONTACT_BAND));

  const levelL = -(chainL.footPitch + leanX);
  const levelR = -(chainR.footPitch + leanX);
  const ankleLFix = clamp(levelL * contactL * 0.8, -0.55, 0.55);
  const ankleRFix = clamp(levelR * contactR * 0.8, -0.55, 0.55);

  const stanceSpread = Math.hypot(soleLX - soleRX, soleLZ - soleRZ);

  return {
    rootY,
    ankleLFix,
    ankleRFix,
    contactL,
    contactR,
    lowestSole,
    stanceSpread,
  };
}

/**
 * Quanto o clipe atual tira o atleta do chão. Salto, cabeceio, voo de goleiro e
 * carrinho não devem ser "colados" no gramado.
 */
export function airborneFactor(clipName: string, poseHipY: number): number {
  const lifted = Math.max(0, poseHipY) / 0.35;
  const aerial = /jump|header|dive|leap|bicycle|volley|acrobat|salto|voo|cabec/i.test(clipName)
    ? 1
    : 0;
  return Math.min(1, Math.max(aerial * 0.85, lifted));
}
