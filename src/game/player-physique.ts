import { makeRng } from "./rng";
import type { Player } from "./types";
import type { DetailedAttributes } from "./attributes";

function clamp(v: number) {
  return Math.max(20, Math.min(99, Math.round(v)));
}

export function buildAttrs(p: Player, rnd: () => number): DetailedAttributes {
  const j = (base: number, spread = 7) => clamp(base + rnd() * spread - spread / 2);
  const { ovr, pos } = p;
  const pace = p.pace;
  const sho = p.shooting;
  const pas = p.passing;
  const def = p.defending;
  const phy = p.physical;
  // New attributes have an independent stream: old face, height, foot and
  // attribute identity must not shift when the schema gains a field.
  const advancedRng = makeRng(`advanced-attributes-${p.id}-${p.name}`);
  const extra = (base: number, spread = 7) => clamp(base + advancedRng() * spread - spread / 2);
  const advanced = {
    balance: extra((pace + phy) / 2 + (pos === "MF" ? 3 : 0)),
    naturalFitness: extra(phy - 1),
    injuryResistance: extra(phy - 3),
    anticipation: extra(ovr - 4 + (pos === "DF" || pos === "GK" ? 4 : 0)),
    concentration: extra(ovr - 4 + (p.age >= 28 ? 3 : 0)),
    bravery: extra(phy - 3 + (pos === "DF" || pos === "GK" ? 5 : 0)),
    aggression: extra(phy - 5 + (pos === "DF" ? 7 : 0)),
    offBall: extra(ovr - 5 + (pos === "FW" ? 6 : pos === "MF" ? 2 : -4)),
    teamwork: extra(ovr - 4 + (pos === "MF" ? 3 : 0)),
    determination: extra(ovr - 5 + (p.age <= 23 ? 2 : 0)),
    consistency: extra(ovr - 7 + (p.age >= 28 ? 4 : 0)),
    technique: extra((pas + sho) / 2 + (pos === "MF" ? 3 : 0)),
    ballControl: extra((pas + sho + pace) / 3 + (pos === "FW" || pos === "MF" ? 3 : -5)),
    flair: extra((pas + sho) / 2 - 3 + (pos === "FW" ? 4 : 0), 12),
  };

  const common = {
    pace: j(pace, 4),
    acceleration: j(pace + (pos === "FW" ? 3 : 0)),
    strength: j(phy),
    stamina: j(phy - 2 + (pos === "MF" ? 6 : 0)),
    agility: j(pace - 2 + (pos === "GK" ? 6 : 0)),
    jumping: j(phy - 3 + (pos === "DF" || pos === "GK" ? 6 : 0)),
    positioning: j(ovr - 2),
    composure: j(ovr - 3),
    leadership: j(ovr - 10 + (p.age > 29 ? 8 : 0)),
    workRate: j(ovr - 4),
    discipline: j(72 + rnd() * 20, 6),
    decisions: j(ovr - 3),
  };

  if (pos === "GK") {
    return {
      ...advanced,
      ...common,
      finishing: j(30, 10),
      dribbling: j(38, 10),
      passing: j(pas),
      vision: j(pas - 6),
      crossing: j(28, 10),
      firstTouch: j(pas - 8),
      longShots: j(34, 12),
      setPieces: j(35, 14),
      marking: j(35, 10),
      tackling: j(32, 10),
      heading: j(40, 12),
      interceptions: j(42, 12),
      reflexes: j(def + 3),
      handling: j(def),
      aerialReach: j(def - 2),
      distribution: j(pas + 2),
      oneOnOnes: extra(def + 2),
      commandOfArea: extra(def - 1 + (p.age >= 27 ? 3 : 0)),
      rushingOut: extra(pace + 1),
      communication: extra(ovr - 5 + (p.age >= 29 ? 5 : 0)),
    };
  }

  const attack = pos === "FW";
  const mid = pos === "MF";
  const back = pos === "DF";

  return {
    ...advanced,
    ...common,
    finishing: j(sho + (attack ? 4 : mid ? -6 : -18)),
    dribbling: j((sho + pas) / 2 + (attack ? 4 : mid ? 2 : -12)),
    passing: j(pas),
    vision: j(pas + (mid ? 5 : -3)),
    crossing: j(pas + (back ? 2 : mid ? 3 : -2)),
    firstTouch: j((pas + sho) / 2 + 2),
    longShots: j(sho - (back ? 12 : 2)),
    setPieces: j((pas + sho) / 2 - 4, 16),
    marking: j(def + (back ? 4 : mid ? -4 : -18)),
    tackling: j(def + (back ? 3 : mid ? -2 : -20)),
    heading: j((phy + def) / 2 + (back || attack ? 5 : -4)),
    interceptions: j(def + (mid ? 2 : 0)),
    reflexes: j(30, 8),
    handling: j(28, 8),
    aerialReach: j(30, 8),
    distribution: j(pas - 10),
    oneOnOnes: extra(28, 8),
    commandOfArea: extra(30, 8),
    rushingOut: extra(pace - 14, 10),
    communication: extra(ovr - 12, 10),
  };
}

/** Mesma identidade física da ficha completa, sem carregar históricos ou o catálogo. */
export function physiqueFor(player: Player): { height: number; weight: number } {
  if (player.developmentBase?.profile)
    return {
      height: player.developmentBase.profile.height,
      weight: player.developmentBase.profile.weight,
    };
  const rnd = makeRng(`profile-${player.id}-${player.name}`);
  buildAttrs(player, rnd);
  // O pé dominante consome uma ou duas amostras antes das medidas na ficha.
  if (rnd() >= 0.72) rnd();
  const tall = player.pos === "GK" ? 8 : player.pos === "DF" ? 4 : 0;
  return {
    height: Math.round(171 + tall + rnd() * 16),
    weight: Math.round(65 + tall * 0.9 + rnd() * 18),
  };
}
