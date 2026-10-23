import { emptyPose, type Clip, type ClipCtx, type Pose } from "./animation-core";

const ease = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const bell = (u: number, a: number, b: number) => Math.sin(Math.PI * ease((u - a) / (b - a)));
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a));
function stance(c: ClipCtx): Pose {
  const p = emptyPose();
  p.legLPitch = p.legRPitch = -0.08;
  p.kneeL = p.kneeR = -0.16;
  p.ankleL = p.ankleR = 0.08;
  p.armLRoll = 0.12;
  p.armRRoll = -0.12;
  p.elbowL = p.elbowR = -0.22;
  p.spine = 0.035;
  p.headYaw = Math.sin(c.seed * 0.013) * 0.025;
  return p;
}
function support(p: Pose, load: number, side = 1) {
  p.hipY -= load * 0.035;
  p.hipRoll += side * load * 0.055;
  p.legLPitch -= load * 0.1;
  p.kneeL -= load * 0.2;
  p.ankleL += load * 0.1;
  p.armLRoll += load * 0.19;
  p.armRRoll -= load * 0.16;
}

/** Twelve authored sequences. u follows the authoritative event; no ball,
 * player position, random generator or gameplay clock is mutated here. */
export const FOOTBALL_SEQUENCE_CLIPS = {
  receiveOriented: ((c) => {
    const p = stance(c),
      receive = bell(c.u, 0.08, 0.7),
      exit = bell(c.u, 0.4, 1);
    support(p, receive);
    p.legRPitch -= receive * 0.42;
    p.kneeR -= receive * 0.56;
    p.ankleR -= receive * 0.23;
    p.hipYaw += exit * 0.24;
    p.chest -= exit * 0.16;
    p.headYaw += exit * 0.2;
    p.armLPitch -= receive * 0.17;
    p.armRPitch += exit * 0.25;
    return p;
  }) satisfies Clip,
  chestControlExit: ((c) => {
    const p = stance(c),
      cushion = bell(c.u, 0.12, 0.75),
      exit = bell(c.u, 0.52, 1);
    support(p, cushion * 0.6);
    p.spine -= cushion * 0.21;
    p.chest += cushion * 0.08;
    p.headPitch += cushion * 0.14;
    p.armLRoll += cushion * 0.38;
    p.armRRoll -= cushion * 0.36;
    p.elbowL -= cushion * 0.46;
    p.elbowR -= cushion * 0.44;
    p.legRPitch -= exit * 0.35;
    p.kneeR -= exit * 0.45;
    p.hipYaw += exit * 0.17;
    return p;
  }) satisfies Clip,
  thighCushion: ((c) => {
    const p = stance(c),
      lift = bell(c.u, 0.06, 0.76),
      settle = bell(c.u, 0.52, 1);
    support(p, lift * 0.7);
    p.legRPitch -= lift * 0.88;
    p.kneeR -= lift * 1.05;
    p.ankleR -= lift * 0.22;
    p.spine += lift * 0.08;
    p.headPitch += lift * 0.18;
    p.armLPitch -= lift * 0.29;
    p.elbowL -= lift * 0.31;
    p.hipYaw += settle * 0.16;
    return p;
  }) satisfies Clip,
  shieldPivot: ((c) => {
    const p = stance(c),
      brace = bell(c.u, 0, 1),
      pivot = ramp(c.u, 0.15, 0.65) * (1 - ramp(c.u, 0.8, 1));
    support(p, brace);
    p.hipYaw += pivot * 0.42;
    p.chest -= pivot * 0.31;
    p.legLRoll += brace * 0.11;
    p.legRRoll -= brace * 0.17;
    p.armLRoll += brace * 0.53;
    p.elbowL -= brace * 0.37;
    p.armRPitch -= brace * 0.18;
    p.headYaw -= pivot * 0.27;
    return p;
  }) satisfies Clip,
  brakeCut90: ((c) => {
    const p = stance(c),
      brake = bell(c.u, 0, 0.65),
      cut = bell(c.u, 0.24, 1);
    support(p, brake * 1.4, -1);
    p.hipPitch -= brake * 0.12;
    p.legRPitch -= brake * 0.18;
    p.kneeR -= brake * 0.46;
    p.ankleR += brake * 0.22;
    p.hipYaw -= cut * 0.34;
    p.chest += cut * 0.22;
    p.headYaw -= cut * 0.33;
    p.armLPitch += cut * 0.32;
    p.armRPitch -= cut * 0.4;
    return p;
  }) satisfies Clip,
  backpedalBurst: ((c) => {
    const p = stance(c),
      retreat = bell(c.u, 0, 0.55),
      drive = bell(c.u, 0.32, 1);
    support(p, retreat * 0.6);
    p.legLPitch += retreat * 0.18 - drive * 0.48;
    p.kneeL -= retreat * 0.25 + drive * 0.62;
    p.legRPitch += drive * 0.3;
    p.kneeR -= drive * 0.35;
    p.ankleR -= drive * 0.28;
    p.hipPitch += drive * 0.12;
    p.spine += drive * 0.07;
    p.armLPitch += drive * 0.5;
    p.armRPitch -= drive * 0.55;
    return p;
  }) satisfies Clip,
  runningPassRecover: ((c) => {
    const p = stance(c),
      wind = bell(c.u, 0, 0.45),
      strike = bell(c.u, 0.25, 0.8),
      recover = bell(c.u, 0.65, 1);
    support(p, bell(c.u, 0.05, 0.85));
    p.legRPitch += wind * 0.33 - strike * 0.68;
    p.kneeR -= wind * 0.67;
    p.ankleR -= strike * 0.22;
    p.hipYaw += strike * 0.14;
    p.chest -= strike * 0.17;
    p.armLPitch -= strike * 0.38;
    p.armRPitch += strike * 0.32;
    p.legLPitch -= recover * 0.3;
    p.kneeL -= recover * 0.45;
    return p;
  }) satisfies Clip,
  offBalanceFinish: ((c) => {
    const p = stance(c),
      strike = bell(c.u, 0.12, 0.68),
      recover = bell(c.u, 0.55, 1);
    support(p, strike * 0.8, -1);
    p.hipRoll -= strike * 0.13;
    p.chest += strike * 0.24;
    p.legRPitch -= strike * 0.85;
    p.kneeR -= bell(c.u, 0, 0.42) * 0.8;
    p.ankleR -= strike * 0.31;
    p.armLRoll += strike * 0.6;
    p.armRPitch += strike * 0.52;
    p.kneeL -= recover * 0.35;
    p.spine += recover * 0.13;
    return p;
  }) satisfies Clip,
  tackleRecover: ((c) => {
    const p = stance(c),
      reach = bell(c.u, 0, 0.7),
      recover = bell(c.u, 0.45, 1);
    support(p, reach);
    p.legRPitch -= reach * 0.68;
    p.kneeR -= reach * 0.2;
    p.ankleR -= reach * 0.12;
    p.spine += reach * 0.23;
    p.headPitch -= reach * 0.1;
    p.armLPitch -= reach * 0.31;
    p.armRRoll -= reach * 0.24;
    p.legLRoll += recover * 0.1;
    p.kneeL -= recover * 0.25;
    return p;
  }) satisfies Clip,
  aerialLanding: ((c) => {
    const p = stance(c),
      rise = bell(c.u, 0, 0.52),
      landing = bell(c.u, 0.4, 1);
    p.hipY = rise * 0.11 - landing * 0.09;
    p.kneeL -= landing * 0.65;
    p.kneeR -= landing * 0.52;
    p.legLPitch -= landing * 0.32;
    p.legRPitch -= landing * 0.26;
    p.ankleL += landing * 0.32;
    p.ankleR += landing * 0.26;
    p.spine += landing * 0.15;
    p.armLRoll += rise * 0.55 + landing * 0.2;
    p.armRRoll -= rise * 0.55 + landing * 0.2;
    p.headPitch -= rise * 0.14;
    return p;
  }) satisfies Clip,
  keeperParryRecover: ((c) => {
    const p = stance(c),
      reach = bell(c.u, 0.1, 0.8),
      reset = bell(c.u, 0.65, 1);
    support(p, reach * 0.7);
    p.armLPitch -= reach * 1.65;
    p.armRPitch -= reach * 1.42;
    p.armLRoll += reach * 0.52;
    p.armRRoll -= reach * 0.35;
    p.elbowL = -0.6 + reach * 0.42;
    p.elbowR = -0.68 + reach * 0.38;
    p.spine -= reach * 0.08;
    p.headPitch -= reach * 0.19;
    p.kneeL -= reset * 0.45;
    p.kneeR -= reset * 0.45;
    return p;
  }) satisfies Clip,
  keeperRiseDistribute: ((c) => {
    const p = stance(c),
      rise = 1 - ramp(c.u, 0, 0.55),
      release = bell(c.u, 0.1, 0.8);
    p.hipY -= rise * 0.13;
    p.legLPitch -= rise * 0.48;
    p.kneeL -= rise * 0.95;
    p.legRPitch -= rise * 0.2;
    p.kneeR -= rise * 0.42;
    p.spine += rise * 0.2;
    p.armLPitch = -0.48 + release * 0.25;
    p.armRPitch = -0.5 - release * 0.75;
    p.elbowL = -0.85 + release * 0.2;
    p.elbowR = -0.9 + release * 0.65;
    p.chest -= release * 0.18;
    p.hipYaw += release * 0.12;
    return p;
  }) satisfies Clip,
} as const;

export const SEQUENCE_LIBRARY = [
  ["receiveOriented", "Recepção orientada em dois toques", "trap", "ballControl"],
  ["chestControlExit", "Domínio de peito e saída", "trap", "ballControl"],
  ["thighCushion", "Amortecimento com a coxa", "trap", "ballControl"],
  ["shieldPivot", "Proteção de bola e giro", "duel", "ballControl"],
  ["brakeCut90", "Frenagem e corte de direção", "decelerate", "locomotion"],
  ["backpedalBurst", "Recuo e arranque", "backpedal", "locomotion"],
  ["runningPassRecover", "Passe em movimento e recomposição", "pass", "passing"],
  ["offBalanceFinish", "Finalização em desequilíbrio", "shotPlaced", "shooting"],
  ["tackleRecover", "Desarme e recomposição", "tackle", "defense"],
  ["aerialLanding", "Pouso após disputa aérea", "header", "recovery"],
  ["keeperParryRecover", "Espalmada e recuperação", "save", "goalkeeper"],
  ["keeperRiseDistribute", "Levantada e reposição do goleiro", "distribute", "goalkeeper"],
] as const;
