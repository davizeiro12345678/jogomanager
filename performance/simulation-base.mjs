// src/game/formations.ts
var FORMATIONS = {
  "4-3-3": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.72, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.24, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.24, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.72, label: "LD" },
    { pos: "MF", x: -0.3, z: 0, label: "VOL" },
    { pos: "MF", x: -0.05, z: -0.35, label: "MC" },
    { pos: "MF", x: -0.05, z: 0.35, label: "MC" },
    { pos: "FW", x: 0.4, z: -0.78, label: "PE" },
    { pos: "FW", x: 0.55, z: 0, label: "CA" },
    { pos: "FW", x: 0.4, z: 0.78, label: "PD" }
  ],
  "4-4-2": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.74, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.25, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.25, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.74, label: "LD" },
    { pos: "MF", x: -0.15, z: -0.76, label: "ME" },
    { pos: "MF", x: -0.22, z: -0.24, label: "MC" },
    { pos: "MF", x: -0.22, z: 0.24, label: "MC" },
    { pos: "MF", x: -0.15, z: 0.76, label: "MD" },
    { pos: "FW", x: 0.5, z: -0.22, label: "ATA" },
    { pos: "FW", x: 0.5, z: 0.22, label: "ATA" }
  ],
  "3-5-2": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.68, z: -0.45, label: "ZAG" },
    { pos: "DF", x: -0.72, z: 0, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.45, label: "ZAG" },
    { pos: "MF", x: -0.2, z: -0.85, label: "ALA" },
    { pos: "MF", x: -0.3, z: -0.28, label: "VOL" },
    { pos: "MF", x: -0.32, z: 0.28, label: "VOL" },
    { pos: "MF", x: -0.2, z: 0.85, label: "ALA" },
    { pos: "MF", x: 0.15, z: 0, label: "MEI" },
    { pos: "FW", x: 0.52, z: -0.22, label: "ATA" },
    { pos: "FW", x: 0.52, z: 0.22, label: "ATA" }
  ],
  "4-2-3-1": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.74, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.25, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.25, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.74, label: "LD" },
    { pos: "MF", x: -0.38, z: -0.2, label: "VOL" },
    { pos: "MF", x: -0.38, z: 0.2, label: "VOL" },
    { pos: "MF", x: 0.1, z: -0.72, label: "PE" },
    { pos: "MF", x: 0.12, z: 0, label: "MEI" },
    { pos: "MF", x: 0.1, z: 0.72, label: "PD" },
    { pos: "FW", x: 0.55, z: 0, label: "CA" }
  ]
};

// src/game/wasm/match-perception.ts
var finite = (value) => typeof value === "number" && Number.isFinite(value) ? value : 0;
var quantize = (value) => Math.round(value * 1e9) / 1e9;
var evaluatePassLanesFallback = (x, z, receivers, defenders) => {
  x = finite(x);
  z = finite(z);
  const count = Math.min(64, Math.floor(receivers.length / 4));
  const defenderCount = Math.min(64, Math.floor(defenders.length / 4));
  const output = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    const rx = finite(receivers[i * 4]), rz = finite(receivers[i * 4 + 1]);
    const dx = rx - x, dz = rz - z;
    const lengthSquared = dx * dx + dz * dz;
    const distance = Math.sqrt(lengthSquared);
    const flight = distance / Math.min(31, 10 + distance * 0.8);
    let coverSquared = 1e4, risk = 0;
    for (let j = 0; j < defenderCount; j++) {
      const ox = finite(defenders[j * 4]), oz = finite(defenders[j * 4 + 1]);
      const cx = rx - ox, cz = rz - oz;
      coverSquared = Math.min(coverSquared, cx * cx + cz * cz);
      const t = Math.max(0, Math.min(1, ((ox - x) * dx + (oz - z) * dz) / (lengthSquared || 1)));
      const lx = x + dx * t, lz = z + dz * t;
      const ax = ox - lx, az = oz - lz;
      const px = ax + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 2]) * flight * t));
      const pz = az + Math.max(-1.5, Math.min(1.5, finite(defenders[j * 4 + 3]) * flight * t));
      const laneSquared = Math.min(ax * ax + az * az, px * px + pz * pz);
      if (laneSquared < 2.2 * 2.2) risk += (2.2 - Math.sqrt(laneSquared)) * 2.8;
    }
    const offset = i * 3;
    output[offset] = quantize(distance);
    output[offset + 1] = quantize(Math.sqrt(coverSquared));
    output[offset + 2] = quantize(risk);
  }
  return output;
};

// src/game/rng.ts
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed) {
  let s = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  if (s === 0) s = 2654435769;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  next.state = () => s >>> 0;
  next.restore = (state) => {
    if (!Number.isInteger(state) || state < 0 || state > 4294967295) throw new Error("Invalid PRNG state");
    s = state >>> 0;
  };
  return next;
}

// src/game/player-profile-traits.ts
var TRAITS = [
  "Cobra faltas",
  "Corta para dentro",
  "Chega na \xE1rea",
  "Passe em profundidade",
  "Marca por antecipa\xE7\xE3o",
  "Segura a bola",
  "Explode no contra-ataque",
  "Bom no mano a mano",
  "Cabeceador",
  "L\xEDder de vesti\xE1rio",
  "Motor do meio-campo",
  "Finalizador frio"
];
function pickTraits(p, a, rnd) {
  const out = [];
  const push = (t) => {
    if (!out.includes(t) && out.length < 3) out.push(t);
  };
  if (a.setPieces >= 78) push("Cobra faltas");
  if (a.finishing >= 80) push("Finalizador frio");
  if (a.heading >= 80) push("Cabeceador");
  if (a.leadership >= 78) push("L\xEDder de vesti\xE1rio");
  if (a.vision >= 80) push("Passe em profundidade");
  if (a.acceleration >= 84) push("Explode no contra-ataque");
  if (a.marking >= 80) push("Marca por antecipa\xE7\xE3o");
  if (a.workRate >= 82 && p.pos === "MF") push("Motor do meio-campo");
  while (out.length < 2) push(TRAITS[Math.floor(rnd() * TRAITS.length)]);
  return out;
}

// src/game/player-physique.ts
function clamp(v) {
  return Math.max(20, Math.min(99, Math.round(v)));
}
function buildAttrs(p, rnd) {
  const j = (base, spread = 7) => clamp(base + rnd() * spread - spread / 2);
  const { ovr, pos } = p;
  const pace = p.pace;
  const sho = p.shooting;
  const pas = p.passing;
  const def = p.defending;
  const phy = p.physical;
  const advancedRng = makeRng(`advanced-attributes-${p.id}-${p.name}`);
  const extra = (base, spread = 7) => clamp(base + advancedRng() * spread - spread / 2);
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
    flair: extra((pas + sho) / 2 - 3 + (pos === "FW" ? 4 : 0), 12)
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
    decisions: j(ovr - 3)
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
      communication: extra(ovr - 5 + (p.age >= 29 ? 5 : 0))
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
    communication: extra(ovr - 12, 10)
  };
}
function physiqueFor(player) {
  const rnd = makeRng(`profile-${player.id}-${player.name}`);
  const attrs = buildAttrs(player, rnd);
  pickTraits(player, attrs, rnd);
  if (rnd() >= 0.72) rnd();
  const tall = player.pos === "GK" ? 8 : player.pos === "DF" ? 4 : 0;
  return {
    height: Math.round(171 + tall + rnd() * 16),
    weight: Math.round(65 + tall * 0.9 + rnd() * 18)
  };
}

// src/game/match-probability.ts
function bounded(value, fallback, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : fallback));
}
function teamDay(seed, side) {
  const rnd = makeRng(`match-day:${seed}:${side}`);
  return (rnd() + rnd() + rnd() - 1.5) * 4;
}

// src/game/match-readiness.ts
function selectionRating(p) {
  return p.ovr + (bounded(p.form, 60, 0, 100) - 60) * 0.035 - Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.18;
}
function matchAttributes(p, seed, side) {
  const rnd = makeRng(`player-day:${seed}:${side}:${p.id}`);
  const profile = buildAttrs(p, makeRng(`profile-${p.id}-${p.name}`));
  const detailed = { ...profile };
  for (const key of Object.keys(profile)) {
    const value = p.detailedAttributes?.[key];
    if (typeof value === "number" && Number.isFinite(value)) detailed[key] = value;
  }
  const weightedGain = (keys) => keys.reduce((sum, [key, weight]) => sum + (detailed[key] - profile[key]) * weight, 0);
  const clampGain = (gain) => Math.max(-4, Math.min(4, gain));
  const shootingGain = clampGain(
    weightedGain([
      ["finishing", 0.36],
      ["longShots", 0.2],
      ["technique", 0.16],
      ["composure", 0.12],
      ["decisions", 0.1],
      ["setPieces", 0.06]
    ])
  );
  const passingGain = clampGain(
    weightedGain([
      ["passing", 0.28],
      ["vision", 0.2],
      ["firstTouch", 0.13],
      ["teamwork", 0.12],
      ["decisions", 0.12],
      ["crossing", 0.1],
      ["offBall", 0.05]
    ])
  );
  const defendingGain = clampGain(
    p.pos === "GK" ? weightedGain([
      ["reflexes", 0.22],
      ["handling", 0.18],
      ["oneOnOnes", 0.16],
      ["commandOfArea", 0.12],
      ["positioning", 0.12],
      ["concentration", 0.1],
      ["communication", 0.1]
    ]) : weightedGain([
      ["marking", 0.2],
      ["tackling", 0.2],
      ["interceptions", 0.16],
      ["anticipation", 0.16],
      ["concentration", 0.1],
      ["positioning", 0.1],
      ["heading", 0.08]
    ])
  );
  const paceGain = clampGain(
    weightedGain([
      ["acceleration", 0.35],
      ["agility", 0.25],
      ["balance", 0.2],
      ["pace", 0.2]
    ])
  );
  const physicalGain = clampGain(
    weightedGain([
      ["strength", 0.24],
      ["stamina", 0.2],
      ["workRate", 0.16],
      ["naturalFitness", 0.12],
      ["determination", 0.1],
      ["jumping", 0.1],
      ["balance", 0.08]
    ])
  );
  const consistency = p.personality === "temperamental" ? 1.4 : p.personality === "profissional" ? 0.7 : 1;
  const regularity = Math.max(0.8, Math.min(1.2, 1 - (detailed.consistency - 65) * 5e-3));
  const variation = teamDay(seed, side) + (rnd() + rnd() - 1) * 3 * consistency * regularity;
  const readiness = (bounded(p.form, 60, 0, 100) - 60) * 0.045 + (bounded(p.morale, 70, 0, 100) - 70) * 0.02 - Math.max(0, 85 - bounded(p.condition, 100, 0, 100)) * 0.12;
  const technical = (v) => bounded(v + variation + readiness, 60, 35, 99);
  return {
    pace: bounded(p.pace + paceGain + (variation + readiness) * 0.25, 60, 35, 99),
    shooting: technical(
      p.shooting + shootingGain + Math.max(-1.5, Math.min(1.5, (detailed.technique - p.shooting) * 0.12))
    ),
    passing: technical(
      p.passing + passingGain + Math.max(-1.5, Math.min(1.5, (detailed.teamwork - p.passing) * 0.12))
    ),
    defending: technical(
      p.defending + defendingGain + Math.max(-1.5, Math.min(1.5, (detailed.anticipation - p.defending) * 0.12))
    ),
    physical: technical(p.physical + physicalGain),
    stamina: bounded(p.condition + clampGain(detailed.stamina - profile.stamina) * 0.45, 100, 12, 100)
  };
}

// src/game/overall.ts
var clamp2 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var POSITION_WEIGHTS = {
  GK: { pace: 0.05, shooting: 0, passing: 0.15, defending: 0.6, physical: 0.2 },
  DF: { pace: 0.15, shooting: 0.03, passing: 0.15, defending: 0.45, physical: 0.22 },
  MF: { pace: 0.15, shooting: 0.17, passing: 0.38, defending: 0.15, physical: 0.15 },
  FW: { pace: 0.25, shooting: 0.42, passing: 0.13, defending: 0.02, physical: 0.18 }
};
function positionalOverall(pos, a) {
  const w = POSITION_WEIGHTS[pos];
  const v = a.pace * w.pace + a.shooting * w.shooting + a.passing * w.passing + a.defending * w.defending + a.physical * w.physical;
  return Math.round(clamp2(v, 30, 99));
}

// src/game/sim-rules.ts
var FIELD_X = 52.5;
var FIELD_Z = 34;
var GOAL_Z = 3.66;
var PENALTY_DIST = 11;
var BOX_DEPTH = 16.5;
var BOX_HALF = 20.16;
function xgForShot(c) {
  const base = 0.46 * Math.exp(-c.dist / 12.5);
  const angle = 1 - Math.min(0.55, c.wide / (FIELD_Z * 0.9) * 0.7);
  const press = c.pressDist < 1.5 ? 0.5 : c.pressDist < 3 ? 0.75 : c.pressDist < 5 ? 0.9 : 1;
  const body = c.bodyPart === "head" ? c.dist < 12 ? 0.62 : 0.34 : 1;
  const run = c.onRun ? 1.22 : 1;
  return Math.max(0.01, Math.min(0.9, base * angle * press * body * run));
}
function shotProbabilities(o) {
  const clamp5 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const shooting = clamp5(o.shooting, 35, 99), keeper = clamp5(o.goalkeeper, 35, 99);
  const onTarget = clamp5(
    0.28 + shooting * 4e-3 + Math.max(0, 1 - o.distance / 40) * 0.2,
    0.25,
    0.78
  );
  const conversion = clamp5(
    o.xg * clamp5(0.95 + (shooting - 70) * 8e-3, 0.65, 1.18) * clamp5(1 - (keeper - 70) * 6e-3, 0.82, 1.2),
    1e-3,
    onTarget * 0.92
  );
  return { onTarget, goalGivenTarget: conversion / onTarget, conversion };
}
function xgForDirectFK(dist, central) {
  const base = 0.16 * Math.exp(-Math.max(0, dist - 16) / 14);
  return Math.max(0.02, Math.min(0.18, central ? base : base * 0.6));
}
var XG_PENALTY = 0.76;
function defensiveLineX(players, attacking) {
  const foes = players.filter((p) => p.side !== attacking && !p.sentOff).map((p) => p.x).sort((a, b) => attacking === "home" ? a - b : b - a);
  if (foes.length < 2) return attacking === "home" ? -FIELD_X : FIELD_X;
  return foes[1];
}
function isOffside(x, lineX, dir) {
  const past = dir === 1 ? x > lineX + 0.4 : x < lineX - 0.4;
  const attackingHalf = dir === 1 ? x > 0 : x < 0;
  return past && attackingHalf;
}
var REFEREES = [
  { name: "C. Duarte", strict: 0.25 },
  { name: "R. Sampaio", strict: 0.45 },
  { name: "M. Tavares", strict: 0.6 },
  { name: "J. Peixoto", strict: 0.8 }
];
function refFor(rnd) {
  return REFEREES[Math.floor(rnd() * REFEREES.length)];
}
function cardForFoul(f) {
  if (f.goalDenied && (f.slide || f.rnd() < 0.5)) return "red";
  let yellowP = 0.1 + f.ref.strict * 0.22 + (f.slide ? 0.16 : 0) + (f.tactical ? 0.2 : 0);
  yellowP += Math.min(0.2, f.rapSheet * 0.06);
  const redP = f.slide ? 8e-3 + f.ref.strict * 0.014 : 3e-3;
  const roll = f.rnd();
  if (roll < redP) return "red";
  return roll < redP + yellowP ? "yellow" : "none";
}
function solveDirectFK(o) {
  const xg = xgForDirectFK(o.dist, o.central);
  const skill = o.taker / 100;
  const wallBlock = Math.min(0.42, 0.1 + o.wall * 0.07) * (o.dist < 22 ? 1 : 0.55);
  const goalP = xg * (0.7 + skill * 0.6) * (1 - wallBlock);
  const saveP = (0.3 + o.gk / 100 * 0.35) * (1 - wallBlock - goalP);
  const roll = o.rnd();
  const result = roll < goalP ? "goal" : roll < goalP + wallBlock ? "wall" : roll < goalP + wallBlock + saveP ? "saved" : "off";
  const inside = (o.rnd() - 0.5) * GOAL_Z * 1.5;
  const outside = Math.sign(o.rnd() - 0.5 || 1) * (GOAL_Z + 1 + o.rnd() * GOAL_Z * 1.5);
  return {
    result,
    targetZ: result === "off" ? outside : inside,
    targetH: result === "off" && o.rnd() < 0.4 ? 3 + o.rnd() * 1.6 : 0.3 + o.rnd() * 1.7,
    xg
  };
}
function solvePenalty(o) {
  const sides = [-1, 0, 1];
  const takerSide = sides[Math.floor(o.rnd() * 3)];
  const readP = 0.28 + o.gk / 100 * 0.25 - o.taker / 100 * 0.1;
  const gkSide = o.rnd() < readP ? takerSide : sides[Math.floor(o.rnd() * 3)];
  const skyP = 0.04 + o.pressure * 0.05 + Math.max(0, (70 - o.taker) / 100) * 0.1;
  if (o.rnd() < skyP) return { scored: false, takerSide, gkSide, skied: true };
  if (gkSide === takerSide) {
    const saveP = 0.32 + o.gk / 100 * 0.2 - o.taker / 100 * 0.12;
    if (o.rnd() < saveP) return { scored: false, takerSide, gkSide, skied: false };
  }
  return { scored: true, takerSide, gkSide, skied: false };
}
function solveCornerDuel(o) {
  const gkClaim = o.gkComes ? 0.12 + o.gk / 100 * 0.14 : 0.02;
  const attShare = o.attack / Math.max(1, o.attack + o.defense);
  const roll = o.rnd();
  if (roll < gkClaim) return { winner: "gk", headerXg: 0 };
  if (roll < gkClaim + (1 - gkClaim) * attShare * 0.62) {
    return { winner: "attack", headerXg: 0.07 + o.rnd() * 0.09 };
  }
  return { winner: "defense", headerXg: 0 };
}
function shootoutWinner(kicks) {
  const hk = kicks.filter((k) => k.side === "home");
  const ak = kicks.filter((k) => k.side === "away");
  const hs = hk.filter((k) => k.scored).length;
  const as = ak.filter((k) => k.scored).length;
  if (hk.length === ak.length && hk.length >= 5 && hs !== as) return hs > as ? "home" : "away";
  if (hk.length <= 5 && ak.length <= 5) {
    const hr = 5 - hk.length;
    const ar = 5 - ak.length;
    if (hs > as + ar) return "home";
    if (as > hs + hr) return "away";
  }
  return null;
}
function posGroup(pos) {
  const p = pos.toUpperCase();
  if (p === "GK") return "GK";
  if (p.startsWith("D") || p === "CB" || p === "LB" || p === "RB" || p === "WB") return "DF";
  if (p.startsWith("F") || p === "ST" || p === "CF" || p === "WG" || p === "LW" || p === "RW")
    return "FW";
  return "MF";
}
function aiSubPick(lineup, bench, goalDiff, minute, subsUsed, rnd) {
  if (subsUsed >= 5 || minute < 50) return null;
  const avail = bench.filter((b) => b.injuryWeeks === 0 && !b.suspended && b.condition > 40);
  if (!avail.length) return null;
  const field = lineup.filter((p) => !p.sentOff);
  const hurt = field.find((p) => p.injuryWeeks > 0);
  if (hurt) {
    const repo = avail.filter((b) => posGroup(b.pos) === posGroup(hurt.pos)).sort((a, b) => b.ovr - a.ovr)[0];
    if (repo) return { outPid: hurt.pid, inId: repo.id, reason: "les\xE3o" };
  }
  if (minute >= 60) {
    const dead = field.filter((p) => p.pos !== "GK" && p.stamina < 42).sort((a, b) => a.stamina - b.stamina)[0];
    if (dead && rnd() < 0.75) {
      const repo = avail.filter((b) => posGroup(b.pos) === posGroup(dead.pos)).sort((a, b) => b.ovr - a.ovr)[0];
      if (repo) return { outPid: dead.pid, inId: repo.id, reason: "fadiga" };
    }
  }
  if (minute >= 63 && rnd() < 0.6) {
    if (goalDiff < 0) {
      const out = field.filter((p) => posGroup(p.pos) === "DF" || posGroup(p.pos) === "MF" && p.yellows > 0).sort((a, b) => a.ovr - b.ovr)[0];
      const fw = avail.filter((b) => posGroup(b.pos) === "FW").sort((a, b) => b.ovr - a.ovr)[0];
      if (out && fw) return { outPid: out.pid, inId: fw.id, reason: "t\xE1tica" };
    } else if (goalDiff > 0 && minute >= 74) {
      const out = field.filter((p) => posGroup(p.pos) === "FW").sort((a, b) => a.ovr - b.ovr)[0];
      const df = avail.filter((b) => posGroup(b.pos) === "DF" || posGroup(b.pos) === "MF").sort((a, b) => b.ovr - a.ovr)[0];
      if (out && df) return { outPid: out.pid, inId: df.id, reason: "t\xE1tica" };
    }
  }
  return null;
}
function aiMentalityTweak(goalDiff, minute, sentOffs) {
  if (minute < 55) return null;
  if (sentOffs > 0) return { mentality: -1, pressing: -1 };
  if (goalDiff < 0 && minute >= 60) return { mentality: 1, pressing: 1 };
  if (goalDiff > 0 && minute >= 70) return { mentality: -1, pressing: 0 };
  if (goalDiff === 0 && minute >= 80) return { mentality: 1, pressing: 0 };
  return null;
}
function duelMult(o) {
  return (o.home ? 1.03 : 1) * (0.94 + Math.max(0, Math.min(100, o.morale)) / 1e3);
}
function controlFailAdd(weather) {
  return weather === "rain" ? 0.09 : 0;
}
function passErrMult(weather) {
  return weather === "rain" ? 1.3 : 1;
}
function staminaDrainMult(weather) {
  if (weather === "heat") return 1.22;
  if (weather === "rain") return 1.08;
  return 1;
}
function foulMult(weather) {
  return weather === "rain" ? 1.2 : 1;
}
function clockText(phase, time, added1, added2, etAdded) {
  const t = Math.floor(time / 60);
  if (phase === "shootout" || phase === "done") {
    if (phase === "shootout") return "PEN";
    const base = etAdded > 0 || t > 95 ? 120 : 90;
    return `${base}'`;
  }
  if (phase === "first" || phase === "half") {
    if (t <= 45) return `${t}'`;
    return `45+${Math.min(t - 45, added1)}'`;
  }
  if (phase === "second") {
    if (t <= 90) return `${t}'`;
    return `90+${Math.min(t - 90, added2)}'`;
  }
  if (phase === "et1") return t <= 105 ? `${t}'` : `105+${Math.min(t - 105, etAdded)}'`;
  return t <= 120 ? `${t}'` : `120+${Math.min(t - 120, etAdded)}'`;
}
var GOAL_BAR_H = 2.44;
function woodworkAt(crossingZ, crossingH) {
  const az = Math.abs(crossingZ);
  const nearPost = az >= GOAL_Z - 0.38 && az <= GOAL_Z + 0.55 && crossingH < GOAL_BAR_H + 0.45;
  const nearBar = Math.abs(crossingH - GOAL_BAR_H) <= 0.35 && az <= GOAL_Z + 0.55 && crossingH > 0.4;
  if (nearPost && nearBar) {
    const dPost = Math.abs(az - GOAL_Z);
    const dBar = Math.abs(crossingH - GOAL_BAR_H);
    return dPost <= dBar ? "post" : "bar";
  }
  if (nearPost) return "post";
  if (nearBar) return "bar";
  return null;
}

// src/game/ball-climate.ts
function windFor(seed) {
  const rng = makeRng(`${seed}|wind`);
  const angle = rng() * Math.PI * 2;
  const roll = rng();
  const speed = roll < 0.65 ? rng() * 0.5 : roll < 0.9 ? 0.5 + rng() * 0.7 : 1.2 + rng() * 1;
  return {
    x: Math.cos(angle) * speed,
    z: Math.sin(angle) * speed,
    strength01: Math.min(1, speed / 2.2)
  };
}
function pitchCondition(weather) {
  switch (weather) {
    case "rain":
      return {
        airDrag: 0.32,
        rollDrag: 0.9,
        bounce: 0.38,
        skid: 0.92,
        rapierFriction: 0.55,
        rapierRestitution: 0.34,
        rapierBallRestitution: 0.42
      };
    case "heat":
      return {
        airDrag: 0.26,
        rollDrag: 1.9,
        bounce: 0.58,
        skid: 0.74,
        rapierFriction: 0.95,
        rapierRestitution: 0.55,
        rapierBallRestitution: 0.58
      };
    case "clear":
    default:
      return {
        airDrag: 0.28,
        rollDrag: 1.5,
        bounce: 0.52,
        skid: 0.82,
        rapierFriction: 0.84,
        rapierRestitution: 0.48,
        rapierBallRestitution: 0.54
      };
  }
}

// src/game/physics-quality.ts
var HIGH_FIDELITY_PHYSICS_HZ = 139;
var HIGH_FIDELITY_PHYSICS_STEP = 1 / HIGH_FIDELITY_PHYSICS_HZ;
function highFidelitySubsteps(elapsed, maxSubsteps = Infinity) {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 1;
  const requested = Math.max(1, Math.ceil(elapsed * HIGH_FIDELITY_PHYSICS_HZ));
  const limit = Number.isFinite(maxSubsteps) ? Math.max(1, Math.floor(maxSubsteps)) : requested;
  return Math.min(requested, limit);
}

// src/game/athlete-dynamics.ts
var clamp3 = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
var mass = (p) => Number.isFinite(p.weightKg) ? clamp3(p.weightKg, 45, 130) : 78;
var MAX_LIVE_ATHLETE_SUBSTEPS = 11;
var liveRemainder = /* @__PURE__ */ new WeakMap();
var athleteRemainder = (body) => liveRemainder.get(body) ?? 0;
function restoreAthleteRemainder(body, remainder) {
  if (!Number.isFinite(remainder) || remainder < 0 || remainder >= HIGH_FIDELITY_PHYSICS_STEP)
    throw new Error("Invalid athlete integration remainder");
  liveRemainder.set(body, remainder);
}
function advanceAthlete(p, tx, tz, maxSpeed, dt, traction) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const grip = clamp3(traction, 0.4, 1.1);
  const force = (4 + clamp3(p.pace, 0, 100) * 0.018 + clamp3(p.physical, 0, 100) * 0.012) * (0.72 + clamp3(p.stamina, 0, 100) * 28e-4) * 78 / mass(p);
  const acceleration = clamp3(force, 3.2, 7.5) * grip;
  const braking = (7.2 + clamp3(p.physical, 0, 100) * 0.02) * grip;
  const carried = liveRemainder.get(p) ?? 0;
  const accumulated = dt + carried;
  const fixedSteps = Math.floor(accumulated / HIGH_FIDELITY_PHYSICS_STEP);
  const useFixedSlices = fixedSteps <= MAX_LIVE_ATHLETE_SUBSTEPS;
  const steps = useFixedSlices ? fixedSteps : highFidelitySubsteps(dt, MAX_LIVE_ATHLETE_SUBSTEPS);
  if (useFixedSlices)
    liveRemainder.set(p, Math.max(0, accumulated - steps * HIGH_FIDELITY_PHYSICS_STEP));
  else liveRemainder.delete(p);
  for (let i = 0; i < steps; i++) {
    const h = useFixedSlices ? HIGH_FIDELITY_PHYSICS_STEP : dt / steps;
    const response = 1 - Math.exp(-6 * h);
    const dx = tx - p.x, dz = tz - p.z, distance = Math.hypot(dx, dz);
    const desiredSpeed = Math.min(
      Math.max(0, maxSpeed),
      Math.sqrt(2 * braking * Math.max(0, distance - 0.08))
    );
    const ux = distance > 1e-5 ? dx / distance * desiredSpeed : 0;
    const uz = distance > 1e-5 ? dz / distance * desiredSpeed : 0;
    const dvx = ux - p.vx, dvz = uz - p.vz, change = Math.hypot(dvx, dvz);
    const slowing = dvx * p.vx + dvz * p.vz < 0;
    const limit = (slowing ? braking : acceleration) * h;
    const factor = change > 0 ? Math.min(response, limit / change) : 0;
    const oldX = p.vx, oldZ = p.vz;
    p.vx += dvx * factor;
    p.vz += dvz * factor;
    p.x += (oldX + p.vx) * 0.5 * h;
    p.z += (oldZ + p.vz) * 0.5 * h;
  }
}
function athleteContact(a, b, nx, nz) {
  const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closing >= 0) return;
  const inverseA = 1 / mass(a), inverseB = 1 / mass(b), inverse = inverseA + inverseB;
  const impulse = -closing * 1.06 / inverse;
  const tangent = (b.vx - a.vx) * -nz + (b.vz - a.vz) * nx;
  const friction = clamp3(-tangent / inverse, -impulse * 0.18, impulse * 0.18);
  const ix = nx * impulse - nz * friction, iz = nz * impulse + nx * friction;
  a.vx -= ix * inverseA;
  a.vz -= iz * inverseA;
  b.vx += ix * inverseB;
  b.vz += iz * inverseB;
}

// src/game/visual-context.ts
var VISUAL_CONTEXT_VERSION = 2;
function emptyActionContext() {
  return {
    action: null,
    actionT: 0,
    actionDur: 0,
    phase: "anticipation",
    dominantFoot: "right",
    usedFoot: "right",
    target: null,
    contactPoint: null,
    direction: 0,
    intensity: 0,
    result: "none",
    reaction: "none"
  };
}
function emptyContactContext() {
  return {
    type: "none",
    groundFoot: null,
    force: 0,
    bodyPoint: null,
    contactPlayerId: null,
    relativeVelocity: null
  };
}
function getDominantFoot(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = hash * 31 + seed.charCodeAt(i) | 0;
  }
  return hash % 2 === 0 ? "right" : "left";
}
function getActionPhase(u) {
  if (u < 0.15) return "anticipation";
  if (u < 0.45) return "action";
  if (u < 0.65) return "contact";
  if (u < 0.85) return "followThrough";
  return "recovery";
}

// src/game/sim.ts
var MATCH_SIMULATION_STEP = 1 / 30;
function emptyStats() {
  return {
    goals: 0,
    shots: 0,
    onTarget: 0,
    possessionTicks: 0,
    fouls: 0,
    passes: 0,
    passesOk: 0,
    corners: 0,
    yellow: 0,
    red: 0,
    xg: 0,
    offsides: 0,
    interceptions: 0,
    saves: 0,
    pens: 0
  };
}
var CHECKPOINT_EXTERNAL = /* @__PURE__ */ new Set(["rnd", "passLaneKernel", "ballPhysics"]);
var MatchSim = class {
  constructor(home, away, seed, opts) {
    this.home = home;
    this.away = away;
    this.rnd = makeRng(seed);
    this.matchSeed = seed;
    this.knockout = opts?.knockout ?? false;
    this.weather = opts?.weather ?? "clear";
    this.wind = windFor(seed);
    this.added1 = 1 + Math.floor(this.rnd() * 3);
    this.added2 = 2 + Math.floor(this.rnd() * 4);
    this.addedET = Math.floor(this.rnd() * 2);
    this.ref = refFor(this.rnd);
    this.reset();
    this.events.push({
      minute: 0,
      type: "kickoff",
      side: "neutral",
      text: `Bola rolando no duelo entre ${home.name} e ${away.name}. Apita ${this.ref.name}.`
    });
  }
  home;
  away;
  passLaneKernel = evaluatePassLanesFallback;
  setPassLaneKernel(kernel) {
    this.passLaneKernel = kernel;
  }
  /** Internal recovery snapshot, never a career save or authority attestation. */
  checkpoint() {
    const state = {};
    for (const [key, value] of Object.entries(this))
      if (!CHECKPOINT_EXTERNAL.has(key)) state[key] = value;
    if (this.ballPhysics && !this.ballPhysics.checkpoint)
      throw new Error("Physics backend cannot checkpoint");
    return {
      version: 1,
      seed: this.matchSeed,
      rng: this.rnd.state(),
      state: structuredClone(state),
      physics: this.ballPhysics?.checkpoint?.() ?? null,
      athleteRemainders: this.players.map(athleteRemainder),
      perception: this.passLaneKernel === evaluatePassLanesFallback ? "compat" : "wasm"
    };
  }
  restoreCheckpoint(checkpoint, authority) {
    if (checkpoint.version !== 1 || checkpoint.seed !== this.matchSeed || typeof checkpoint.state["time"] !== "number" || !Number.isFinite(checkpoint.state["time"]) || !Array.isArray(checkpoint.state["players"])) throw new Error("Invalid match checkpoint");
    const keys = Object.keys(this).filter((key) => !CHECKPOINT_EXTERNAL.has(key));
    if (keys.length !== Object.keys(checkpoint.state).length || keys.some((key) => !Object.hasOwn(checkpoint.state, key))) throw new Error("Checkpoint schema mismatch");
    if (checkpoint.physics && !authority?.restore) throw new Error("Physics checkpoint requires matching backend");
    const state = structuredClone(checkpoint.state);
    this.rnd.restore(checkpoint.rng);
    this.ballPhysics?.dispose();
    Object.assign(this, state);
    if (checkpoint.athleteRemainders.length !== this.players.length) throw new Error("Invalid athlete checkpoint");
    this.players.forEach((player, index) => restoreAthleteRemainder(player, checkpoint.athleteRemainders[index]));
    this.ballPhysics = authority ?? null;
    if (checkpoint.physics) authority.restore(checkpoint.physics);
  }
  time = 0;
  // segundos de jogo
  players = [];
  ball = { x: 0, z: 0, vx: 0, vz: 0, holder: null, height: 0 };
  possession = "home";
  stats = {
    home: emptyStats(),
    away: emptyStats()
  };
  events = [];
  scorers = [];
  /** finalizações registradas para o mapa de chutes */
  shotMap = [];
  /** jogadores que saíram por substituição (mantêm estatísticas) */
  subsOut = [];
  subsUsed = { home: 0, away: 0 };
  /** último passador de cada lado, para creditar assistência */
  lastPass = { home: null, away: null };
  /** jogadores em "freeze" curto após um chute próximo */
  reactionUntil = /* @__PURE__ */ new Map();
  mentalityCache = null;
  /** Reused every tick to avoid allocating/sorting temporary chase arrays. */
  chaseIds = /* @__PURE__ */ new Set();
  finished = false;
  lastEventId = 0;
  decisionTimer = 0;
  rnd;
  restartTimer = 0;
  /** tempo com a bola solta, usado para destravar a jogada */
  looseTime = 0;
  /** Pressão coletiva curta disparada por erro técnico ou passe para trás. */
  pressSurge = { home: 0, away: 0 };
  /** último lado que tocou na bola — define lateral, escanteio e tiro de meta */
  lastTouch = "home";
  /** velocidade vertical da bola (m/s) — a altura passa a ser física de verdade */
  ballVy = 0;
  /** curva lateral (efeito Magnus) aplicada enquanto a bola voa */
  ballSpin = 0;
  /**
   * Autoridade física opcional da bola, injetada apenas pela partida ao vivo.
   * A simulação ainda decide posse, regras e eventos; o Rapier integra a
   * trajetória entre essas decisões.
   */
  ballPhysics = null;
  /** finalização em voo: só vira gol/defesa quando a bola chega lá */
  pendingShot = null;
  /** passe em voo: quem deve receber e até quando o passador não retoma a bola */
  pass = null;
  /* ---------------- estrutura da partida (Ciclo 2) ---------------- */
  /** fase atual: tempos, intervalo, prorrogação, disputa ou fim */
  phase = "first";
  /** mata-mata: empate leva à prorrogação e à disputa de pênaltis */
  knockout;
  /** clima sorteado ou injetado: afeta controle, passes, faltas e desgaste */
  weather;
  /** vento da partida (fluxo próprio de semente: não desloca outras rolagens) */
  wind;
  /** árbitro da partida (perfil de rigor) */
  ref;
  /** semente original (fluxos dedicados: vento, reclamações) */
  matchSeed;
  /** qual integrador moveu a bola no último tick (trave só reflete no compat) */
  lastAuthoritative = false;
  /** papo de intervalo do usuário: um por lado e por partida */
  talkUsed = { home: false, away: false };
  /** empurrão da torcida: uma vez por partida */
  crowdPushDone = false;
  /** acréscimos sorteados do 1º, 2º tempo e 2º tempo da prorrogação */
  added1 = 0;
  added2 = 0;
  addedET = 0;
  /** dívida de acréscimo acumulada por gols, subs, lesões e expulsões */
  stoppageDebt = 0;
  /** relógio congelado durante intervalo e pausa da prorrogação */
  freezeT = 0;
  /** até quando (this.time) não há impedimento (isenção pós-bola parada) */
  exemptUntil = 0;
  /** bola parada armada: cobra após a barreira se posicionar */
  setPiece = null;
  /** disputa de pênaltis: cobranças na ordem */
  shootout = [];
  shootoutTimer = 0;
  shootoutTurn = "home";
  /** última checagem da IA (subs + ajustes táticos), em segundos de jogo */
  aiLastCheck = 0;
  /** minuto do último ajuste de postura de cada lado */
  aiTweakMin = { home: 0, away: 0 };
  /** tolerância extra para não apitar no meio de um ataque */
  graceUntil = 0;
  /** Entrega uma cópia serializável da bola para apresentação ou física ao vivo. */
  physicsBallState() {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      attached: this.ball.holder !== null,
      holder: this.ball.holder
    };
  }
  /** Liga ou desliga a autoridade física sem acoplar MatchSim ao WASM. */
  setBallPhysicsAuthority(authority) {
    if (this.ballPhysics === authority) return;
    this.ballPhysics?.dispose();
    this.ballPhysics = authority;
    authority?.setCondition?.(this.weather, this.wind);
    this.synchronizeBallPhysics();
  }
  /** Permite ao Worker detectar uma falha WASM e cair para a rota compatível. */
  hasBallPhysicsAuthority() {
    return this.ballPhysics !== null;
  }
  /** Rebaseia Rapier depois de um reinício, chute, troca ou salto de partida. */
  synchronizeBallPhysics() {
    const physics = this.ballPhysics;
    if (!physics) return;
    try {
      const state = this.mutableBallPhysicsState();
      physics.reset(state, this.ballPhysicsHolder());
      this.applyMutableBallPhysicsState(state);
    } catch {
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
    }
  }
  dispose() {
    this.ballPhysics?.dispose();
    this.ballPhysics = null;
  }
  mutableBallPhysicsState() {
    return {
      x: this.ball.x,
      z: this.ball.z,
      height: this.ball.height,
      vx: this.ball.vx,
      vy: this.ballVy,
      vz: this.ball.vz,
      spin: this.ballSpin,
      holder: this.ball.holder
    };
  }
  ballPhysicsHolder() {
    const holderId = this.ball.holder;
    if (!holderId) return null;
    const holder = this.players.find((player) => player.id === holderId);
    if (!holder) return null;
    return {
      id: holder.id,
      x: holder.x,
      z: holder.z,
      vx: holder.vx,
      vz: holder.vz
    };
  }
  applyMutableBallPhysicsState(state) {
    this.ball.x = state.x;
    this.ball.z = state.z;
    this.ball.height = state.height;
    this.ball.vx = state.vx;
    this.ball.vz = state.vz;
    this.ballVy = state.vy;
    this.ballSpin = state.spin;
  }
  stepAuthoritativeBall(dt, holder) {
    const physics = this.ballPhysics;
    if (!physics) return false;
    try {
      const state = this.mutableBallPhysicsState();
      const holderState = holder ? { id: holder.id, x: holder.x, z: holder.z, vx: holder.vx, vz: holder.vz } : null;
      physics.step(dt, state, holderState);
      this.applyMutableBallPhysicsState(state);
      return true;
    } catch {
      physics.dispose();
      if (this.ballPhysics === physics) this.ballPhysics = null;
      return false;
    }
  }
  buildTeam(setup, side) {
    const slots = FORMATIONS[setup.tactics.formation];
    const dir = side === "home" ? 1 : -1;
    return setup.players.slice(0, 11).map((p, i) => {
      const slot = slots[Math.min(i, slots.length - 1)];
      const physique = physiqueFor(p);
      const x = slot.x * FIELD_X * 0.92 * dir;
      const z = slot.z * FIELD_Z * 0.8 * dir;
      return {
        id: `${side}-${p.id}`,
        side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        heightCm: physique.height,
        weightKg: physique.weight,
        x,
        z,
        vx: 0,
        vz: 0,
        slotX: slot.x * dir,
        slotZ: slot.z * dir,
        ...matchAttributes(p, this.matchSeed, side),
        action: null,
        actionT: 0,
        actionDur: 0,
        pid: p.id,
        goals: 0,
        assists: 0,
        shots: 0,
        passes: 0,
        tackles: 0,
        saves: 0,
        onSince: 0,
        minutes: 0,
        yellows: 0,
        sentOff: false,
        injuryWeeks: 0,
        interceptions: 0,
        offsides: 0,
        foulsWon: 0,
        pensScored: 0,
        pensMissed: 0,
        xg: 0
      };
    });
  }
  /**
   * Troca um titular por um reserva mantendo a posição na formação.
   * Devolve falso quando o jogador que sai não está em campo.
   */
  substitute(side, outPid, incoming, reason) {
    const idx = this.players.findIndex((p) => p.side === side && p.pid === outPid);
    if (idx < 0) return false;
    const out = this.players[idx];
    const physique = physiqueFor(incoming);
    out.minutes += this.minute() - out.onSince;
    this.subsOut.push(out);
    const fresh = {
      ...out,
      id: `${side}-${incoming.id}`,
      pid: incoming.id,
      name: incoming.name,
      number: incoming.number,
      pos: incoming.pos,
      heightCm: physique.height,
      weightKg: physique.weight,
      ...matchAttributes(incoming, this.matchSeed, side),
      action: null,
      actionT: 0,
      actionDur: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      onSince: this.minute(),
      minutes: 0,
      yellows: 0,
      sentOff: false,
      injuryWeeks: 0,
      interceptions: 0,
      offsides: 0,
      foulsWon: 0,
      pensScored: 0,
      pensMissed: 0,
      xg: 0
    };
    if (this.ball.holder === out.id) this.ball.holder = fresh.id;
    this.players[idx] = fresh;
    this.synchronizeBallPhysics();
    this.subsUsed[side]++;
    this.stoppageDebt += 0.5;
    const why = reason === "les\xE3o" ? " (les\xE3o)" : reason === "fadiga" ? " (cansado)" : "";
    this.pushEvent({
      minute: this.minute(),
      type: "sub",
      side,
      text: `Substitui\xE7\xE3o no ${this.setup(side).short}: entra ${incoming.name}, sai ${out.name}${why}.`
    });
    return true;
  }
  /** Notas de 0 a 10 de todos os jogadores que atuaram na partida. */
  playerRatings() {
    const all = [...this.players, ...this.subsOut];
    return all.map((p) => {
      const mins = Math.max(
        1,
        p.minutes + (this.subsOut.includes(p) ? 0 : this.minute() - p.onSince)
      );
      const scored = this.stats[p.side].goals;
      const conceded = this.stats[p.side === "home" ? "away" : "home"].goals;
      let r = 6.1;
      r += p.goals * 1.3 + p.assists * 0.8;
      r += Math.min(0.5, p.passes / 40) + Math.min(0.6, p.tackles * 0.15);
      r += Math.min(0.8, p.interceptions * 0.2) + Math.min(0.6, p.xg * 0.9);
      if (p.shots > 0) r += p.goals / p.shots * 0.4;
      if (p.pos === "GK") r += Math.min(1.3, p.saves * 0.3) - conceded * 0.4;
      else if (p.pos === "DF") r += conceded === 0 && mins >= 60 ? 0.5 : -conceded * 0.12;
      r += p.pensScored * 0.5 - p.pensMissed * 0.5;
      r -= p.yellows * 0.35 + (p.sentOff ? 1.2 : 0) + p.offsides * 0.08;
      r += (scored - conceded) * 0.1;
      r *= 0.8 + Math.min(1, mins / 70) * 0.2;
      return {
        pid: p.pid,
        side: p.side,
        name: p.name,
        number: p.number,
        pos: p.pos,
        goals: p.goals,
        assists: p.assists,
        passes: p.passes,
        tackles: p.tackles,
        saves: p.saves,
        minutes: mins,
        yellows: p.yellows,
        red: p.sentOff,
        injuryWeeks: p.injuryWeeks,
        interceptions: p.interceptions,
        xg: Math.round(p.xg * 100) / 100,
        rating: Math.max(3, Math.min(10, Math.round(r * 10) / 10))
      };
    });
  }
  /** Melhor jogador da partida. */
  manOfTheMatch() {
    const rs = this.playerRatings();
    if (!rs.length) return null;
    return rs.reduce((a, b) => b.rating > a.rating ? b : a);
  }
  reset() {
    this.players = [...this.buildTeam(this.home, "home"), ...this.buildTeam(this.away, "away")];
    this.kickoff("home");
  }
  kickoff(side) {
    this.ball.x = 0;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    const team = this.players.filter((p) => p.side === side);
    const starter = team.find((p) => p.pos === "FW") ?? team[team.length - 1];
    starter.x = -0.6 * (side === "home" ? 1 : -1);
    starter.z = 0;
    this.ball.holder = starter.id;
    this.possession = side;
    this.lastTouch = side;
    this.restartTimer = 1.2;
    this.synchronizeBallPhysics();
  }
  setup(side) {
    return side === "home" ? this.home : this.away;
  }
  attackDir(side) {
    return side === "home" ? 1 : -1;
  }
  mentalityShift(side) {
    if (this.mentalityCache) return this.mentalityCache[side];
    const h = (this.home.tactics.mentality - 2) * 6 * 1;
    const a = (this.away.tactics.mentality - 2) * 6 * -1;
    this.mentalityCache = { home: h, away: a };
    return this.mentalityCache[side];
  }
  pushEvent(e) {
    this.events.push(e);
    this.lastEventId++;
    if (this.events.length > 80) this.events.shift();
  }
  recordShot(shot) {
    this.shotMap.push(shot);
    if (this.shotMap.length > 120) this.shotMap.shift();
  }
  /** dispara uma animação curta no jogador */
  trigger(p, action, dur = 0.7) {
    if (!p) return;
    p.action = action;
    p.actionT = dur;
    p.actionDur = dur;
  }
  tickActions(dt) {
    for (const p of this.players) {
      if (p.actionT > 0) {
        p.actionT -= dt;
        if (p.actionT <= 0) {
          p.actionT = 0;
          p.action = null;
        }
      }
    }
    if (this.reactionUntil.size) {
      for (const [id, until] of this.reactionUntil) {
        if (until <= this.time) this.reactionUntil.delete(id);
      }
    }
  }
  minute() {
    return Math.min(120, Math.floor(this.time / 60));
  }
  /** texto do relógio: 45+2', 90+3', 105', 120', PEN */
  clock() {
    return clockText(this.phase, this.time, this.added1, this.added2, this.addedET);
  }
  /** fim do período atual em segundos de jogo, com acréscimos e dívida */
  phaseEndAt() {
    const debt = Math.min(3, Math.floor(this.stoppageDebt));
    if (this.phase === "first") return (45 + this.added1 + debt) * 60;
    if (this.phase === "second") return (90 + this.added1 + this.added2 + debt) * 60;
    if (this.phase === "et1") return (105 + this.added1 + this.added2) * 60;
    return (120 + this.added1 + this.added2 + this.addedET) * 60;
  }
  /** não apita no meio de um ataque: espera a bola esfriar (com limite) */
  readyToWhistle() {
    if (this.setPiece) return false;
    if (this.pendingShot) return this.time > this.graceUntil;
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      const goalX = this.attackDir(holder.side) * FIELD_X;
      if (Math.hypot(goalX - holder.x, holder.z) < 18) return this.time > this.graceUntil;
    } else if (Math.hypot(this.ball.vx, this.ball.vz) > 12) {
      return this.time > this.graceUntil;
    }
    return true;
  }
  /** avança a máquina de fases; devolve true quando o jogo terminou */
  advancePhase() {
    if (this.phase === "first") {
      this.phase = "half";
      this.freezeT = 6;
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.pushEvent({ minute: 45, type: "halftime", side: "neutral", text: "Intervalo." });
      this.halfTalk("home");
      this.halfTalk("away");
      return false;
    }
    if (this.phase === "half") {
      this.phase = "second";
      this.kickoff("away");
      this.pushEvent({
        minute: 45,
        type: "kickoff",
        side: "neutral",
        text: "Come\xE7a o segundo tempo."
      });
      return false;
    }
    if (this.phase === "second") {
      const draw2 = this.stats.home.goals === this.stats.away.goals;
      if (this.knockout && draw2) {
        this.phase = "et1";
        this.kickoff("home");
        this.pushEvent({
          minute: 90,
          type: "kickoff",
          side: "neutral",
          text: "Empate no mata-mata: come\xE7a a prorroga\xE7\xE3o."
        });
        return false;
      }
      this.finishMatch();
      return true;
    }
    if (this.phase === "et1") {
      this.phase = "etBreak";
      this.freezeT = 3;
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.pushEvent({
        minute: 105,
        type: "halftime",
        side: "neutral",
        text: "Fim do 1\xBA tempo da prorroga\xE7\xE3o."
      });
      return false;
    }
    if (this.phase === "etBreak") {
      this.phase = "et2";
      this.kickoff("away");
      this.pushEvent({
        minute: 105,
        type: "kickoff",
        side: "neutral",
        text: "Come\xE7a o 2\xBA tempo da prorroga\xE7\xE3o."
      });
      return false;
    }
    const draw = this.stats.home.goals === this.stats.away.goals;
    if (this.knockout && draw) {
      this.phase = "shootout";
      this.ball.holder = null;
      this.pendingShot = null;
      this.pass = null;
      this.shootoutTimer = 1.5;
      this.shootoutTurn = "home";
      this.pushEvent({
        minute: 120,
        type: "shootout",
        side: "neutral",
        text: "Tudo igual: a vaga ser\xE1 decidida nos p\xEAnaltis."
      });
      this.setupShootoutKick();
      return false;
    }
    this.finishMatch();
    return true;
  }
  /** papo de vestiário: mexe um pouco na moral de cada lado */
  halfTalk(side) {
    const setup = this.setup(side);
    const losing = this.stats[side].goals < this.stats[side === "home" ? "away" : "home"].goals;
    const delta = losing ? 2 + Math.floor(this.rnd() * 4) : -1 + Math.floor(this.rnd() * 4);
    setup.morale = Math.max(20, Math.min(100, (setup.morale ?? 70) + delta));
  }
  /**
   * Papo de intervalo do usuário (bônus além da conversa padrão): motivar sobe
   * a moral, cobrar troca moral por entrega, poupar guarda pernas. Uma vez por
   * lado e por partida. Chamado pelo Worker (talkLive) ou direto no fallback.
   */
  applyTeamTalk(side, kind) {
    if (this.talkUsed[side] || this.finished) return false;
    this.talkUsed[side] = true;
    const setup = this.setup(side);
    const effects = {
      motivar: {
        morale: 6,
        stamina: 2,
        text: `Voc\xEA inflama o vesti\xE1rio: "\xC9 AGORA!" O ${setup.short} volta ligado!`
      },
      cobrar: {
        morale: -2,
        stamina: 6,
        text: `Voc\xEA cobra entrega: ningu\xE9m quer sair vaiado. O ${setup.short} volta mordendo!`
      },
      poupar: {
        morale: 1,
        stamina: 8,
        text: `Voc\xEA pede cabe\xE7a fria e pernas frescas. O ${setup.short} volta respirando.`
      }
    };
    const fx = effects[kind];
    setup.morale = Math.max(20, Math.min(100, (setup.morale ?? 70) + fx.morale));
    for (const p of this.players) {
      if (p.side !== side || p.sentOff) continue;
      p.stamina = Math.max(12, Math.min(100, p.stamina + fx.stamina));
    }
    this.pushEvent({ minute: this.minute(), type: "talk", side, text: fx.text });
    return true;
  }
  finishMatch() {
    this.phase = "done";
    this.finished = true;
    const winner = shootoutWinner(this.shootout);
    const suffix = winner ? ` Nos p\xEAnaltis, ${this.setup(winner).short} leva a vaga.` : "";
    this.pushEvent({
      minute: this.minute(),
      type: "fulltime",
      side: "neutral",
      text: `Fim de jogo: ${this.home.short} ${this.stats.home.goals} x ${this.stats.away.goals} ${this.away.short}.${suffix}`
    });
  }
  /* ---------------- disputa de pênaltis ---------------- */
  /** próximo batedor: quem ainda não cobrou, do melhor para o pior */
  shootoutTaker(side) {
    const field = this.players.filter((p) => p.side === side && !p.sentOff && p.pos !== "GK");
    if (!field.length) return null;
    const taken = /* @__PURE__ */ new Map();
    for (const k of this.shootout) taken.set(k.name, (taken.get(k.name) ?? 0) + 1);
    const fresh = field.filter((p) => !taken.has(p.name)).sort((a, b) => b.shooting - a.shooting);
    if (fresh.length) return fresh[0];
    return [...field].sort(
      (a, b) => taken.get(a.name) - taken.get(b.name) || b.shooting - a.shooting
    )[0] ?? null;
  }
  /** posiciona batedor, goleiro e bola; a disputa é sempre no mesmo gol */
  setupShootoutKick() {
    const side = this.shootoutTurn;
    const taker = this.shootoutTaker(side);
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK") ?? null;
    if (taker) {
      taker.x = FIELD_X - PENALTY_DIST;
      taker.z = 0.6;
      taker.vx = 0;
      taker.vz = 0;
    }
    if (gk) {
      gk.x = FIELD_X - 0.8;
      gk.z = 0;
      gk.vx = 0;
      gk.vz = 0;
      gk.sentOff = false;
    }
    this.ball.x = FIELD_X - PENALTY_DIST;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.shootoutTimer = 1.8;
    this.synchronizeBallPhysics();
  }
  tickShootout(dt) {
    this.shootoutTimer -= dt;
    if (this.shootoutTimer > 0) return;
    const side = this.shootoutTurn;
    const taker = this.shootoutTaker(side);
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK") ?? null;
    if (!taker) {
      this.finishMatch();
      return;
    }
    const round = Math.floor(this.shootout.length / 2) + 1;
    const pressureLvl = Math.min(1, (round - 1) / 4 + (this.shootout.length >= 10 ? 0.35 : 0));
    const out = solvePenalty({
      taker: taker.shooting,
      gk: gk?.defending ?? 60,
      pressure: pressureLvl,
      rnd: this.rnd
    });
    if (gk)
      this.trigger(gk, out.gkSide === 0 ? "save" : out.gkSide > 0 ? "diveRight" : "diveLeft", 1.2);
    this.trigger(taker, "penalty", 0.9);
    this.ball.vx = (out.skied ? 14 : 22) + this.rnd() * 6;
    this.ball.vz = out.skied ? Math.sign(out.takerSide || 1) * (GOAL_Z + 2 + this.rnd() * 2) : out.takerSide * GOAL_Z * 0.7;
    this.ballVy = out.skied ? 7 : 1.2;
    if (out.scored) taker.pensScored++;
    else taker.pensMissed++;
    if (!out.scored && !out.skied && gk) gk.saves++;
    this.stats[side].pens++;
    this.shootout.push({ side, name: taker.name, scored: out.scored });
    const hs = this.shootout.filter((k) => k.side === "home" && k.scored).length;
    const as = this.shootout.filter((k) => k.side === "away" && k.scored).length;
    this.pushEvent({
      minute: 120,
      type: "shootout",
      side,
      text: out.scored ? `${taker.name} converte (${hs} x ${as}).` : out.skied ? `${taker.name} isola por cima! (${hs} x ${as})` : `${gk?.name ?? "O goleiro"} pega a cobran\xE7a de ${taker.name}! (${hs} x ${as})`
    });
    const winner = shootoutWinner(this.shootout);
    if (winner) {
      this.pushEvent({
        minute: 120,
        type: "shootout",
        side: winner,
        text: `${this.setup(winner).name} vence nos p\xEAnaltis por ${winner === "home" ? hs : as} x ${winner === "home" ? as : hs}!`
      });
      this.finishMatch();
      return;
    }
    this.shootoutTurn = side === "home" ? "away" : "home";
    this.setupShootoutKick();
  }
  /* ---------------- cartões, expulsões e lesões ---------------- */
  issueYellow(p) {
    p.yellows++;
    this.stats[p.side].yellow++;
    if (p.yellows >= 2) {
      this.sendOff(p, "segundo amarelo");
      return;
    }
    this.trigger(p, "protest", 1.2);
    this.pushEvent({
      minute: this.minute(),
      type: "yellow",
      side: p.side,
      text: `Cart\xE3o amarelo para ${p.name}.`
    });
    const dissentRnd = makeRng(`dissent-${this.matchSeed}-${p.id}-${this.minute()}`);
    if (dissentRnd() < 0.015 + this.ref.strict * 0.03) {
      this.pushEvent({
        minute: this.minute(),
        type: "yellow",
        side: p.side,
        text: `${p.name} reclama demais e toma o segundo amarelo!`
      });
      this.issueYellow(p);
    }
  }
  /** expulsão vale de verdade: o jogador sai de campo e o time fica com 10 */
  sendOff(p, why) {
    if (p.sentOff) return;
    p.sentOff = true;
    this.stats[p.side].red++;
    this.stoppageDebt += 1;
    p.x = Math.sign(p.x || 1) * (FIELD_X + 1);
    p.z = FIELD_Z + 1;
    p.vx = 0;
    p.vz = 0;
    if (this.ball.holder === p.id) {
      this.ball.holder = null;
      this.looseTime = 0.3;
    }
    this.pushEvent({
      minute: this.minute(),
      type: "red",
      side: p.side,
      text: `Cart\xE3o vermelho para ${p.name} (${why})!`
    });
  }
  /** lesão no lance: semanas parado, queda física e (em geral) substituição */
  injure(p, cause) {
    if (p.injuryWeeks > 0 || p.sentOff) return;
    p.injuryWeeks = 1 + Math.floor(this.rnd() * 3) + (this.rnd() < 0.15 ? 3 : 0);
    p.stamina = Math.max(12, p.stamina - 25);
    this.stoppageDebt += 1;
    this.trigger(p, "dejected", 2.5);
    this.pushEvent({
      minute: this.minute(),
      type: "injury",
      side: p.side,
      text: `${p.name} se machuca ${cause} e preocupa.`
    });
  }
  /* ---------------- IA do treinador ---------------- */
  aiManage(side) {
    const min = this.minute();
    const userManaged = this.setup(side).cpu === false;
    const foe = side === "home" ? "away" : "home";
    const diff = this.stats[side].goals - this.stats[foe].goals;
    const lineup = this.players.filter((p) => p.side === side).map((p) => ({
      id: p.id,
      pid: p.pid,
      pos: p.pos,
      stamina: p.stamina,
      injuryWeeks: p.injuryWeeks,
      sentOff: p.sentOff,
      yellows: p.yellows,
      ovr: positionalOverall(p.pos, p)
    }));
    const setupBench = this.setup(side).bench ?? [];
    const bench = setupBench.map((b) => ({
      id: b.id,
      pos: b.pos,
      ovr: b.ovr,
      condition: b.condition,
      injuryWeeks: b.injuryWeeks,
      suspended: b.suspended
    }));
    const pick = aiSubPick(lineup, bench, diff, min, this.subsUsed[side], this.rnd);
    if (pick && (!userManaged || pick.reason === "les\xE3o")) {
      const incoming = setupBench.find((b) => b.id === pick.inId);
      if (incoming && this.subsUsed[side] < 5) {
        this.setup(side).bench = setupBench.filter((b) => b.id !== pick.inId);
        this.substitute(side, pick.outPid, incoming, pick.reason);
      }
    }
    if (!userManaged && min - this.aiTweakMin[side] >= 10) {
      const sentOffs = this.players.filter((p) => p.side === side && p.sentOff).length;
      const tweak = aiMentalityTweak(diff, min, sentOffs);
      if (tweak) {
        this.aiTweakMin[side] = min;
        const t = this.setup(side).tactics;
        t.mentality = Math.max(0, Math.min(4, t.mentality + tweak.mentality));
        t.pressing = Math.max(0, Math.min(2, t.pressing + tweak.pressing));
      }
    }
  }
  /* ---------------- bolas paradas ---------------- */
  inBox(x, z, defending) {
    const gx = defending === "home" ? -FIELD_X : FIELD_X;
    return Math.abs(x - gx) < BOX_DEPTH && Math.abs(z) < BOX_HALF;
  }
  /** melhor cobrador em campo (não expulso, não goleiro) */
  bestTaker(side, attr) {
    let best = null;
    for (const p of this.players) {
      if (p.side !== side || p.sentOff || p.pos === "GK") continue;
      if (!best || p[attr] > best[attr]) best = p;
    }
    return best;
  }
  setupPenalty(side) {
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const taker = this.bestTaker(side, "shooting");
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    if (!taker) return;
    taker.x = goalX - dir * PENALTY_DIST;
    taker.z = 0.6;
    taker.vx = 0;
    taker.vz = 0;
    if (gk) {
      gk.x = goalX - dir * 0.8;
      gk.z = 0;
      gk.vx = 0;
      gk.vz = 0;
    }
    for (const p of this.players) {
      if (p === taker || p === gk || p.sentOff) continue;
      const d = Math.hypot(p.x - (goalX - dir * PENALTY_DIST), p.z);
      if (d < 9.5) {
        const ang = Math.atan2(p.z, p.x - (goalX - dir * PENALTY_DIST));
        p.x = goalX - dir * PENALTY_DIST + Math.cos(ang) * 10.5;
        p.z = Math.sin(ang) * 10.5;
      }
    }
    this.ball.x = goalX - dir * PENALTY_DIST;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.setPiece = { kind: "penalty", side, takerId: taker.id, timer: 2.2 };
    this.restartTimer = 2.6;
    this.exemptUntil = this.time + 3;
    this.trigger(taker, "penalty", 2);
    this.pushEvent({
      minute: this.minute(),
      type: "penalty",
      side,
      text: `P\xEAnalti para o ${this.setup(side).short}! ${taker.name} vai para a cobran\xE7a.`
    });
    this.synchronizeBallPhysics();
  }
  takePenalty() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const taker = this.players.find((p) => p.id === sp.takerId) ?? null;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    this.setPiece = null;
    if (!taker) {
      this.scheduleRestart(side === "home" ? "away" : "home");
      return;
    }
    const late = this.minute() >= 75;
    const close = Math.abs(this.stats.home.goals - this.stats.away.goals) <= 1;
    const out = solvePenalty({
      taker: taker.shooting,
      gk: gk?.defending ?? 60,
      pressure: late && close ? 0.7 : 0.25,
      rnd: this.rnd
    });
    this.trigger(taker, "shot", 0.8);
    if (gk)
      this.trigger(gk, out.gkSide === 0 ? "save" : out.gkSide > 0 ? "diveRight" : "diveLeft", 1.15);
    this.lastPass[side] = null;
    this.stats[side].shots++;
    this.stats[side].pens++;
    this.stats[side].xg += XG_PENALTY;
    taker.shots++;
    taker.xg += XG_PENALTY;
    if (out.scored) taker.pensScored++;
    else taker.pensMissed++;
    const targetZ = out.skied ? Math.sign(out.takerSide || 1) * (GOAL_Z + 1.5 + this.rnd() * 2) : out.takerSide * GOAL_Z * 0.72;
    const targetH = out.skied ? 3.2 + this.rnd() * 1.5 : 0.35 + this.rnd() * 1.3;
    const dx = dir * FIELD_X - this.ball.x;
    const dz = targetZ - this.ball.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 24 + this.rnd() * 7;
    this.ball.vx = dx / d * power;
    this.ball.vz = dz / d * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    this.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = 0;
    this.lastTouch = side;
    this.pendingShot = {
      side,
      shooter: taker.id,
      outcome: out.scored ? "goal" : out.skied ? "off" : "saved",
      fromX: this.ball.x,
      fromZ: this.ball.z,
      targetZ,
      xg: XG_PENALTY,
      bigChance: true,
      bodyPart: "foot"
    };
    if (!out.scored && out.skied) {
      this.recordShot({
        x: this.ball.x,
        z: this.ball.z,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: XG_PENALTY,
        bigChance: true,
        bodyPart: "foot"
      });
      this.pushEvent({
        minute: this.minute(),
        type: "penalty",
        side,
        text: `${taker.name} isola o p\xEAnalti!`
      });
    }
    this.synchronizeBallPhysics();
  }
  setupDirectFK(side, fx, fz) {
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const taker = this.bestTaker(side, "shooting");
    if (!taker) return;
    taker.x = fx - dir * 1.2;
    taker.z = fz + 0.8;
    taker.vx = 0;
    taker.vz = 0;
    const foes = this.players.filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK").sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz));
    const wall = Math.min(foes.length, 2 + Math.floor(this.rnd() * 3));
    const ang = Math.atan2(0 - fz, goalX - fx);
    for (let i = 0; i < wall; i++) {
      const w = foes[i];
      const off = (i - (wall - 1) / 2) * 0.9;
      w.x = fx + Math.cos(ang) * 9.15 - Math.sin(ang) * off;
      w.z = fz + Math.sin(ang) * 9.15 + Math.cos(ang) * off;
      w.vx = 0;
      w.vz = 0;
      this.trigger(w, "block", 2.4);
    }
    this.ball.x = fx;
    this.ball.z = fz;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.setPiece = { kind: "directFK", side, takerId: taker.id, timer: 2.4 };
    this.restartTimer = 2.8;
    this.exemptUntil = this.time + 3;
    this.trigger(taker, "freeKick", 2.2);
    this.pushEvent({
      minute: this.minute(),
      type: "freekick",
      side,
      text: `Falta perigosa para o ${this.setup(side).short}. ${taker.name} na cobran\xE7a.`
    });
    this.synchronizeBallPhysics();
  }
  takeDirectFK() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const taker = this.players.find((p) => p.id === sp.takerId) ?? null;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    this.setPiece = null;
    if (!taker) {
      this.restartFor(side, "throwIn");
      return;
    }
    const fx = this.ball.x;
    const fz = this.ball.z;
    const dist = Math.hypot(dir * FIELD_X - fx, fz);
    const wall = this.players.filter(
      (p) => p.side !== side && !p.sentOff && Math.hypot(p.x - fx, p.z - fz) < 12
    ).length;
    const out = solveDirectFK({
      dist,
      central: Math.abs(fz) < 12,
      taker: taker.shooting,
      wall,
      gk: gk?.defending ?? 60,
      rnd: this.rnd
    });
    this.trigger(taker, "shot", 0.8);
    this.lastPass[side] = null;
    this.stats[side].shots++;
    this.stats[side].xg += out.xg;
    taker.shots++;
    taker.xg += out.xg;
    if (out.result === "wall") {
      const dx2 = dir * FIELD_X - fx;
      const dz2 = out.targetZ - fz;
      const d2 = Math.hypot(dx2, dz2) || 1;
      this.ball.vx = dx2 / d2 * 12;
      this.ball.vz = dz2 / d2 * 12;
      this.ballVy = 2.5;
      this.lastTouch = side;
      this.looseTime = 0;
      this.pushEvent({
        minute: this.minute(),
        type: "freekick",
        side,
        text: `A cobran\xE7a de ${taker.name} explode na barreira!`
      });
      this.recordShot({
        x: fx,
        z: fz,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: out.xg,
        bigChance: false,
        bodyPart: "foot"
      });
      this.synchronizeBallPhysics();
      return;
    }
    const dx = dir * FIELD_X - fx;
    const dz = out.targetZ - fz;
    const d = Math.hypot(dx, dz) || 1;
    const power = 21 + this.rnd() * 7;
    this.ball.vx = dx / d * power;
    this.ball.vz = dz / d * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    this.ballVy = (out.targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = (this.rnd() - 0.5) * 6;
    this.lastTouch = side;
    this.pendingShot = {
      side,
      shooter: taker.id,
      outcome: out.result,
      fromX: fx,
      fromZ: fz,
      targetZ: out.targetZ,
      xg: out.xg,
      bigChance: false,
      bodyPart: "foot"
    };
    if (out.result === "off") {
      this.recordShot({
        x: fx,
        z: fz,
        side,
        result: "off",
        minute: this.minute(),
        name: taker.name,
        xg: out.xg,
        bigChance: false,
        bodyPart: "foot"
      });
    }
    this.synchronizeBallPhysics();
  }
  setupCorner(side) {
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    const cornerZ = Math.sign(this.ball.z || 1) * (FIELD_Z - 0.8);
    const taker = this.players.filter((p) => p.side === side && !p.sentOff && p.pos !== "GK").sort((a, b) => b.passing - a.passing)[0] ?? null;
    if (!taker) return;
    taker.x = goalX - dir * 1.5;
    taker.z = cornerZ;
    taker.vx = 0;
    taker.vz = 0;
    const attack = this.players.filter((p) => p.side === side && !p.sentOff && p !== taker && p.pos !== "GK").sort((a, b) => b.physical - a.physical).slice(0, 5);
    attack.forEach((p, i) => {
      p.x = goalX - dir * (6 + i % 3 * 3.5) + (this.rnd() - 0.5) * 2;
      p.z = (i - 2) * 3.4 + (this.rnd() - 0.5) * 2;
    });
    const defense = this.players.filter((p) => p.side !== side && !p.sentOff && p.pos !== "GK").sort((a, b) => Math.hypot(a.x - goalX, a.z) - Math.hypot(b.x - goalX, b.z)).slice(0, 6);
    defense.forEach((p, i) => {
      p.x = goalX - dir * (4.5 + i % 3 * 3) + (this.rnd() - 0.5) * 2;
      p.z = (i - 2.5) * 2.8 + (this.rnd() - 0.5) * 2;
    });
    this.ball.x = goalX - dir * 1.2;
    this.ball.z = cornerZ;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.ball.holder = null;
    this.pendingShot = null;
    this.pass = null;
    this.stats[side].corners++;
    this.setPiece = { kind: "corner", side, takerId: taker.id, timer: 2.2 };
    this.restartTimer = 2.6;
    this.exemptUntil = this.time + 3.5;
    this.trigger(taker, "corner", 2);
    this.pushEvent({
      minute: this.minute(),
      type: "corner",
      side,
      text: `Escanteio para ${this.setup(side).short}.`
    });
    this.synchronizeBallPhysics();
  }
  takeCorner() {
    const sp = this.setPiece;
    if (!sp) return;
    const side = sp.side;
    const dir = this.attackDir(side);
    const goalX = dir * FIELD_X;
    this.lastPass[side] = { id: sp.takerId, time: this.time };
    this.setPiece = null;
    const attack = this.players.filter(
      (p) => p.side === side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22
    );
    const defense = this.players.filter(
      (p) => p.side !== side && !p.sentOff && p.pos !== "GK" && Math.abs(p.x - goalX) < 22
    );
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK" && !p.sentOff) ?? null;
    const att = attack.reduce((s, p) => s + p.physical + p.shooting * 0.4, 0);
    const dfn = defense.reduce((s, p) => s + p.physical + p.defending * 0.4, 0);
    const duel = solveCornerDuel({
      attack: att,
      defense: dfn,
      gkComes: !!gk && this.rnd() < 0.5,
      gk: gk?.defending ?? 60,
      rnd: this.rnd
    });
    if (duel.winner === "gk" && gk) {
      this.trigger(gk, "catch", 1);
      this.pushEvent({
        minute: this.minute(),
        type: "corner",
        side: gk.side,
        text: `${gk.name} sai do gol e fica com o escanteio.`
      });
      this.scheduleRestart(gk.side);
      return;
    }
    if (duel.winner === "defense") {
      const clearer = [...defense].sort((a, b) => b.physical - a.physical)[0] ?? null;
      if (clearer) {
        this.trigger(clearer, "headClear", 0.9);
        this.ball.x = clearer.x;
        this.ball.z = clearer.z;
        this.ball.vx = -dir * (14 + this.rnd() * 8);
        this.ball.vz = (this.rnd() - 0.5) * 14;
        this.ballVy = 4 + this.rnd() * 3;
        this.ball.height = 1.8;
        this.lastTouch = clearer.side;
        this.looseTime = 0;
      }
      this.pushEvent({
        minute: this.minute(),
        type: "corner",
        side,
        text: `A zaga afasta o escanteio.`
      });
      this.synchronizeBallPhysics();
      return;
    }
    const header = [...attack].sort((a, b) => b.physical + b.shooting - (a.physical + a.shooting))[0] ?? null;
    if (!header) {
      this.restartFor(side, "throwIn");
      return;
    }
    this.trigger(header, "header", 0.9);
    const goalP = duel.headerXg * 1.1;
    const onP = goalP + 0.4;
    const roll = this.rnd();
    const outcome = roll < goalP ? "goal" : roll < onP ? "saved" : "off";
    this.stats[side].shots++;
    this.stats[side].xg += duel.headerXg;
    header.shots++;
    header.xg += duel.headerXg;
    const targetZ = outcome === "off" ? Math.sign(this.rnd() - 0.5 || 1) * (GOAL_Z + 1 + this.rnd() * 3) : (this.rnd() - 0.5) * GOAL_Z * 1.5;
    const dx = goalX - header.x;
    const dz = targetZ - header.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 13 + this.rnd() * 6;
    this.ball.x = header.x;
    this.ball.z = header.z;
    this.ball.vx = dx / d * power;
    this.ball.vz = dz / d * power;
    this.ball.height = 1.9;
    this.ballVy = 0.5 + this.rnd() * 1.5;
    this.ballSpin = 0;
    this.lastTouch = side;
    if (outcome === "goal" && gk) {
      const dive = targetZ - gk.z;
      this.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.1);
    }
    this.pendingShot = {
      side,
      shooter: header.id,
      outcome,
      fromX: header.x,
      fromZ: header.z,
      targetZ,
      xg: duel.headerXg,
      bigChance: duel.headerXg > 0.12,
      bodyPart: "head"
    };
    if (outcome === "off") {
      if (this.rnd() < 0.2) this.lastTouch = side === "home" ? "away" : "home";
      this.recordShot({
        x: header.x,
        z: header.z,
        side,
        result: "off",
        minute: this.minute(),
        name: header.name,
        xg: duel.headerXg,
        bigChance: duel.headerXg > 0.12,
        bodyPart: "head"
      });
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${header.name} cabeceia para fora.`
      });
    } else {
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${header.name} cabeceia ap\xF3s o escanteio!`
      });
    }
    this.synchronizeBallPhysics();
  }
  tickSetPiece(dt) {
    const sp = this.setPiece;
    if (!sp) return;
    sp.timer -= dt;
    if (sp.timer > 0) return;
    if (sp.kind === "penalty") this.takePenalty();
    else if (sp.kind === "directFK") this.takeDirectFK();
    else this.takeCorner();
  }
  nearestOpponent(p) {
    let best = null;
    let bestD2 = Infinity;
    for (const o of this.players) {
      if (o.side === p.side || o.sentOff) continue;
      const d2 = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    return { opp: best, dist: Math.sqrt(bestD2) };
  }
  step(dt, clockScale = 1, useBallPhysics = true) {
    if (this.finished) return;
    if (this.phase === "half" || this.phase === "etBreak") {
      this.freezeT -= dt;
      this.tickActions(dt);
      this.sanitize();
      if (this.freezeT <= 0) this.advancePhase();
      return;
    }
    if (this.phase === "shootout") {
      this.tickShootout(dt);
      this.tickActions(dt);
      this.sanitize();
      return;
    }
    const clockDt = dt * Math.max(1, clockScale);
    this.time += clockDt;
    this.pressSurge.home = Math.max(0, this.pressSurge.home - dt);
    this.pressSurge.away = Math.max(0, this.pressSurge.away - dt);
    this.mentalityCache = null;
    const endAt = this.phaseEndAt();
    if (this.time >= endAt) {
      if (this.graceUntil < endAt) this.graceUntil = endAt + 40;
      if (this.readyToWhistle() || this.time >= endAt + 45) {
        this.graceUntil = 0;
        this.advancePhase();
        return;
      }
    }
    this.stats[this.possession].possessionTicks += clockDt;
    if (this.restartTimer > 0) this.restartTimer -= dt;
    this.tickActions(dt);
    this.moveOffBall(dt);
    this.separate();
    this.drainStamina(clockDt);
    this.moveBall(dt, useBallPhysics);
    this.sanitize();
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.dribble(holder, dt);
      this.pressure(holder, dt);
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0 && this.restartTimer <= 0) {
        this.decide(holder);
        const tempo = this.setup(holder.side).tactics.tempo;
        this.decisionTimer = 1.5 - tempo * 0.35 + this.rnd() * 0.6;
      }
    }
    this.separate();
    this.sanitize();
    if (this.setPiece) this.tickSetPiece(dt);
    if (this.time - this.aiLastCheck > 40) {
      this.aiLastCheck = this.time;
      this.aiManage("home");
      this.aiManage("away");
    }
    this.crowdPush();
  }
  /**
   * A torcida empurra: aos 75', se o mandante não está vencendo, a arquibancada
   * pega fogo uma vez — pernas frescas para quem está em campo.
   */
  crowdPush() {
    if (this.crowdPushDone || this.phase !== "second" || this.minute() < 75) return;
    if (this.stats.home.goals > this.stats.away.goals) return;
    this.crowdPushDone = true;
    for (const p of this.players) {
      if (p.side !== "home" || p.sentOff) continue;
      p.stamina = Math.min(100, p.stamina + 6);
    }
    this.pushEvent({
      minute: this.minute(),
      type: "crowd",
      side: "home",
      text: `A torcida empurra o ${this.setup("home").short}: o est\xE1dio inteiro canta!`
    });
  }
  /** ids dos jogadores designados a perseguir a bola solta */
  chasers() {
    const set = this.chaseIds;
    set.clear();
    if (this.ball.holder) return set;
    for (const side of ["home", "away"]) {
      let first = null;
      let second = null;
      let firstDistance = Infinity;
      let secondDistance = Infinity;
      for (const player of this.players) {
        if (player.side !== side || player.pos === "GK" || player.sentOff) continue;
        const dx = player.x - this.ball.x;
        const dz = player.z - this.ball.z;
        const distance = dx * dx + dz * dz;
        if (distance < firstDistance) {
          second = first;
          secondDistance = firstDistance;
          first = player;
          firstDistance = distance;
        } else if (distance < secondDistance) {
          second = player;
          secondDistance = distance;
        }
      }
      if (first) set.add(first.id);
      if (second) set.add(second.id);
    }
    return set;
  }
  moveOffBall(dt) {
    const bx = this.ball.x;
    const bz = this.ball.z;
    const chase = this.chasers();
    const remaining = Math.max(0, 90 - this.time / 60);
    const lateGame = remaining < 15;
    const goalDiff = this.stats.home.goals - this.stats.away.goals;
    const urgency = (side) => {
      if (!lateGame) return 0;
      const diff = side === "home" ? goalDiff : -goalDiff;
      if (diff < 0) return Math.min(1, (15 - remaining) / 15) * (diff <= -2 ? 1 : 0.8);
      if (diff > 0) return -Math.min(1, (15 - remaining) / 15) * 0.6;
      return 0;
    };
    const lineX = { home: FIELD_X, away: -FIELD_X };
    for (const q of this.players) {
      if (q.pos === "GK" || q.sentOff) continue;
      if (q.side === "home") {
        if (q.x < lineX.home) lineX.home = q.x;
      } else if (q.x > lineX.away) lineX.away = q.x;
    }
    for (const p of this.players) {
      if (p.sentOff) continue;
      if (p.id === this.ball.holder) continue;
      const setup = this.setup(p.side);
      const dir = this.attackDir(p.side);
      const attacking = this.possession === p.side;
      const defendingWide = !attacking && Math.abs(bz) > FIELD_Z * 0.7;
      const widthFactor = (0.62 + setup.tactics.width * 0.14) * (defendingWide ? 0.76 : 1);
      const surge = !attacking && this.pressSurge[p.side] > 0;
      const pressLine = attacking ? 10 + setup.tactics.mentality * 5 : -6 + setup.tactics.pressing * 7 + (surge ? 7 : 0);
      let tx = p.slotX * FIELD_X * 0.9 + this.mentalityShift(p.side) + bx * 0.22 + pressLine * dir;
      let tz = p.slotZ * FIELD_Z * widthFactor + bz * 0.28;
      let sprint = 1;
      const ballDist = Math.hypot(bx - p.x, bz - p.z);
      if (p.pos === "GK") {
        const ownGoalX = dir * -FIELD_X;
        const ballToGoal = Math.abs(bx - ownGoalX);
        const stepOut = Math.max(0, Math.min(9, (24 - ballToGoal) * 0.42));
        tx = ownGoalX + dir * stepOut;
        tz = Math.max(-GOAL_Z + 0.45, Math.min(GOAL_Z - 0.45, bz * (0.12 + stepOut * 0.022)));
        const incoming = this.pendingShot?.side !== p.side ? this.pendingShot : null;
        if (incoming) {
          const reaction = 0.32 + p.defending / 220;
          tz += (Math.max(-GOAL_Z + 0.35, Math.min(GOAL_Z - 0.35, incoming.targetZ)) - tz) * reaction;
          tx += dir * Math.min(1.4, ballDist * 0.04);
          sprint = 1.18;
        }
        const sweepRange = 9 + setup.tactics.mentality * 1.35 + p.pace / 35;
        if (!this.ball.holder && !incoming && ballDist < sweepRange && Math.abs(bx - dir * -FIELD_X) < 18) {
          tx = bx;
          tz = bz;
          sprint = 1.25;
        }
      } else if (chase.has(p.id)) {
        tx = bx + this.ball.vx * 0.22;
        tz = bz + this.ball.vz * 0.22;
        sprint = 1.35;
      } else if (!attacking) {
        if (p.pos === "DF") {
          const line = lineX[p.side];
          const trap = setup.tactics.pressing >= 3 && Math.abs(bx - line) > 14 ? dir * 3.5 : 0;
          tx = tx * 0.35 + (line + trap) * 0.65;
          let markZ = null;
          let best = 9;
          for (const q of this.players) {
            if (q.side === p.side || q.pos === "GK" || q.sentOff) continue;
            const gap = Math.abs(q.z - tz);
            if (gap < best && Math.abs(q.x - tx) < 16) {
              best = gap;
              markZ = q.z;
            }
          }
          if (markZ !== null) tz = tz * 0.55 + markZ * 0.45;
        }
        if (ballDist < 18) {
          const pull = p.pos === "DF" ? 0.35 : 0.6;
          tx += (bx - tx) * pull;
          tz += (bz - tz) * pull;
          sprint = (surge ? 1.3 : 1.15) * (0.82 + p.stamina / 550);
        }
        tx += urgency(p.side) * 7 * dir;
      } else {
        const holder = this.players.find((q) => q.id === this.ball.holder);
        const ahead = holder ? (holder.x - p.x) * dir : 0;
        if (p.pos === "FW") {
          const backline = lineX[p.side === "home" ? "away" : "home"];
          tx = tx * 0.4 + (backline + dir * 1.2) * 0.6;
          tz += (p.number % 2 === 0 ? 1 : -1) * 3.2;
        } else if (p.pos === "MF") {
          if (Math.abs(p.slotZ) > 0.45) {
            tz *= 0.55;
            tx += dir * 4;
          } else if (ahead > 6) {
            tx -= dir * 3.5;
          }
        } else if (p.pos === "DF" && Math.abs(p.slotZ) > 0.5 && ahead > -4) {
          tx += dir * 12;
          tz += Math.sign(p.slotZ) * 3.5;
          sprint = 1.2;
        }
        tz += Math.sin(this.time * 0.4 + p.number) * 0.9;
        tx += urgency(p.side) * 5 * dir;
      }
      tx = Math.max(-FIELD_X + 2, Math.min(FIELD_X - 2, tx));
      tz = Math.max(-FIELD_Z + 2, Math.min(FIELD_Z - 2, tz));
      const stam = 0.78 + p.stamina / 100 * 0.22;
      const baseSpeed = 2.45 + p.pace / 100 * 3.65;
      const speed = baseSpeed * (p.pos === "GK" ? 0.68 : 1) * Math.min(1.22, sprint) * stam;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      let speedEff = speed;
      if (d > 1e-3) {
        const curSpeed = Math.hypot(p.vx, p.vz);
        if (curSpeed > 2.5) {
          const dot = dx / d * (p.vx / curSpeed) + dz / d * (p.vz / curSpeed);
          if (dot < 0.2) speedEff = speed * (0.6 + 0.4 * Math.max(0, (dot + 0.2) / 1.2));
        }
        if ((this.reactionUntil.get(p.id) ?? 0) > this.time) speedEff *= 0.3;
      }
      advanceAthlete(p, tx, tz, speedEff, dt, this.weather === "rain" ? 0.72 : 1);
    }
  }
  /** empurra jogadores sobrepostos para que não se atravessem */
  separate() {
    const R = 0.85;
    const list = this.players;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.89) continue;
        let d = Math.sqrt(d2);
        if (d > R * 2) continue;
        if (d < 1e-4) {
          dx = (this.rnd() - 0.5) * 0.02;
          dz = (this.rnd() - 0.5) * 0.02;
          d = Math.hypot(dx, dz) || 1e-4;
        }
        const overlap = R * 2 - d;
        const aWeight = a.id === this.ball.holder ? 0.25 : 1;
        const bWeight = b.id === this.ball.holder ? 0.25 : 1;
        const totalWeight = aWeight + bWeight;
        const nx = dx / d;
        const nz = dz / d;
        athleteContact(a, b, nx, nz);
        a.x -= nx * overlap * (aWeight / totalWeight);
        a.z -= nz * overlap * (aWeight / totalWeight);
        b.x += nx * overlap * (bWeight / totalWeight);
        b.z += nz * overlap * (bWeight / totalWeight);
      }
    }
    for (const p of list) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
    }
  }
  /** desgaste físico ao longo do jogo (calor e chuva pesam) */
  drainStamina(dt) {
    const climate = staminaDrainMult(this.weather);
    for (const p of this.players) {
      const speed = Math.hypot(p.vx, p.vz);
      const effort = 15e-4 + speed / 9 * 8e-3 * (p.pos === "GK" ? 0.25 : 1);
      const resist = 0.6 + p.physical / 100 * 0.6;
      p.stamina = Math.max(12, p.stamina - effort * climate / resist * dt);
    }
  }
  /** blindagem contra NaN/Infinity vindos de dados ruins */
  sanitize() {
    const fix = (v, fallback) => Number.isFinite(v) ? v : fallback;
    for (const p of this.players) {
      p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, fix(p.x, 0)));
      p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, fix(p.z, 0)));
      p.vx = Math.max(-14, Math.min(14, fix(p.vx, 0)));
      p.vz = Math.max(-14, Math.min(14, fix(p.vz, 0)));
      p.stamina = Math.max(0, Math.min(100, fix(p.stamina, 70)));
    }
    const b = this.ball;
    b.x = Math.max(-FIELD_X - 2, Math.min(FIELD_X + 2, fix(b.x, 0)));
    b.z = Math.max(-FIELD_Z - 2, Math.min(FIELD_Z + 2, fix(b.z, 0)));
    b.vx = Math.max(-45, Math.min(45, fix(b.vx, 0)));
    b.vz = Math.max(-45, Math.min(45, fix(b.vz, 0)));
    b.height = Math.max(0.1, Math.min(12, fix(b.height, 0.12)));
    this.ballVy = Math.max(-30, Math.min(30, fix(this.ballVy, 0)));
    this.ballSpin = Math.max(-12, Math.min(12, fix(this.ballSpin, 0)));
  }
  moveBall(dt, useBallPhysics = true) {
    const holder = this.ball.holder ? this.players.find((p) => p.id === this.ball.holder) : null;
    if (holder) {
      this.looseTime = 0;
      this.ballVy = 0;
      this.ballSpin = 0;
      this.pendingShot = null;
      this.pass = null;
      if (useBallPhysics && this.stepAuthoritativeBall(dt, holder)) return;
      const hs = Math.hypot(holder.vx, holder.vz) || 1;
      this.ball.x = holder.x + holder.vx / hs * 0.9;
      this.ball.z = holder.z + holder.vz / hs * 0.9;
      this.ball.height = 0.12;
      return;
    }
    this.looseTime += dt;
    const previousBall = { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    this.lastAuthoritative = useBallPhysics && this.stepAuthoritativeBall(dt, null);
    if (!this.lastAuthoritative) {
      const cond = pitchCondition(this.weather);
      const airborne = this.ball.height > 0.14;
      if (airborne) {
        this.ball.vx += this.wind.x * dt;
        this.ball.vz += this.wind.z * dt;
      }
      if (this.ballSpin !== 0 && airborne) {
        const vx = this.ball.vx;
        const vz = this.ball.vz;
        const sp = Math.hypot(vx, vz) || 1;
        this.ball.vx += -vz / sp * this.ballSpin * dt;
        this.ball.vz += vx / sp * this.ballSpin * dt;
        this.ballSpin *= Math.exp(-0.8 * dt);
      }
      const drag = airborne ? cond.airDrag : cond.rollDrag;
      const kd = Math.exp(-drag * dt);
      this.ball.vx *= kd;
      this.ball.vz *= kd;
      this.ball.x += this.ball.vx * dt;
      this.ball.z += this.ball.vz * dt;
      this.ballVy -= 9.81 * dt;
      this.ball.height += this.ballVy * dt;
      if (this.ball.height <= 0.12) {
        this.ball.height = 0.12;
        if (this.ballVy < -0.6) {
          this.ballVy = -this.ballVy * cond.bounce;
          this.ball.vx *= cond.skid;
          this.ball.vz *= cond.skid;
        } else {
          this.ballVy = 0;
        }
      }
    }
    if (this.tryBlock(dt)) return;
    if (this.pendingShot && this.resolveShot(previousBall)) return;
    if (Math.abs(this.ball.z) > FIELD_Z - 0.5) {
      this.ball.z = Math.sign(this.ball.z) * (FIELD_Z - 1);
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      this.restartFor(this.lastTouch === "home" ? "away" : "home", "throwIn");
      return;
    }
    if (Math.abs(this.ball.x) > FIELD_X - 0.5) {
      const endSide = this.ball.x > 0 ? "away" : "home";
      this.ball.x = Math.sign(this.ball.x) * (FIELD_X - 0.6);
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.pendingShot = null;
      if (this.lastTouch === endSide) {
        this.ball.z = Math.sign(this.ball.z || 1) * (FIELD_Z - 1);
        this.restartFor(endSide === "home" ? "away" : "home", "corner");
      } else {
        this.ball.z = 0;
        this.scheduleRestart(endSide);
      }
      return;
    }
    let closest = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.sentOff) continue;
      if (this.pass && p.id === this.pass.from && this.time < this.pass.until) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        closest = p;
      }
    }
    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vz);
    const h = this.ball.height;
    const reachable = h <= 2.4;
    if (closest && bestD < 1.9 && ballSpeed < 30 && reachable) {
      this.controlBall(closest, ballSpeed, h);
      return;
    }
    if (this.looseTime > 3.5 && ballSpeed < 4 && closest) {
      closest.x = this.ball.x;
      closest.z = this.ball.z;
      this.ball.holder = closest.id;
      this.possession = closest.side;
      this.lastTouch = closest.side;
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.pass = null;
      this.looseTime = 0;
      this.decisionTimer = 0.5;
      this.synchronizeBallPhysics();
    }
  }
  /**
   * Primeiro toque. Bola forte ou alta pode escapar do controle e sobrar viva —
   * o jogador toca nela em vez de a bola simplesmente colar no pé.
   */
  controlBall(p, ballSpeed, h) {
    const isReceiver = this.pass?.to === p.id;
    if (this.pass && !isReceiver && p.side !== this.pass.side) {
      p.interceptions++;
      this.stats[p.side].interceptions++;
    }
    if (this.pass && isReceiver && this.time > this.exemptUntil) {
      const forward = (p.x - this.pass.fromX) * this.pass.dir > 1;
      if (forward && isOffside(p.x, defensiveLineX(this.players, p.side), this.pass.dir)) {
        p.offsides++;
        this.stats[p.side].offsides++;
        this.pass = null;
        this.ball.vx = 0;
        this.ball.vz = 0;
        this.ballVy = 0;
        this.ball.height = 0.12;
        this.trigger(p, "protest", 1.2);
        this.pushEvent({
          minute: this.minute(),
          type: "offside",
          side: p.side,
          text: `Impedimento de ${p.name}.`
        });
        this.restartFor(p.side === "home" ? "away" : "home", "throwIn");
        return;
      }
    }
    const skill = (p.passing * 0.5 + p.physical * 0.3 + p.defending * 0.2) / 100;
    const difficulty = ballSpeed / 34 + (h > 0.9 ? 0.28 : 0) + controlFailAdd(this.weather);
    const ok = isReceiver ? this.rnd() < 0.62 + skill * 0.42 - difficulty * 0.5 : this.rnd() < 0.45 + skill * 0.45 - difficulty * 0.55;
    this.trigger(p, h > 0.9 ? "header" : "trap", 0.5);
    this.lastTouch = p.side;
    this.pass = null;
    this.ballVy = 0;
    this.ballSpin = 0;
    if (ok) {
      this.ball.holder = p.id;
      this.possession = p.side;
      this.ball.vx = 0;
      this.ball.vz = 0;
      this.ball.height = 0.12;
      this.looseTime = 0;
      if (isReceiver) this.stats[p.side].passesOk++;
      this.synchronizeBallPhysics();
      return;
    }
    const dirx = this.attackDir(p.side);
    const spill = 2.6 + this.rnd() * 3.4;
    const ang = (this.rnd() - 0.5) * 1.4;
    this.ball.holder = null;
    this.ball.vx = Math.cos(ang) * spill * dirx;
    this.ball.vz = Math.sin(ang) * spill;
    this.ball.height = h > 0.9 ? 0.9 : 0.12;
    this.ballVy = h > 0.9 ? 1.4 : 0;
    this.looseTime = 0.4;
    const pressingSide = p.side === "home" ? "away" : "home";
    this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 2.5);
    this.synchronizeBallPhysics();
  }
  /**
   * Defesa ativa: um adversário no caminho pode bloquear o chute/passe.
   * Devolve verdadeiro quando a jogada foi encerrada aqui.
   */
  tryBlock(dt) {
    const speed = Math.hypot(this.ball.vx, this.ball.vz);
    if (speed < 8 || this.ball.height > 1.9) return false;
    const attacking = this.pendingShot?.side ?? (this.pass ? this.lastTouch : null);
    if (!attacking) return false;
    for (const p of this.players) {
      if (p.side === attacking || p.pos === "GK" || p.sentOff) continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d > 1.25) continue;
      const chance = (0.35 + p.defending / 100 * 0.5) * Math.min(1, dt * 30);
      if (this.rnd() > chance) continue;
      this.trigger(p, this.rnd() < 0.45 ? "slide" : "block", 0.7);
      p.tackles++;
      this.lastTouch = p.side;
      const wasShot = !!this.pendingShot;
      this.pendingShot = null;
      this.pass = null;
      const ang = Math.atan2(this.ball.vz, this.ball.vx) + Math.PI + (this.rnd() - 0.5) * 1.6;
      const back = speed * (0.2 + this.rnd() * 0.25);
      this.ball.vx = Math.cos(ang) * back;
      this.ball.vz = Math.sin(ang) * back;
      this.ballVy = 1.6 + this.rnd() * 2.4;
      this.ballSpin = 0;
      this.synchronizeBallPhysics();
      if (wasShot) {
        this.pushEvent({
          minute: this.minute(),
          type: "shot",
          side: attacking,
          text: `${p.name} se joga e bloqueia a finaliza\xE7\xE3o!`
        });
      }
      return true;
    }
    return false;
  }
  /**
   * Resolve a finalização quando a bola chega à meta: gol entre as traves,
   * defesa do goleiro no plano da linha, ou segue viva para fora.
   */
  resolveShot(previous = { x: this.ball.x, z: this.ball.z, height: this.ball.height }) {
    const s = this.pendingShot;
    const dir = this.attackDir(s.side);
    const goalX = dir * FIELD_X;
    const gk = this.players.find((p) => p.side !== s.side && p.pos === "GK") ?? null;
    const shooter = this.players.find((p) => p.id === s.shooter) ?? null;
    const planeX = goalX - dir * 1.6;
    const crossed = dir > 0 ? previous.x < planeX && this.ball.x >= planeX : previous.x > planeX && this.ball.x <= planeX;
    const reached = crossed || (dir > 0 ? this.ball.x >= planeX : this.ball.x <= planeX);
    if (!reached) return false;
    const segment = this.ball.x - previous.x;
    const ratio = crossed && Math.abs(segment) > 1e-4 ? Math.max(0, Math.min(1, (planeX - previous.x) / segment)) : 1;
    const crossingZ = previous.z + (this.ball.z - previous.z) * ratio;
    const crossingHeight = previous.height + (this.ball.height - previous.height) * ratio;
    if (s.outcome === "saved" && gk) {
      const dive = crossingZ - gk.z;
      this.trigger(
        gk,
        Math.abs(dive) < 1.2 ? this.rnd() < 0.5 ? "catch" : "save" : dive > 0 ? "diveRight" : "diveLeft",
        1.1
      );
      gk.saves++;
      this.stats[s.side].onTarget++;
      this.recordShot({
        x: s.fromX,
        z: s.fromZ,
        side: s.side,
        result: "saved",
        minute: this.minute(),
        name: shooter?.name ?? "",
        xg: s.xg,
        bigChance: s.bigChance,
        bodyPart: s.bodyPart
      });
      this.pushEvent({
        minute: this.minute(),
        type: "save",
        side: s.side,
        text: `${gk.name} faz a defesa em chute de ${shooter?.name ?? "o atacante"}.`
      });
      this.pendingShot = null;
      if (this.rnd() < 0.45) {
        gk.x = this.ball.x - dir * 0.4;
        gk.z = this.ball.z * 0.6;
        const ang = Math.atan2(this.ball.z, -dir) + (this.rnd() - 0.5) * 1.2;
        const back = 6 + this.rnd() * 7;
        this.ball.holder = null;
        this.ball.vx = -dir * Math.abs(Math.cos(ang) * back);
        this.ball.vz = Math.sin(ang) * back;
        this.ballVy = 1.8 + this.rnd() * 2;
        this.lastTouch = gk.side;
        this.looseTime = 0;
      } else {
        this.scheduleRestart(gk.side);
      }
      return true;
    }
    if (s.outcome === "goal") {
      if (Math.abs(crossingZ) < GOAL_Z && crossingHeight < 2.44) {
        const shotXg = s.xg;
        const shotBig = s.bigChance;
        const shotBody = s.bodyPart;
        this.pendingShot = null;
        this.scoreGoal(s.side, shooter, s.fromX, s.fromZ, shotXg, shotBig, shotBody);
        return true;
      }
      return this.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
    }
    return this.woodworkOrRelease(s, shooter, crossingZ, crossingHeight, dir);
  }
  /**
   * Trave viva: chute que cruza o plano da meta raspando poste/travessão vira
   * evento "Na trave!" e segue em jogo. No integrador compatível a reflexão é
   * manual (determinística pelo estado da bola, sem consumir o rng); na
   * autoridade Rapier a colisão física já aconteceu — só registra o evento.
   */
  woodworkOrRelease(s, shooter, crossingZ, crossingH, dir) {
    this.pendingShot = null;
    const hit = woodworkAt(crossingZ, crossingH);
    if (!hit) return false;
    const where = hit === "post" ? "a trave" : "o travess\xE3o";
    this.pushEvent({
      minute: this.minute(),
      type: "post",
      side: s.side,
      text: `NA TRAVE! ${shooter?.name ?? "O chute"} explode em ${where}!`
    });
    this.trigger(shooter, "protest", 1.4);
    this.recordShot({
      x: s.fromX,
      z: s.fromZ,
      side: s.side,
      result: "off",
      minute: this.minute(),
      name: shooter?.name ?? "",
      xg: s.xg,
      bigChance: true,
      bodyPart: s.bodyPart
    });
    if (!this.lastAuthoritative) {
      const speed = Math.hypot(this.ball.vx, this.ball.vz);
      if (hit === "post") {
        this.ball.vx = -dir * Math.abs(this.ball.vx) * 0.5;
        this.ball.vz += Math.sign(crossingZ || 1) * (1.5 + Math.min(2.5, speed * 0.12));
        this.ballVy = 1.6 + Math.min(2, speed * 0.06);
      } else {
        this.ballVy = Math.abs(this.ballVy) * 0.45 + 1.2;
        this.ball.vx *= 0.55;
        this.ball.vz *= 0.55;
      }
      this.ballSpin = 0;
      this.looseTime = 0;
    }
    return false;
  }
  /** Registra o gol, celebrações e reinício. */
  scoreGoal(side, shooter, fromX, fromZ, xg = 0, bigChance = false, bodyPart = "foot") {
    this.stats[side].onTarget++;
    this.stats[side].goals++;
    this.stoppageDebt += 0.5;
    if (shooter) shooter.goals++;
    const assist = this.lastPass[side];
    if (assist && this.time - assist.time < 12 && assist.id !== shooter?.id) {
      const provider = this.players.find((p) => p.id === assist.id);
      if (provider) provider.assists++;
    }
    this.lastPass[side] = null;
    this.recordShot({
      x: fromX,
      z: fromZ,
      side,
      result: "goal",
      minute: this.minute(),
      name: shooter?.name ?? "",
      xg,
      bigChance,
      bodyPart
    });
    this.scorers.push({ minute: this.minute(), side, name: shooter?.name ?? "" });
    const celeb = this.rnd();
    this.trigger(
      shooter,
      celeb < 0.34 ? "kneeSlide" : celeb < 0.67 ? "celebrateRun" : "celebrate",
      6
    );
    for (const m of this.players) {
      if (m.side === side && m.id !== shooter?.id)
        this.trigger(m, m.pos === "GK" ? "celebrate" : "hug", 5.2);
      else if (m.side !== side) this.trigger(m, "dejected", 4.4);
    }
    this.pushEvent({
      minute: this.minute(),
      type: "goal",
      side,
      text: `GOL! ${shooter?.name ?? "O atacante"} marca para o ${this.setup(side).short}!`
    });
    this.kickoff(side === "home" ? "away" : "home");
  }
  /** entrega a bola parada ao jogador mais próximo do lado indicado */
  restartFor(side, kind) {
    if (kind === "corner") {
      this.setupCorner(side);
      return;
    }
    let best = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.side !== side || p.pos === "GK") continue;
      const d = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    best.x = this.ball.x;
    best.z = this.ball.z;
    best.vx = 0;
    best.vz = 0;
    this.ball.holder = best.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 0.8;
    this.trigger(best, kind, 0.9);
    this.exemptUntil = this.time + 1.5;
    this.synchronizeBallPhysics();
  }
  dribble(holder, dt) {
    if (this.restartTimer > 0) {
      const k2 = Math.exp(-7 * dt);
      holder.vx *= k2;
      holder.vz *= k2;
      return;
    }
    const dir = this.attackDir(holder.side);
    const targetX = dir * FIELD_X;
    const dx = targetX - holder.x;
    const dz = -holder.z * 0.25 + Math.sin(this.time * 0.9 + holder.number) * 4;
    const d = Math.hypot(dx, dz) || 1;
    const speed = (2.35 + holder.pace / 100 * 3.55) * (0.82 + holder.stamina / 100 * 0.18);
    const targetVx = dx / d * speed;
    const targetVz = dz / d * speed;
    const k = 1 - Math.exp(-3.4 * dt);
    holder.vx += (targetVx - holder.vx) * k;
    holder.vz += (targetVz - holder.vz) * k;
    holder.x += holder.vx * dt;
    holder.z += holder.vz * dt;
    holder.x = Math.max(-FIELD_X + 1, Math.min(FIELD_X - 1, holder.x));
    holder.z = Math.max(-FIELD_Z + 1, Math.min(FIELD_Z - 1, holder.z));
  }
  pressure(holder, dt) {
    const { opp, dist } = this.nearestOpponent(holder);
    if (!opp || dist > 2.2 || this.restartTimer > 0) return;
    const press = 0.55 + this.setup(opp.side).tactics.pressing * 0.22;
    let support = 0;
    for (const defender of this.players) {
      if (defender.side !== opp.side || defender.id === opp.id) continue;
      if (Math.hypot(defender.x - holder.x, defender.z - holder.z) < 3.2) support += 1;
    }
    const overload = 1 + Math.min(2, support) * 0.28;
    const fatigue = 0.55 + opp.stamina / 100 * 0.45;
    const ctx = duelMult({ home: opp.side === "home", morale: this.setup(opp.side).morale ?? 70 }) / duelMult({ home: holder.side === "home", morale: this.setup(holder.side).morale ?? 70 });
    const chance = (opp.defending * 0.7 + opp.physical * 0.3) / (holder.pace * 0.45 + holder.physical * 0.3 + holder.passing * 0.25 + 60) * press * overload * fatigue * ctx * dt * 1.6;
    if (this.rnd() < chance) {
      const slide = this.rnd() < 0.4;
      this.trigger(opp, slide ? "slide" : "tackle", slide ? 1 : 0.6);
      opp.tackles++;
      this.trigger(holder, "duel", 0.5);
      if (this.rnd() < 0.22 * foulMult(this.weather)) {
        this.trigger(holder, "protest", 1.4);
        this.stats[opp.side].fouls++;
        holder.foulsWon++;
        const dirH = this.attackDir(holder.side);
        const goalX = dirH * FIELD_X;
        const distGoal = Math.hypot(goalX - holder.x, holder.z);
        const between = this.players.filter(
          (o) => o.side === opp.side && !o.sentOff && o.pos !== "GK" && (o.x - holder.x) * dirH > -2 && Math.hypot(goalX - o.x, o.z) < distGoal
        ).length;
        const foul = {
          slide,
          tactical: holder.x * dirH < -8 && Math.hypot(holder.vx, holder.vz) > 5,
          goalDenied: distGoal < 16 && between <= 1,
          rapSheet: opp.yellows,
          ref: this.ref,
          rnd: this.rnd
        };
        this.pushEvent({
          minute: this.minute(),
          type: "foul",
          side: opp.side,
          text: `Falta de ${opp.name} sobre ${holder.name}.`
        });
        const card = cardForFoul(foul);
        if (card === "red") this.sendOff(opp, "entrada violenta");
        else if (card === "yellow") this.issueYellow(opp);
        const hurtP = (slide ? 0.05 : 0.015) * (holder.stamina < 40 ? 1.8 : 1);
        if (this.rnd() < hurtP) this.injure(holder, "na dividida");
        if (this.inBox(holder.x, holder.z, opp.side)) this.setupPenalty(holder.side);
        else if (distGoal < 32) this.setupDirectFK(holder.side, holder.x, holder.z);
        else this.restartTimer = 1.4;
        return;
      }
      this.ball.holder = opp.id;
      this.possession = opp.side;
      this.lastTouch = opp.side;
      this.decisionTimer = 0.4;
      this.trigger(opp, "intercept", 0.5);
      if (this.rnd() < 8e-3) this.injure(holder, "na dividida");
    }
  }
  decide(holder) {
    const dir = this.attackDir(holder.side);
    const goalX = dir * FIELD_X;
    const distGoal = Math.hypot(goalX - holder.x, holder.z);
    const { dist: pressDist } = this.nearestOpponent(holder);
    const mentality = this.setup(holder.side).tactics.mentality;
    const chance = xgForShot({
      dist: distGoal,
      wide: Math.abs(holder.z),
      bodyPart: "foot",
      pressDist,
      onRun: Math.hypot(holder.vx, holder.vz) > 5
    });
    const shootUrge = distGoal < 30 ? Math.min(0.72, chance * 2.4 + (distGoal < 9 ? 0.08 : 0)) * (0.8 + holder.shooting / 500) * (0.9 + mentality * 0.05) : 0;
    if (holder.pos !== "GK" && this.rnd() < shootUrge) {
      this.shoot(holder, distGoal);
      return;
    }
    const mates = this.players.filter(
      (p) => p.side === holder.side && p.id !== holder.id && !p.sentOff
    );
    let best = null;
    let bestScore = -Infinity;
    const pack = (players) => new Float64Array(players.flatMap((p) => [p.x, p.z, p.vx, p.vz]));
    const defenders = this.players.filter((p) => p.side !== holder.side && !p.sentOff);
    let lanes;
    try {
      lanes = this.passLaneKernel(holder.x, holder.z, pack(mates), pack(defenders));
    } catch {
      this.passLaneKernel = evaluatePassLanesFallback;
      lanes = this.passLaneKernel(holder.x, holder.z, pack(mates), pack(defenders));
    }
    for (const [index, m] of mates.entries()) {
      const dist = lanes[index * 3];
      if (dist < 4 || dist > 42) continue;
      const forward = (m.x - holder.x) * dir;
      const cover = lanes[index * 3 + 1];
      const laneRisk = lanes[index * 3 + 2];
      const score = forward * (0.7 + mentality * 0.12) + cover * 1.7 - dist * 0.32 - laneRisk + this.rnd() * 8;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (!best) return;
    const rawDist = Math.hypot(best.x - holder.x, best.z - holder.z);
    const isBackPass = (best.x - holder.x) * dir < -2;
    if (isBackPass) {
      const pressingSide = holder.side === "home" ? "away" : "home";
      this.pressSurge[pressingSide] = Math.max(this.pressSurge[pressingSide], 1.6);
    }
    const power = Math.min(31, 10 + rawDist * 0.8);
    const flight = rawDist / power;
    const aimX = best.x + best.vx * flight * 0.8;
    const aimZ = best.z + best.vz * flight * 0.8;
    const success = Math.min(0.96, holder.passing / 100 * (1 - rawDist / 90) + 0.25);
    const errRoll = this.rnd() * passErrMult(this.weather);
    const err = success > errRoll ? 0 : (this.rnd() - 0.5) * 12;
    const dx = aimX - holder.x;
    const dz = aimZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const wide = Math.abs(holder.z) > FIELD_Z * 0.55 && Math.abs(best.x - dir * FIELD_X) < 30;
    const lofted = wide || rawDist > 22;
    this.trigger(
      holder,
      wide ? "cross" : rawDist > 24 ? "passLong" : "pass",
      rawDist > 24 ? 0.85 : 0.6
    );
    holder.passes++;
    this.stats[holder.side].passes++;
    this.lastPass[holder.side] = { id: holder.id, time: this.time };
    this.ball.holder = null;
    this.lastTouch = holder.side;
    this.pass = {
      to: best.id,
      from: holder.id,
      until: this.time + 0.45,
      fromX: holder.x,
      dir,
      side: holder.side
    };
    this.ball.vx = dx / d * power + err * 0.18;
    this.ball.vz = dz / d * power + err;
    if (lofted) {
      const t = Math.max(0.4, d / power);
      this.ball.height = 0.35;
      this.ballVy = 4.905 * t;
      this.ballSpin = wide ? (this.rnd() - 0.5) * 5 : 0;
    } else {
      this.ball.height = 0.12;
      this.ballVy = 0;
      this.ballSpin = 0;
    }
    this.synchronizeBallPhysics();
  }
  shoot(holder, distGoal) {
    const side = holder.side;
    const dir = this.attackDir(side);
    this.stats[side].shots++;
    holder.shots++;
    const gk = this.players.find((p) => p.side !== side && p.pos === "GK");
    const gkSkill = gk ? gk.defending * 0.7 + gk.physical * 0.3 : 60;
    const { dist: pressD } = this.nearestOpponent(holder);
    const xg = xgForShot({
      dist: distGoal,
      wide: Math.abs(holder.z),
      bodyPart: "foot",
      pressDist: pressD,
      onRun: Math.hypot(holder.vx, holder.vz) > 5
    });
    this.stats[side].xg += xg;
    holder.xg += xg;
    const probabilities = shotProbabilities({
      xg,
      shooting: holder.shooting - Math.max(0, 55 - holder.stamina) * 0.08,
      goalkeeper: gkSkill,
      distance: distGoal
    });
    const onTarget = this.rnd() < probabilities.onTarget;
    const outcome = !onTarget ? "off" : this.rnd() < probabilities.goalGivenTarget ? "goal" : "saved";
    const roll = this.rnd();
    this.trigger(
      holder,
      distGoal > 22 ? "shotPower" : roll < 0.12 ? "chip" : roll < 0.24 ? "volley" : roll < 0.32 ? "bicycle" : roll < 0.6 ? "shotPlaced" : "shot",
      0.8
    );
    this.ball.holder = null;
    this.lastTouch = side;
    for (const p of this.players) {
      if (p.side === side || p.pos === "GK") continue;
      if (Math.hypot(p.x - holder.x, p.z - holder.z) < 7) {
        this.reactionUntil.set(p.id, this.time + 0.45 + this.rnd() * 0.2);
      }
    }
    const inside = (this.rnd() - 0.5) * GOAL_Z * 1.5;
    const outsideZ = Math.sign(this.rnd() - 0.5 || 1) * (GOAL_Z + 1.2 + this.rnd() * GOAL_Z * 1.6);
    const targetZ = outcome === "off" ? outsideZ : inside;
    const targetH = outcome === "off" && this.rnd() < 0.42 ? 3 + this.rnd() * 1.8 : 0.25 + this.rnd() * 1.8;
    const dx = dir * FIELD_X - holder.x;
    const dz = targetZ - holder.z;
    const d = Math.hypot(dx, dz) || 1;
    const power = 24 + holder.shooting / 100 * 13 + this.rnd() * 6;
    this.ball.vx = dx / d * power;
    this.ball.vz = dz / d * power;
    this.ball.height = 0.25;
    const flight = Math.max(0.15, d / power);
    this.ballVy = (targetH - 0.25) / flight + 4.905 * flight;
    this.ballSpin = (this.rnd() - 0.5) * (distGoal > 20 ? 7 : 3);
    this.pendingShot = {
      side,
      shooter: holder.id,
      outcome,
      fromX: holder.x,
      fromZ: holder.z,
      targetZ,
      xg,
      bigChance: xg > 0.25,
      bodyPart: "foot"
    };
    if (gk && outcome === "saved") {
      const dive = targetZ - gk.z;
      this.trigger(gk, Math.abs(dive) < 1.15 ? "save" : dive > 0 ? "diveRight" : "diveLeft", 1.15);
    }
    this.restartTimer = 0.35;
    if (outcome === "off") {
      if (this.rnd() < 0.22) this.lastTouch = side === "home" ? "away" : "home";
      this.recordShot({
        x: holder.x,
        z: holder.z,
        side,
        result: "off",
        minute: this.minute(),
        name: holder.name,
        xg,
        bigChance: xg > 0.25,
        bodyPart: "foot"
      });
      this.pushEvent({
        minute: this.minute(),
        type: "shot",
        side,
        text: `${holder.name} finaliza para fora.`
      });
    }
    this.synchronizeBallPhysics();
  }
  scheduleRestart(side) {
    const gk = this.players.find((p) => p.side === side && p.pos === "GK");
    if (!gk) return;
    this.ball.holder = gk.id;
    this.possession = side;
    this.lastTouch = side;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.height = 0.12;
    this.ballVy = 0;
    this.ballSpin = 0;
    this.pendingShot = null;
    this.pass = null;
    this.looseTime = 0;
    this.restartTimer = 1.5;
    this.decisionTimer = 1.2;
    this.trigger(gk, this.rnd() < 0.5 ? "goalKick" : "distribute", 1.1);
    this.synchronizeBallPhysics();
  }
  possessionPct() {
    const h = this.stats.home.possessionTicks;
    const a = this.stats.away.possessionTicks;
    const total = h + a || 1;
    return [Math.round(h / total * 100), Math.round(a / total * 100)];
  }
  /**
   * Gera contexto visual deterministico para todos os jogadores.
   *
   * Esta funcao nao afeta o estado da simulacao (placar, estatisticas, etc.)
   * e e usada apenas para alimentar o sistema visual com dados realistas.
   *
   * @returns Dados visuais versionados para gravar em replays
   */
  generateVisualContext() {
    const actionContexts = [];
    const contactContexts = [];
    for (const p of this.players) {
      const actionCtx = this.generatePlayerActionContext(p);
      actionContexts.push(actionCtx);
      const contactCtx = this.generatePlayerContactContext(p);
      contactContexts.push(contactCtx);
    }
    return {
      version: VISUAL_CONTEXT_VERSION,
      actionContexts,
      contactContexts,
      metadata: {
        simTime: this.time
      }
    };
  }
  /**
   * Gera ActionContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  generatePlayerActionContext(p) {
    if (!p.action) {
      return emptyActionContext();
    }
    const u = p.actionDur > 0 ? Math.min(1, p.actionT / p.actionDur) : 0;
    const phase = getActionPhase(1 - u);
    const dominantFoot = getDominantFoot(p.pid);
    const usedFoot = this.determineUsedFoot(p, dominantFoot);
    const target = this.determineActionTarget(p);
    const contactPoint = this.determineContactPoint(p);
    const direction = Math.atan2(p.vz, p.vx);
    const intensity = this.calculateActionIntensity(p);
    const result = p.actionT > 0 ? "success" : "none";
    const reaction = this.determineReaction(p, phase);
    return {
      action: p.action,
      actionT: p.actionT,
      actionDur: p.actionDur,
      phase,
      dominantFoot,
      usedFoot,
      target,
      contactPoint,
      direction,
      intensity,
      result,
      reaction
    };
  }
  /**
   * Determina qual pe usar para a acao.
   */
  determineUsedFoot(p, dominantFoot) {
    if (p.pos === "GK") {
      const ballDx = this.ball.x - p.x;
      return ballDx < 0 ? "left" : "right";
    }
    if (p.action && ["shot", "shotPower", "shotPlaced", "pass", "passLong", "cross"].includes(p.action)) {
      if (p.vx < -0.1) {
        return dominantFoot === "left" ? "right" : "left";
      }
      if (p.vx > 0.1) {
        return dominantFoot === "right" ? "left" : "right";
      }
    }
    return dominantFoot;
  }
  /**
   * Determina o alvo da acao.
   */
  determineActionTarget(p) {
    if (p.id === this.ball.holder) {
      if (p.action && ["shot", "shotPower", "shotPlaced"].includes(p.action)) {
        const sideDir = p.side === "home" ? 1 : -1;
        return { x: FIELD_X * sideDir, z: 0 };
      }
      if (p.action && ["pass", "passLong", "cross"].includes(p.action)) {
        const teammate = this.players.find(
          (t) => t.side === p.side && t.id !== p.id && t.pos !== "GK"
        );
        if (teammate) {
          return { x: teammate.x, z: teammate.z };
        }
      }
      if (p.vx !== 0 || p.vz !== 0) {
        return { x: p.x + p.vx * 2, z: p.z + p.vz * 2 };
      }
    }
    if (this.ball.holder) {
      const holder = this.players.find((pl) => pl.id === this.ball.holder);
      if (holder) {
        return { x: holder.x, z: holder.z };
      }
    }
    return { x: this.ball.x, z: this.ball.z };
  }
  /**
   * Determina o ponto de contato.
   */
  determineContactPoint(p) {
    if (p.action && ["trap", "header", "volley", "firstTime"].includes(p.action)) {
      return { x: this.ball.x, z: this.ball.z, height: this.ball.height };
    }
    if (p.action && ["shot", "shotPower", "shotPlaced", "pass", "cross"].includes(p.action)) {
      const footOffset = p.action && p.action.includes("shot") ? 0.3 : 0.15;
      const usedFoot = this.determineUsedFoot(p, getDominantFoot(p.pid));
      const footSign = usedFoot === "left" ? -1 : 1;
      return {
        x: p.x + footSign * footOffset,
        z: p.z,
        height: 0.1
      };
    }
    if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
      if (this.ball.holder) {
        const holder = this.players.find((pl) => pl.id === this.ball.holder);
        if (holder) {
          return { x: holder.x, z: holder.z, height: 0.5 };
        }
      }
      return { x: this.ball.x, z: this.ball.z, height: 0 };
    }
    return null;
  }
  /**
   * Calcula intensidade da acao.
   */
  calculateActionIntensity(p) {
    if (!p.action) return 0;
    if (["shot", "shotPower", "shotPlaced"].includes(p.action)) {
      return 0.8 + p.shooting / 100 * 0.2;
    }
    if (["tackle", "slide", "block"].includes(p.action)) {
      return 0.7 + p.defending / 100 * 0.2;
    }
    if (["pass", "passLong", "cross"].includes(p.action)) {
      return 0.6 + p.passing / 100 * 0.2;
    }
    if (["save", "saveHigh", "diveLeft", "diveRight"].includes(p.action)) {
      return 0.9;
    }
    return 0.5;
  }
  /**
   * Determina reacao baseada na fase.
   */
  determineReaction(p, phase) {
    if (phase === "action") {
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 5) return "balance";
      return "none";
    }
    if (phase === "contact") {
      if (p.action && ["tackle", "slide", "block", "intercept"].includes(p.action)) {
        return "push";
      }
      return "none";
    }
    if (phase === "followThrough") {
      return "recovery";
    }
    if (phase === "recovery") {
      return "balance";
    }
    return "none";
  }
  /**
   * Gera ContactContext para um jogador.
   * Deterministico: mesmas entradas produzem mesmas saidas.
   */
  generatePlayerContactContext(p) {
    const contactType = this.determineContactType(p);
    if (contactType === "none") {
      return emptyContactContext();
    }
    const groundFoot = this.determineGroundFoot(p);
    const force = this.calculateContactForce(p, contactType);
    const bodyPoint = this.determineBodyPoint(p, contactType);
    const contactPlayerId = this.determineContactPlayer(p);
    const relativeVelocity = this.calculateRelativeVelocity(p, contactPlayerId);
    return {
      type: contactType,
      groundFoot,
      force,
      bodyPoint,
      contactPlayerId,
      relativeVelocity
    };
  }
  /**
   * Determina tipo de contato.
   */
  determineContactType(p) {
    if (p.id === this.ball.holder) {
      return "ball";
    }
    if (this.ball.height > 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 3) {
        return "airBall";
      }
      return "none";
    }
    if (this.ball.height <= 0.5) {
      const distToBall = Math.hypot(p.x - this.ball.x, p.z - this.ball.z);
      if (distToBall < 1.5) {
        if (p.action && ["trap", "tackle", "intercept"].includes(p.action)) {
          return "groundBall";
        }
        return "ball";
      }
    }
    if (p.action && ["tackle", "slide"].includes(p.action)) {
      return "player";
    }
    return "ground";
  }
  /**
   * Determina qual pe esta em contato com o chao.
   */
  determineGroundFoot(p) {
    const seed = this.hashString(p.pid);
    const timeFactor = Math.floor(this.time * 10) % 100;
    const combined = (seed + timeFactor) % 100;
    if (p.vx !== 0 || p.vz !== 0) {
      return combined % 2 === 0 ? "right" : "left";
    }
    return null;
  }
  /**
   * Funcao hash simples para strings.
   */
  hashString(s) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = hash * 31 + s.charCodeAt(i) | 0;
    }
    return hash;
  }
  /**
   * Calcula forca do contato.
   */
  calculateContactForce(p, contactType) {
    if (contactType === "ball" || contactType === "groundBall") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 8);
    }
    if (contactType === "player") {
      return 0.8;
    }
    if (contactType === "ground") {
      const speed = Math.hypot(p.vx, p.vz);
      return Math.min(1, speed / 5);
    }
    return 0;
  }
  /**
   * Determina ponto do corpo em contato.
   */
  determineBodyPoint(p, contactType) {
    if (contactType === "ball" || contactType === "groundBall") {
      if (p.pos === "GK") {
        return (this.hashString(`${this.matchSeed}:${p.pid}`) & 1) === 0 ? "handLeft" : "handRight";
      }
      return this.determineUsedFoot(p, getDominantFoot(p.pid)) === "left" ? "footLeft" : "footRight";
    }
    if (contactType === "player") {
      if (p.action === "tackle") {
        return "shoulderRight";
      }
      if (p.action === "slide") {
        return "kneeRight";
      }
    }
    if (contactType === "ground") {
      const groundFoot = this.determineGroundFoot(p);
      if (groundFoot) {
        return groundFoot === "left" ? "footLeft" : "footRight";
      }
    }
    return null;
  }
  /**
   * Determina jogador em contato.
   */
  determineContactPlayer(p) {
    if (p.pos === "GK" && this.ball.height < 1) {
      const attacker = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2
      );
      if (attacker) return attacker.id;
    }
    if (p.action && ["tackle", "slide"].includes(p.action)) {
      const opponent = this.players.find(
        (t) => t.side !== p.side && Math.hypot(t.x - p.x, t.z - p.z) < 2
      );
      if (opponent) return opponent.id;
    }
    return null;
  }
  /**
   * Calcula velocidade relativa.
   */
  calculateRelativeVelocity(p, contactPlayerId) {
    if (!contactPlayerId) return null;
    const other = this.players.find((t) => t.id === contactPlayerId);
    if (!other) return null;
    return {
      vx: p.vx - other.vx,
      vz: p.vz - other.vz
    };
  }
};

// src/game/data/leagues-api.ts
var RAW = [
  {
    id: "x4635",
    name: "Faroe Islands Premier League",
    country: "Ilhas Faro\xE9",
    flag: "\u{1F1EB}\u{1F1F4}",
    clubs: [
      ["x4635_133965", "B36 T\xF3rshavn", "BTR", "#58a6cb", "#ffffff", 54],
      ["x4635_134026", "V\xEDkingur G\xF8ta", "VKI", "#a488fd", "#ffffff", 52],
      ["x4635_134065", "NS\xCD Runav\xEDk", "NSR", "#1e0a6d", "#ffffff", 52],
      ["x4635_134068", "EB/Streymur", "EBS", "#d8fc01", "#ffffff", 54],
      ["x4635_134336", "HB T\xF3rshavn", "HBT", "#0e767a", "#ffffff", 56],
      ["x4635_138051", "K\xCD Klaksv\xEDk", "KLA", "#7f7d47", "#ffffff", 54],
      ["x4635_138053", "AB Argir", "ABA", "#c8ee4c", "#ffffff", 51],
      ["x4635_138054", "Sk\xE1la", "SKL", "#a0280e", "#ffffff", 53],
      ["x4635_140518", "07 Vestur", "VES", "#5dfc2f", "#ffffff", 54],
      ["x4635_140519", "B68 Toftir", "BTO", "#a1354a", "#ffffff", 52]
    ]
  },
  {
    id: "x4618",
    name: "Andorran 1a Divisi\xF3",
    country: "Andorra",
    flag: "\u{1F1E6}\u{1F1E9}",
    clubs: [
      ["x4618_134346", "FC Santa Coloma", "FCS", "#a5c8c8", "#ffffff", 53],
      ["x4618_137790", "Atl\xE8tic d'Escaldes", "ATL", "#9e9741", "#ffffff", 58],
      ["x4618_137791", "Ordino", "ORD", "#a785a2", "#ffffff", 56],
      ["x4618_137792", "Inter Club d'Escaldes", "INT", "#7e79fb", "#ffffff", 51],
      ["x4618_137793", "Carroi", "CAR", "#663269", "#ffffff", 59],
      ["x4618_140126", "Penya Encarnada d'Andorra", "PEN", "#df0209", "#000000", 53],
      ["x4618_140684", "FC R\xE0nger's", "FCR", "#e120c6", "#ffffff", 56],
      ["x4618_146455", "Esperan\xE7a d'Andorra", "ESP", "#a1b18f", "#ffffff", 59],
      ["x4618_154390", "Sporting d'Escaldes", "SPO", "#320ba4", "#ffffff", 56],
      ["x4618_154392", "Casa de Portugal", "CAS", "#fa7fe6", "#ffffff", 56]
    ]
  },
  {
    id: "x4958",
    name: "Estonian Esiliiga",
    country: "Est\xF4nia",
    flag: "\u{1F1EA}\u{1F1EA}",
    clubs: [
      ["x4958_137978", "Tallinna Kalev", "TAL", "#df0caa", "#ffffff", 58],
      ["x4958_139052", "Maardu Linnameeskond", "MAA", "#de38c4", "#ffffff", 56],
      ["x4958_141132", "Elva", "ELV", "#463cf2", "#ffffff", 58],
      ["x4958_141133", "Levadia U21 Tallinn", "LEV", "#e7a617", "#ffffff", 57],
      ["x4958_141134", "Flora Tallinn U21", "FLO", "#949c64", "#ffffff", 61],
      ["x4958_141139", "Tartu Welco", "TAR", "#6f183e", "#ffffff", 62],
      ["x4958_145272", "Viimsi", "VII", "#23d59f", "#ffffff", 55],
      ["x4958_147100", "FC Tallinn", "FCT", "#631376", "#ffffff", 59],
      ["x4958_151524", "N\xF5mme Kalju U21", "NMM", "#1c2191", "#ffffff", 58],
      ["x4958_154668", "N\xF5mme United U21", "NMM", "#df6bab", "#ffffff", 58]
    ]
  },
  {
    id: "x5676",
    name: "Campeonato Acreano",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5676_142253", "Galvez", "GAL", "#9f258f", "#ffffff", 55],
      ["x5676_144958", "Rio Branco FC", "RIO", "#38a9e6", "#ffffff", 56],
      ["x5676_144967", "Humait\xE1", "HUM", "#4a1ff7", "#ffffff", 53],
      ["x5676_147153", "S\xE3o Francisco-AC", "SOF", "#16cf95", "#ffffff", 57],
      ["x5676_150120", "Independ\xEAncia", "IND", "#3645fd", "#ffffff", 56],
      ["x5676_152583", "ADESG", "ADE", "#6efee0", "#ffffff", 56],
      ["x5676_152585", "Vasco da Gama-AC", "VAS", "#bd7124", "#ffffff", 61],
      ["x5676_154106", "Santa Cruz-AC", "SAN", "#027af7", "#ffffff", 55]
    ]
  },
  {
    id: "x5678",
    name: "Campeonato Amapaense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5678_142300", "Ypiranga-AP", "YPI", "#d814dd", "#ffffff", 60],
      ["x5678_144963", "Trem", "TRE", "#f07054", "#ffffff", 59],
      ["x5678_150127", "Orat\xF3rio", "ORA", "#c3fbdf", "#ffffff", 58],
      ["x5678_152599", "Cristal", "CRI", "#9443e7", "#ffffff", 54],
      ["x5678_152600", "Independente-AP", "IND", "#d061cc", "#ffffff", 59],
      ["x5678_152602", "Santos-AP", "SAN", "#966035", "#ffffff", 58],
      ["x5678_154107", "Macap\xE1", "MAC", "#f4eec3", "#ffffff", 59],
      ["x5678_154162", "S\xE3o Jos\xE9-AP", "SOJ", "#9f656a", "#ffffff", 58]
    ]
  },
  {
    id: "x5685",
    name: "Campeonato Brasiliense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5685_139997", "Brasiliense", "BRA", "#f960be", "#ffffff", 56],
      ["x5685_142251", "Gama", "GAM", "#08c8e5", "#ffffff", 60],
      ["x5685_142565", "Real Bras\xEDlia", "REA", "#3dbe47", "#ffffff", 54],
      ["x5685_144960", "Ceil\xE2ndia", "CEI", "#cb890d", "#ffffff", 55],
      ["x5685_150114", "Capital CF", "CAP", "#53a62b", "#ffffff", 56],
      ["x5685_152610", "Parano\xE1", "PAR", "#006154", "#ffffff", 53],
      ["x5685_152611", "Sobradinho", "SOB", "#a8a5cd", "#ffffff", 55],
      ["x5685_152612", "Samambaia", "SAM", "#8b10ce", "#ffffff", 59],
      ["x5685_154126", "Bras\xEDlia", "BRA", "#e2b976", "#ffffff", 55],
      ["x5685_154127", "ARUC", "ARU", "#1b13da", "#ffffff", 54]
    ]
  },
  {
    id: "x5684",
    name: "Campeonato Baiano",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5684_137816", "Jacuipense", "JAC", "#ba31aa", "#ffffff", 59],
      ["x5684_142252", "Juazeirense", "JUA", "#3cfb0d", "#ffffff", 58],
      ["x5684_142268", "Bahia de Feira", "BAH", "#8b6f4d", "#ffffff", 61],
      ["x5684_142278", "Atl\xE9tico de Alagoinhas", "ATL", "#223493", "#ffffff", 57],
      ["x5684_150113", "Barcelona de Ilh\xE9us", "BAR", "#caf1f1", "#ffffff", 56],
      ["x5684_150122", "Jequi\xE9", "ADJ", "#a819d1", "#ffffff", 55],
      ["x5684_152607", "Porto SC", "POR", "#f240c3", "#ffffff", 56],
      ["x5684_154109", "Gal\xEDcia", "GAL", "#0b9148", "#ffffff", 53]
    ]
  },
  {
    id: "x5686",
    name: "Campeonato Capixaba",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5686_142286", "Rio Branco-ES", "RIO", "#28c19e", "#ffffff", 57],
      ["x5686_142293", "Rio Branco-VN", "RIO", "#bc06c7", "#ffffff", 53],
      ["x5686_144968", "Real Noroeste", "REA", "#4a0e9b", "#ffffff", 58],
      ["x5686_147154", "Vit\xF3ria-ES", "VIT", "#3f2a27", "#ffffff", 59],
      ["x5686_148214", "Serra", "SER", "#8718c4", "#ffffff", 61],
      ["x5686_150125", "Porto Vit\xF3ria", "POR", "#9cd177", "#ffffff", 56],
      ["x5686_152615", "Desportiva Ferrovi\xE1ria", "DES", "#dbe9f1", "#ffffff", 56],
      ["x5686_152616", "Capixaba", "CAP", "#7960c4", "#ffffff", 59],
      ["x5686_152617", "Vilavelhense", "VIL", "#a7a090", "#ffffff", 58],
      ["x5686_154128", "Forte", "FOR", "#c727ab", "#ffffff", 61]
    ]
  },
  {
    id: "x5762",
    name: "Campeonato Mato-Grossense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5762_134748", "Luverdense", "LUV", "#f8fa2a", "#ffffff", 57],
      ["x5762_136831", "Cuiab\xE1", "CUI", "#006637", "#fad700", 53],
      ["x5762_142267", "Uni\xE3o de Rondon\xF3polis", "UNI", "#f4dc75", "#ffffff", 61],
      ["x5762_142299", "Nova Mutum", "NOV", "#7135b8", "#ffffff", 55],
      ["x5762_144964", "Oper\xE1rio V\xE1rzea-Grandense", "OPE", "#0b930a", "#ffffff", 55],
      ["x5762_148209", "Mixto", "MIX", "#bfe2e1", "#ffffff", 57],
      ["x5762_152636", "Primavera", "PRI", "#92fd36", "#ffffff", 58],
      ["x5762_152637", "Sport Sinop", "SPO", "#46da53", "#ffffff", 59],
      ["x5762_154480", "V\xE1rzea Grande", "VRZ", "#21aff6", "#ffffff", 60],
      ["x5762_154481", "Chapada", "CHA", "#eb1872", "#ffffff", 58]
    ]
  },
  {
    id: "x5765",
    name: "Campeonato Paraibano",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5765_137819", "Treze", "TRE", "#88f0fa", "#ffffff", 60],
      ["x5765_142256", "Campinense", "CAM", "#9a786a", "#ffffff", 55],
      ["x5765_142274", "Sousa", "SOU", "#b3cffa", "#ffffff", 56],
      ["x5765_147316", "Nacional de Patos", "NAC", "#8a1124", "#ffffff", 58],
      ["x5765_152647", "Serra Branca", "SER", "#7c72d6", "#ffffff", 53],
      ["x5765_152648", "Esporte de Patos", "ESP", "#ee0438", "#ffffff", 55],
      ["x5765_152649", "Pombal", "POM", "#576386", "#ffffff", 53],
      ["x5765_154520", "Confian\xE7a-PB", "CON", "#5ee5bb", "#ffffff", 59],
      ["x5765_154521", "Atl\xE9tico Cajazeirense", "ATL", "#e7dc03", "#ffffff", 55]
    ]
  },
  {
    id: "x5764",
    name: "Campeonato Paraense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5764_142297", "Castanhal", "CAS", "#596823", "#ffffff", 58],
      ["x5764_144975", "Tuna Luso", "TUN", "#23368c", "#ffffff", 58],
      ["x5764_147141", "\xC1guia de Marab\xE1", "GUI", "#17a945", "#ffffff", 61],
      ["x5764_148202", "Camet\xE1", "CAM", "#dadc47", "#ffffff", 53],
      ["x5764_150129", "S\xE3o Francisco-PA", "SOF", "#c91caa", "#ffffff", 55],
      ["x5764_152644", "Capit\xE3o Po\xE7o", "CAP", "#eef729", "#ffffff", 54],
      ["x5764_152645", "Santa Rosa", "SAN", "#5f707e", "#ffffff", 56],
      ["x5764_152678", "Bragantino-PA", "BRA", "#6e990a", "#ffffff", 59],
      ["x5764_154483", "Amaz\xF4nia", "AMA", "#55ac2f", "#ffffff", 57],
      ["x5764_154484", "S\xE3o Raimundo-PA", "SOR", "#b3fed7", "#ffffff", 55]
    ]
  },
  {
    id: "x5766",
    name: "Campeonato Paranaense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5766_136829", "Oper\xE1rio Ferrovi\xE1rio", "OPE", "#6f1fd6", "#ffffff", 54],
      ["x5766_142243", "Cianorte", "CIA", "#4df0c0", "#ffffff", 56],
      ["x5766_142283", "FC Cascavel", "FCC", "#f53c6b", "#ffffff", 53],
      ["x5766_144970", "Azuriz", "AZU", "#f24176", "#ffffff", 60],
      ["x5766_147148", "Maring\xE1", "MAR", "#4b34cc", "#ffffff", 54],
      ["x5766_147312", "S\xE3o Joseense", "SOJ", "#56be61", "#ffffff", 53],
      ["x5766_152653", "Andraus", "AND", "#3b628b", "#ffffff", 60],
      ["x5766_154526", "Galo Maring\xE1", "GAL", "#e502d2", "#ffffff", 60],
      ["x5766_154527", "Foz do Igua\xE7u", "FOZ", "#c05e75", "#ffffff", 60]
    ]
  },
  {
    id: "x5769",
    name: "Campeonato Piauiense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5769_141179", "Altos", "ALT", "#fd15bb", "#ffffff", 55],
      ["x5769_144976", "Fluminense-PI", "FLU", "#9c36b1", "#ffffff", 61],
      ["x5769_147150", "Parnahyba", "PAR", "#1ef4f4", "#ffffff", 60],
      ["x5769_152659", "Atl\xE9tico Piauiense", "ATL", "#77cb7b", "#ffffff", 53],
      ["x5769_152660", "Piau\xED", "PIA", "#b25240", "#ffffff", 56],
      ["x5769_152661", "Oeirense", "OEI", "#f892a7", "#ffffff", 55],
      ["x5769_154532", "Corisabb\xE1", "COR", "#560ce7", "#ffffff", 53],
      ["x5769_154533", "Teresina", "TER", "#b95fcc", "#ffffff", 57]
    ]
  },
  {
    id: "x5773",
    name: "Campeonato Sergipano",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5773_142254", "Itabaiana", "ITA", "#146e77", "#ffffff", 53],
      ["x5773_142261", "Sergipe", "SER", "#203277", "#ffffff", 54],
      ["x5773_144965", "Lagarto", "LAG", "#b5cf67", "#ffffff", 59],
      ["x5773_147146", "Falcon", "FAL", "#417d56", "#ffffff", 54],
      ["x5773_152676", "Am\xE9rica de Propri\xE1", "AMR", "#c88372", "#ffffff", 59],
      ["x5773_152677", "Guarany", "GUA", "#255d29", "#ffffff", 60],
      ["x5773_152679", "Dorense", "DOR", "#c23fe4", "#ffffff", 60],
      ["x5773_154129", "Atl\xE9tico Gloriense", "ATL", "#466dbe", "#ffffff", 57],
      ["x5773_154130", "Desportiva Aracaju", "DES", "#4c13a3", "#ffffff", 59]
    ]
  },
  {
    id: "x5772",
    name: "Campeonato Roraimense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5772_142250", "S\xE3o Raimundo", "SOR", "#441fc3", "#ffffff", 59],
      ["x5772_142292", "GAS", "GAS", "#73173e", "#ffffff", 53],
      ["x5772_145390", "N\xE1utico-RR", "NUT", "#69921a", "#ffffff", 61],
      ["x5772_152671", "Bar\xE9", "BAR", "#6dc1f6", "#ffffff", 59],
      ["x5772_152672", "Monte Roraima", "MON", "#691a44", "#ffffff", 55],
      ["x5772_152673", "Rio Negro-RR", "RIO", "#dbd0d8", "#ffffff", 54],
      ["x5772_152674", "Atl\xE9tico Roraima", "ATL", "#afc27d", "#ffffff", 56],
      ["x5772_152675", "Progresso", "PRO", "#f3a27a", "#ffffff", 61],
      ["x5772_154531", "River-RR", "RIV", "#8b078f", "#ffffff", 59]
    ]
  },
  {
    id: "x5774",
    name: "Campeonato Sul-Mato-Grossense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5774_142281", "\xC1guia Negra", "GUI", "#81b5cd", "#ffffff", 53],
      ["x5774_144972", "Costa Rica-MS", "COS", "#ac5ecd", "#ffffff", 61],
      ["x5774_147149", "Oper\xE1rio de Campo Grande", "OPE", "#b6ddce", "#ffffff", 61],
      ["x5774_150128", "Dourados", "DAC", "#9360c7", "#ffffff", 57],
      ["x5774_152682", "Ivinhema", "IVI", "#ac3162", "#ffffff", 58],
      ["x5774_152683", "Pantanal", "PAN", "#aec951", "#ffffff", 54],
      ["x5774_152685", "Naviraiense", "NAV", "#1c0997", "#ffffff", 60],
      ["x5774_152686", "Corumbaense", "COR", "#a94285", "#ffffff", 54],
      ["x5774_154537", "Aquidauana", "CRA", "#124d81", "#ffffff", 56],
      ["x5774_154538", "Bataguassu", "AAB", "#660f08", "#ffffff", 54]
    ]
  },
  {
    id: "x5775",
    name: "Campeonato Tocantinense",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["x5775_142259", "Palmas Futebol e Regatas", "PAL", "#2b12c0", "#ffffff", 53],
      ["x5775_142276", "Tocantin\xF3polis", "TOC", "#92a763", "#ffffff", 56],
      ["x5775_148203", "Capital", "CAP", "#d35c78", "#ffffff", 58],
      ["x5775_150126", "Uni\xE3o", "UNI", "#706e26", "#ffffff", 56],
      ["x5775_152688", "Aragua\xEDna", "ARA", "#3f25e0", "#ffffff", 56],
      ["x5775_152689", "Gurupi", "GUR", "#16a859", "#ffffff", 61],
      ["x5775_152690", "Bela Vista", "BEL", "#d0bc3a", "#ffffff", 59],
      ["x5775_154539", "Guara\xED", "GUA", "#fd9500", "#ffffff", 61]
    ]
  },
  {
    id: "x4396",
    name: "English League 1",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["x4396_133607", "Wigan Athletic", "WIG", "#1d59af", "#ffffff", 56],
      ["x4396_133618", "Blackpool", "BLK", "#ff5f00", "#ffffff", 61],
      ["x4396_133620", "Doncaster Rovers", "DNR", "#ed171f", "#ffffff", 60],
      ["x4396_133630", "Barnsley", "BRS", "#7363f7", "#ffffff", 62],
      ["x4396_133631", "Peterborough United", "PTU", "#d69f65", "#ffffff", 55],
      ["x4396_133633", "Reading", "RDG", "#004494", "#ffffff", 62],
      ["x4396_133932", "Huddersfield Town", "HDD", "#0e63ad", "#ffffff", 59],
      ["x4396_134189", "Bradford City", "BDC", "#2575a1", "#ffffff", 55],
      ["x4396_134241", "AFC Wimbledon", "AWM", "#791a55", "#ffffff", 62],
      ["x4396_134258", "Stockport County", "STO", "#4e9ba7", "#ffffff", 60],
      ["x4396_134367", "Leyton Orient", "LEY", "#2ccec5", "#ffffff", 57],
      ["x4396_134371", "Milton Keynes Dons", "MKD", "#88dda7", "#ffffff", 62],
      ["x4396_134373", "Notts County", "NTC", "#62a4fa", "#ffffff", 56],
      ["x4396_134376", "Burton Albion", "BRA", "#fbf335", "#ffffff", 58],
      ["x4396_134378", "Stevenage", "STV", "#6d79ca", "#ffffff", 57],
      ["x4396_134381", "Mansfield Town", "MSF", "#eb1a6a", "#ffffff", 56],
      ["x4396_134382", "Wycombe Wanderers", "WYC", "#a5e399", "#ffffff", 60],
      ["x4396_134586", "Cambridge United", "CMU", "#bbf759", "#ffffff", 61],
      ["x4396_136033", "Bromley", "BRO", "#ffffff", "#161412", 57]
    ]
  },
  {
    id: "x4397",
    name: "English League 2",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["x4397_133874", "Colchester United", "CLU", "#faf512", "#ffffff", 61],
      ["x4397_134185", "Oldham Athletic", "OLD", "#25d2dd", "#ffffff", 61],
      ["x4397_134218", "Crewe Alexandra", "CAX", "#3024c2", "#ffffff", 60],
      ["x4397_134230", "Gillingham", "GLG", "#ef0a47", "#ffffff", 54],
      ["x4397_134231", "Rotherham United", "RTU", "#e21d25", "#ffffff", 55],
      ["x4397_134240", "Walsall", "WSL", "#75a78f", "#ffffff", 59],
      ["x4397_134250", "Grimsby Town", "GBT", "#f783c5", "#ffffff", 61],
      ["x4397_134267", "Tranmere Rovers", "TRR", "#158248", "#ffffff", 56],
      ["x4397_134357", "Newport County", "MPT", "#4ee147", "#ffffff", 55],
      ["x4397_134358", "Bristol Rovers", "BRR", "#6ed529", "#ffffff", 57],
      ["x4397_134362", "Cheltenham Town", "CTT", "#7ed8c5", "#ffffff", 56],
      ["x4397_134363", "Crawley Town", "CRT", "#87382a", "#ffffff", 56],
      ["x4397_134364", "Rochdale", "RCH", "#5d05b2", "#ffffff", 61],
      ["x4397_134365", "Exeter City", "EXE", "#633183", "#ffffff", 59],
      ["x4397_134366", "Chesterfield", "CHE", "#004890", "#ffffff", 57],
      ["x4397_134368", "Accrington Stanley", "ACC", "#4c1e6f", "#ffffff", 55],
      ["x4397_134370", "Northampton Town", "NHT", "#80a9e1", "#ffffff", 55],
      ["x4397_134374", "Fleetwood Town", "FLT", "#6e5969", "#ffffff", 59],
      ["x4397_134375", "Port Vale", "PTV", "#635fa8", "#ffffff", 56],
      ["x4397_134377", "Shrewsbury Town", "SHT", "#649478", "#ffffff", 57],
      ["x4397_134379", "Swindon Town", "SWI", "#bd9d9c", "#ffffff", 58],
      ["x4397_134383", "York City", "YOR", "#af623c", "#ffffff", 55],
      ["x4397_134402", "Barnet", "BAR", "#ff7700", "#ffffff", 56],
      ["x4397_135958", "Salford City", "SAL", "#fe5900", "#000000", 56]
    ]
  },
  {
    id: "x5086",
    name: "Spanish Primera Federaci\xF3n Group 1",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["x5086_134697", "Ponferradina", "PON", "#f03438", "#ffffff", 67],
      ["x5086_134702", "Lugo", "LUG", "#f860c1", "#ffffff", 63],
      ["x5086_135456", "Athletic Bilbao B", "ATH", "#562c40", "#ffffff", 60],
      ["x5086_135888", "Cultural Leonesa", "CUL", "#b9f3a5", "#ffffff", 66],
      ["x5086_137591", "UD Logro\xF1\xE9s", "UDL", "#2be9f3", "#ffffff", 63],
      ["x5086_137745", "Zamora", "ZAM", "#ab51f2", "#ffffff", 68],
      ["x5086_137758", "Unionistas de Salamanca", "UNI", "#58e10a", "#ffffff", 68],
      ["x5086_137760", "Cacere\xF1o", "CAC", "#753fba", "#ffffff", 63],
      ["x5086_137761", "M\xE9rida", "MRI", "#c20ffd", "#ffffff", 65],
      ["x5086_137764", "Barakaldo", "BAR", "#041afb", "#ffffff", 64],
      ["x5086_137822", "Pontevedra", "PON", "#021165", "#ffffff", 63],
      ["x5086_137827", "Racing Club de Ferrol", "RAC", "#a05f0a", "#ffffff", 67],
      ["x5086_138243", "Real Uni\xF3n", "REA", "#37fdf2", "#ffffff", 65],
      ["x5086_138250", "Arenas Club", "ARE", "#d4be79", "#ffffff", 63],
      ["x5086_142543", "CD Coria", "CDC", "#0d5b05", "#ffffff", 66],
      ["x5086_144214", "Real Avil\xE9s Industrial", "REA", "#c971f6", "#ffffff", 61],
      ["x5086_147597", "Deportivo Fabril", "DEP", "#0062f5", "#ffffff", 66],
      ["x5086_150250", "UD Ourense", "UDO", "#693772", "#ffffff", 66],
      ["x5086_150519", "Extremadura", "EXT", "#45cb5e", "#ffffff", 65]
    ]
  },
  {
    id: "x5087",
    name: "Spanish Segunda Federaci\xF3n Group 1",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["x5087_137746", "Portugalete", "POR", "#a9994c", "#ffffff", 55],
      ["x5087_137753", "Sestao River", "SES", "#3481ca", "#ffffff", 59],
      ["x5087_137804", "Marino de Luanco", "MAR", "#255b07", "#ffffff", 58],
      ["x5087_137824", "Coruxo", "COR", "#49597e", "#ffffff", 56],
      ["x5087_137845", "Real Oviedo Vetusta", "REA", "#a4109a", "#ffffff", 56],
      ["x5087_138162", "Amorebieta", "AMO", "#8ffdba", "#ffffff", 61],
      ["x5087_138244", "Deportivo Alav\xE9s B", "DEP", "#ab658d", "#ffffff", 56],
      ["x5087_140490", "Compostela", "COM", "#aab14e", "#ffffff", 59],
      ["x5087_140528", "Ourense CF", "OUR", "#36054f", "#ffffff", 57],
      ["x5087_142535", "Gimn\xE1stica de Torrelavega", "GIM", "#7b9d8b", "#ffffff", 60],
      ["x5087_142538", "Llanera", "LLA", "#78f30d", "#ffffff", 61],
      ["x5087_144210", "Berganti\xF1os", "BER", "#8c487e", "#ffffff", 59],
      ["x5087_144212", "Arosa", "ARO", "#3bccb9", "#ffffff", 62],
      ["x5087_144219", "Gernika", "GER", "#47ff3c", "#ffffff", 55],
      ["x5087_144221", "Rayo Cantabria", "RAY", "#1facad", "#ffffff", 58],
      ["x5087_144988", "Basconia", "BAS", "#db9b82", "#ffffff", 61],
      ["x5087_149456", "Eibar B", "EIB", "#3d694e", "#ffffff", 56],
      ["x5087_150365", "Atl\xE9tico Astorga", "ATL", "#e038ad", "#ffffff", 61]
    ]
  },
  {
    id: "x4398",
    name: "Italian Serie C Girone C",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["x4398_133671", "Catania", "CAT", "#d9ef7b", "#ffffff", 58],
      ["x4398_133693", "Crotone", "CRO", "#23ddb2", "#ffffff", 62],
      ["x4398_134680", "Casertana", "CAS", "#a78107", "#ffffff", 60],
      ["x4398_134682", "Foggia", "FOG", "#e53da8", "#ffffff", 54],
      ["x4398_134686", "Barletta", "BAR", "#d066f2", "#ffffff", 61],
      ["x4398_134687", "Savoia", "SAV", "#11b8d3", "#ffffff", 59],
      ["x4398_135956", "Monopoli", "MON", "#e17135", "#ffffff", 55],
      ["x4398_137257", "Potenza", "POT", "#3168a9", "#ffffff", 57],
      ["x4398_137258", "Cavese", "CAV", "#a890b0", "#ffffff", 61],
      ["x4398_137451", "Picerno", "PIC", "#4c8551", "#ffffff", 57],
      ["x4398_140300", "Casarano", "CAS", "#28ebf0", "#ffffff", 61],
      ["x4398_143030", "Sorrento", "SOR", "#26d6b6", "#ffffff", 61],
      ["x4398_143032", "Audace Cerignola", "AUD", "#12c033", "#ffffff", 61],
      ["x4398_143039", "Team Altamura", "TEA", "#2f7d77", "#ffffff", 61],
      ["x4398_143046", "Giugliano", "GIU", "#ace7d7", "#ffffff", 61],
      ["x4398_149264", "Scafatese", "SCA", "#470e9a", "#ffffff", 56],
      ["x4398_152840", "Inter Milan U23", "INT", "#8a8209", "#ffffff", 54]
    ]
  },
  {
    id: "x4645",
    name: "Italy Serie D Girone D",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["x4645_134260", "Pistoiese", "PIS", "#f5f768", "#ffffff", 55],
      ["x4645_134657", "Pavia", "PAV", "#5249ec", "#ffffff", 62],
      ["x4645_134658", "Pro Patria", "PRO", "#8b8739", "#ffffff", 55],
      ["x4645_134675", "Pontedera", "PON", "#1e2b28", "#ffffff", 62],
      ["x4645_140292", "Pro Sesto", "PRO", "#183d8d", "#ffffff", 57],
      ["x4645_142934", "Arconatese", "ARC", "#67950c", "#ffffff", 62],
      ["x4645_142938", "Castellanzese", "CAS", "#c1e088", "#ffffff", 60],
      ["x4645_142972", "Correggese", "COR", "#2d331e", "#ffffff", 61],
      ["x4645_142973", "Crema", "CRE", "#41a028", "#ffffff", 55],
      ["x4645_142976", "Lentigione", "LEN", "#eb8e4a", "#ffffff", 60],
      ["x4645_143888", "Varese", "VAR", "#5fe4d6", "#ffffff", 59],
      ["x4645_143897", "Casatese Merate", "CAS", "#b14947", "#ffffff", 58],
      ["x4645_146931", "Varesina", "VAR", "#cb245e", "#ffffff", 61],
      ["x4645_146937", "Sant'Angelo", "SAN", "#834442", "#ffffff", 57],
      ["x4645_149233", "Oltrep\xF2", "OLT", "#cd25b5", "#ffffff", 57],
      ["x4645_149242", "Cittadella Vis Modena", "CIT", "#63082e", "#ffffff", 61],
      ["x4645_153110", "Tropical Coriano", "TRO", "#85db6e", "#ffffff", 60],
      ["x4645_156652", "Solbiatese", "SOL", "#452f4c", "#ffffff", 60]
    ]
  },
  {
    id: "x4639",
    name: "Germany Liga 3",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["x4639_133877", "Duisburg", "DUI", "#acd04c", "#ffffff", 59],
      ["x4639_134210", "Alemannia Aachen", "ALE", "#1b3192", "#ffffff", 55],
      ["x4639_134694", "Ingolstadt", "ING", "#556d98", "#ffffff", 54],
      ["x4639_135656", "W\xFCrzburger Kickers", "WRZ", "#3c05e6", "#ffffff", 62],
      ["x4639_136026", "Jahn Regensburg", "JAH", "#a48353", "#ffffff", 56],
      ["x4639_137111", "Wehen Wiesbaden", "WEH", "#2a9153", "#ffffff", 60],
      ["x4639_137958", "Sonnenhof Gro\xDFaspach", "SON", "#ac3e8c", "#ffffff", 57],
      ["x4639_137961", "Viktoria K\xF6ln", "VIK", "#fe51e3", "#ffffff", 58],
      ["x4639_137962", "Waldhof Mannheim", "WAL", "#cf70ff", "#ffffff", 62],
      ["x4639_137963", "Meppen", "MEP", "#71120e", "#ffffff", 56],
      ["x4639_138365", "Hoffenheim II", "HOF", "#3a8f00", "#ffffff", 57],
      ["x4639_138375", "Havelse", "HAV", "#081f52", "#ffffff", 61],
      ["x4639_138399", "Verl", "VER", "#9f89d9", "#ffffff", 62],
      ["x4639_138400", "Rot-Weiss Essen", "ROT", "#143c07", "#ffffff", 54],
      ["x4639_138402", "Fortuna K\xF6ln", "FOR", "#9d205b", "#ffffff", 57],
      ["x4639_138410", "Saarbr\xFCcken", "SAA", "#9e0cfe", "#ffffff", 56],
      ["x4639_140052", "Stuttgart II", "STU", "#875e7f", "#ffffff", 62]
    ]
  },
  {
    id: "x4637",
    name: "French Ligue 3",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["x4637_133706", "Valenciennes", "VAL", "#545ac0", "#ffffff", 59],
      ["x4637_134712", "Orl\xE9ans", "ORL", "#f4acde", "#ffffff", 54],
      ["x4637_134787", "Caen", "CAE", "#64f3e8", "#ffffff", 60],
      ["x4637_135466", "Bourg-P\xE9ronnas", "BOU", "#b818bb", "#ffffff", 57],
      ["x4637_135890", "Quevilly-Rouen M\xE9tropole", "QUE", "#ad6cf2", "#ffffff", 59],
      ["x4637_137672", "Versailles", "VER", "#050b32", "#ffffff", 61],
      ["x4637_138067", "Rouen", "ROU", "#a091e9", "#ffffff", 59],
      ["x4637_138458", "Le Puy-en-Velay", "LEP", "#1183d1", "#ffffff", 57],
      ["x4637_138459", "Concarneau", "CON", "#4f7d70", "#ffffff", 62],
      ["x4637_138823", "Villefranche Beaujolais", "VIL", "#379c6c", "#ffffff", 58],
      ["x4637_140033", "Cannes", "CAN", "#17ad69", "#ffffff", 57],
      ["x4637_142604", "Fleury", "FLE", "#924319", "#ffffff", 60],
      ["x4637_142640", "Aubagne Air Bel", "AUB", "#6f68e6", "#ffffff", 56],
      ["x4637_144769", "VFC La Roche-sur-Yon", "VFC", "#0743cb", "#ffffff", 62],
      ["x4637_146312", "Paris 13 Atletico", "PAR", "#27fe00", "#262d35", 57],
      ["x4637_147875", "Thionville Lusitanos", "THI", "#d98850", "#ffffff", 58]
    ]
  },
  {
    id: "x5203",
    name: "French Premi\xE8re Ligue",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["x5203_143575", "Paris Saint-Germain Women", "PAR", "#004170", "#ffffff", 63],
      ["x5203_143579", "OL Lyonnes", "OLL", "#1949ea", "#ffffff", 61],
      ["x5203_143580", "Montpellier Women", "MON", "#5e2943", "#ffffff", 65],
      ["x5203_143581", "Paris FC Women", "PAR", "#d91118", "#ffffff", 61],
      ["x5203_143582", "Fleury Women", "FLE", "#e821a3", "#ffffff", 63],
      ["x5203_143583", "Dijon Women", "DIJ", "#3e3abc", "#ffffff", 65],
      ["x5203_146758", "Le Havre Women", "LEH", "#b37fa9", "#ffffff", 61],
      ["x5203_148672", "Marseille F\xE9minin", "MAR", "#24e897", "#ffffff", 68],
      ["x5203_149044", "Nantes Women", "NAN", "#3ca85d", "#ffffff", 63],
      ["x5203_149045", "Strasbourg Women", "STR", "#8e9329", "#ffffff", 66],
      ["x5203_156150", "Saint-Malo F\xE9minines", "SAI", "#00b255", "#ffffff", 68],
      ["x5203_156151", "Toulouse F\xE9minines", "TOU", "#0cb62b", "#ffffff", 66]
    ]
  },
  {
    id: "x5216",
    name: "Portugal Liga 3",
    country: "Portugal",
    flag: "\u{1F1F5}\u{1F1F9}",
    clubs: [
      ["x5216_138855", "Sporting da Covilh\xE3", "SPO", "#8bafce", "#ffffff", 54],
      ["x5216_138857", "Varzim", "VAR", "#8766eb", "#ffffff", 59],
      ["x5216_142466", "Trofense", "TRO", "#c49d81", "#ffffff", 59],
      ["x5216_143708", "Caldas", "CAL", "#0669f0", "#ffffff", 61],
      ["x5216_143709", "Fafe", "FAF", "#ea5efb", "#ffffff", 57],
      ["x5216_143718", "S\xE3o Jo\xE3o de Ver", "SOJ", "#b6443c", "#ffffff", 59],
      ["x5216_143721", "Uni\xE3o de Santar\xE9m", "UNI", "#12327e", "#ffffff", 58],
      ["x5216_143722", "Vit\xF3ria de Guimar\xE3es B", "VIT", "#a79259", "#ffffff", 57],
      ["x5216_144723", "Le\xE7a", "LEA", "#8a921e", "#ffffff", 58],
      ["x5216_144724", "Paredes", "PAR", "#568740", "#ffffff", 55],
      ["x5216_146666", "Os Belenenses", "OSB", "#0b7450", "#ffffff", 59],
      ["x5216_147544", "Vianense", "VIA", "#5e7b3d", "#ffffff", 57],
      ["x5216_147546", "Atl\xE9tico CP", "ATL", "#032003", "#ffffff", 59],
      ["x5216_149998", "Marco 09", "MAR", "#915502", "#ffffff", 62],
      ["x5216_150018", "Louletano", "LOU", "#8859dd", "#ffffff", 57],
      ["x5216_150021", "Lusitano de \xC9vora", "LUS", "#41f6d6", "#ffffff", 62],
      ["x5216_153019", "Vit\xF3ria de Sernache", "VIT", "#f9be2f", "#ffffff", 57]
    ]
  },
  {
    id: "x5745",
    name: "Campeonato de Portugal Serie A",
    country: "Portugal",
    flag: "\u{1F1F5}\u{1F1F9}",
    clubs: [
      ["x5745_143707", "Braga B", "BRA", "#c9deb7", "#ffffff", 56],
      ["x5745_143712", "Montalegre", "MON", "#b81648", "#ffffff", 55],
      ["x5745_149982", "Bragan\xE7a", "BRA", "#f039b8", "#ffffff", 58],
      ["x5745_149983", "Brito", "BRI", "#b1c6cf", "#ffffff", 58],
      ["x5745_149986", "Os Limianos", "OSL", "#f2c9e8", "#ffffff", 55],
      ["x5745_149988", "Rebordosa", "REB", "#d27bbc", "#ffffff", 62],
      ["x5745_149989", "Tirsense", "TIR", "#87ce34", "#ffffff", 59],
      ["x5745_150092", "Maria da Fonte", "MAR", "#23817e", "#ffffff", 54],
      ["x5745_150095", "Vinhais", "VIN", "#f709ad", "#ffffff", 62],
      ["x5745_150985", "Maia Lidador", "MAI", "#025438", "#ffffff", 60],
      ["x5745_153009", "CD Celoricense", "CDC", "#f15373", "#ffffff", 61],
      ["x5745_153016", "Vila Me\xE3", "VIL", "#c6c8f5", "#ffffff", 61],
      ["x5745_153710", "Chaves B", "CHA", "#d0ef2e", "#ffffff", 60],
      ["x5745_156364", "Ponte da Barca", "PON", "#00a670", "#ffffff", 59]
    ]
  },
  {
    id: "x5215",
    name: "Argentina Primera B Metropolitana",
    country: "Argentina",
    flag: "\u{1F1E6}\u{1F1F7}",
    clubs: [
      ["x5215_135152", "Arsenal de Sarand\xED", "ARS", "#b88de5", "#ffffff", 61],
      ["x5215_137780", "Brown de Adrogu\xE9", "BRO", "#e35767", "#ffffff", 58],
      ["x5215_137785", "Villa D\xE1lmine", "VIL", "#97d6ea", "#ffffff", 54],
      ["x5215_140806", "Laferrere", "LAF", "#60fb2f", "#ffffff", 62],
      ["x5215_142478", "Talleres de Remedios de Escalada", "TAL", "#840d7b", "#ffffff", 56],
      ["x5215_142492", "Real Pilar", "REA", "#354744", "#ffffff", 61],
      ["x5215_142495", "Dock Sud", "DOC", "#fd22f7", "#ffffff", 58],
      ["x5215_142497", "Deportivo Camioneros", "DEP", "#7fc659", "#ffffff", 56],
      ["x5215_142501", "Club Comunicaciones", "CLU", "#cb0e73", "#ffffff", 62],
      ["x5215_142503", "Villa San Carlos", "VIL", "#779b3d", "#ffffff", 56],
      ["x5215_142505", "Liniers", "LIN", "#efcdb4", "#ffffff", 58],
      ["x5215_143086", "Flandria", "FLA", "#c3b13a", "#ffffff", 58],
      ["x5215_143089", "Defensores Unidos", "DEF", "#6a2765", "#ffffff", 60],
      ["x5215_143090", "UAI Urquiza", "UAI", "#785ef6", "#ffffff", 62],
      ["x5215_143092", "Deportivo Armenio", "DEP", "#012999", "#ffffff", 55],
      ["x5215_143094", "Argentino de Quilmes", "ARG", "#5a115a", "#ffffff", 60],
      ["x5215_143097", "Deportivo Merlo", "DEP", "#8844c8", "#ffffff", 61],
      ["x5215_144740", "Ituzaing\xF3", "ITU", "#3f1147", "#ffffff", 60],
      ["x5215_147063", "Argentino de Merlo", "ARG", "#3d7a27", "#ffffff", 60],
      ["x5215_149540", "San Mart\xEDn de Burzaco", "SAN", "#8e5210", "#ffffff", 60],
      ["x5215_149542", "Excursionistas", "EXC", "#60e205", "#ffffff", 56],
      ["x5215_150259", "Sportivo Italiano", "SPO", "#208adb", "#ffffff", 57]
    ]
  },
  {
    id: "x4623",
    name: "Belgian Challenger Pro League",
    country: "B\xE9lgica",
    flag: "\u{1F1E7}\u{1F1EA}",
    clubs: [
      ["x4623_133785", "Lokeren", "LOK", "#0f67e4", "#ffffff", 58],
      ["x4623_133825", "Eupen", "EUP", "#000000", "#ffffff", 62],
      ["x4623_138140", "Virton", "VIR", "#dc7a9c", "#ffffff", 55],
      ["x4623_140081", "Seraing", "SER", "#cbda83", "#ffffff", 55],
      ["x4623_140109", "Lierse", "LIE", "#befde9", "#ffffff", 57],
      ["x4623_140110", "Club NXT", "CLU", "#fc16a6", "#ffffff", 59],
      ["x4623_143872", "RFC Li\xE8ge", "RFC", "#47a290", "#ffffff", 57],
      ["x4623_146374", "RSCA Futures", "RSC", "#92688a", "#ffffff", 61],
      ["x4623_146375", "Jong Genk", "JON", "#f907dc", "#ffffff", 62],
      ["x4623_147429", "Francs Borains", "FRA", "#de8f32", "#ffffff", 56],
      ["x4623_147430", "Patro Eisden", "PAT", "#aa113a", "#ffffff", 62],
      ["x4623_152466", "Jong Gent", "JON", "#91ded7", "#ffffff", 62],
      ["x4623_154878", "Sporting Hasselt", "SPO", "#25bcd1", "#ffffff", 62]
    ]
  },
  {
    id: "x4669",
    name: "Scottish League 1",
    country: "Esc\xF3cia",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    clubs: [
      ["x4669_133812", "Hamilton Academical", "HAM", "#3fbde9", "#ffffff", 57],
      ["x4669_134252", "Alloa Athletic", "ALL", "#16b5ee", "#ffffff", 56],
      ["x4669_134305", "Queen of the South", "QUE", "#f022b8", "#ffffff", 54],
      ["x4669_134466", "East Fife", "EAS", "#3f62b0", "#ffffff", 54],
      ["x4669_134632", "Peterhead", "PET", "#f9fb4e", "#ffffff", 58],
      ["x4669_137823", "Montrose", "MON", "#4553a6", "#ffffff", 60],
      ["x4669_138100", "Cove Rangers", "COV", "#0258ad", "#ffffff", 57],
      ["x4669_141804", "East Kilbride", "EKFC", "#003463", "#a7873f", 61]
    ]
  },
  {
    id: "x4670",
    name: "Scottish League 2",
    country: "Esc\xF3cia",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    clubs: [
      ["x4670_134130", "Dumbarton", "DUM", "#b4634e", "#ffffff", 62],
      ["x4670_134137", "Clyde", "CLY", "#a7e1a9", "#ffffff", 61],
      ["x4670_134220", "Stranraer", "STR", "#e32a31", "#ffffff", 55],
      ["x4670_134468", "Forfar Athletic", "FOR", "#138812", "#ffffff", 61],
      ["x4670_138099", "Annan Athletic", "ANN", "#a81398", "#ffffff", 55],
      ["x4670_138101", "Edinburgh City", "EDI", "#9b9e15", "#ffffff", 61],
      ["x4670_138102", "Elgin City", "ELG", "#638a43", "#ffffff", 61],
      ["x4670_138104", "Stirling Albion", "STI", "#6d84ae", "#ffffff", 58],
      ["x4670_140311", "Kelty Hearts", "KEL", "#f47a5a", "#ffffff", 54],
      ["x4670_142339", "The Spartans", "THE", "#9b5d7e", "#ffffff", 60]
    ]
  },
  {
    id: "x5868",
    name: "Turkish 3 Lig Group 1",
    country: "Turquia",
    flag: "\u{1F1F9}\u{1F1F7}",
    clubs: [
      ["x5868_138956", "Zonguldakspor", "ZON", "#a3a545", "#ffffff", 54],
      ["x5868_138976", "Beykoz Anadolu", "BEY", "#f82a95", "#ffffff", 56],
      ["x5868_143381", "Pazarspor", "PAZ", "#db8e64", "#ffffff", 55],
      ["x5868_146460", "D\xFCzcespor", "DZC", "#12119a", "#ffffff", 58],
      ["x5868_149622", "Silivrispor", "SIL", "#cf122b", "#ffffff", 62],
      ["x5868_149626", "Tokat Belediyespor", "TOK", "#19910a", "#ffffff", 61],
      ["x5868_149635", "Orduspor 1967", "ORD", "#209c84", "#ffffff", 58],
      ["x5868_149640", "K\xFC\xE7\xFCk\xE7ekmece Sinopspor", "KKE", "#be283a", "#ffffff", 59],
      ["x5868_149641", "Fatsa Belediyespor", "FAT", "#9502b8", "#ffffff", 59],
      ["x5868_149642", "Karab\xFCk \u0130dman Yurdu", "KAR", "#e38695", "#ffffff", 62],
      ["x5868_149643", "Amasyaspor", "AMA", "#f7c275", "#ffffff", 57],
      ["x5868_149646", "Bulvarspor", "BUL", "#ca9295", "#ffffff", 61],
      ["x5868_149665", "Beykoz \u0130shakl\u0131spor Faaliyetleri", "BEY", "#300b31", "#ffffff", 60],
      ["x5868_149682", "Yalova FK 77", "YAL", "#b19311", "#ffffff", 54],
      ["x5868_153064", "Karadeniz Ere\u011Fli Belediyespor", "KAR", "#0c53e7", "#ffffff", 62],
      ["x5868_153065", "\u0130nk\u0131lap", "NKL", "#ca5446", "#ffffff", 61],
      ["x5868_153067", "Galata", "GAL", "#1dcf29", "#ffffff", 61],
      ["x5868_156259", "G\xF6lc\xFCkspor", "GLC", "#35100c", "#ffffff", 55]
    ]
  },
  {
    id: "x5869",
    name: "Turkish 3 Lig Group 2",
    country: "Turquia",
    flag: "\u{1F1F9}\u{1F1F7}",
    clubs: [
      ["x5869_133793", "Eski\u015Fehirspor", "ESK", "#54a7a5", "#ffffff", 54],
      ["x5869_134254", "Altay", "ALT", "#ffffff", "#000000", 58],
      ["x5869_134590", "Bal\u0131kesirspor", "BAL", "#7e51d5", "#ffffff", 58],
      ["x5869_138965", "Etimesgutspor", "ETI", "#40d15a", "#ffffff", 57],
      ["x5869_138979", "U\u015Fakspor", "UAK", "#27e430", "#ffffff", 62],
      ["x5869_143377", "Bucaspor 1928", "BUC", "#e2fc23", "#ffffff", 61],
      ["x5869_146012", "Kar\u015F\u0131yaka", "KAR", "#dd6c8c", "#ffffff", 55],
      ["x5869_149212", "Kepezspor", "KEP", "#6602a9", "#ffffff", 57],
      ["x5869_149621", "Ayval\u0131kg\xFCc\xFC Belediyespor", "AYV", "#80cef5", "#ffffff", 55],
      ["x5869_149627", "S\xF6ke 1970", "SKE", "#1b1e48", "#a40d2c", 59],
      ["x5869_149630", "Alanya 1221", "ALA", "#a002fd", "#ffffff", 60],
      ["x5869_149633", "Bursa Y\u0131ld\u0131r\u0131mspor", "BUR", "#b5288b", "#ffffff", 57],
      ["x5869_149634", "Eski\u015Fehir Anadolu", "ESK", "#517ec9", "#ffffff", 54],
      ["x5869_149662", "Gemlik S\xFCmerbey", "GEM", "#0caedf", "#ffffff", 62],
      ["x5869_149664", "Tire 2021", "TIR", "#81af09", "#ffffff", 62],
      ["x5869_153070", "Denizli \u0130dman Yurdu", "DEN", "#c90fce", "#ffffff", 62],
      ["x5869_156260", "1922 Ak\u015Fehirspor", "AKE", "#894344", "#ffffff", 60],
      ["x5869_156261", "Bigaspor", "BIG", "#9495b9", "#ffffff", 58]
    ]
  },
  {
    id: "x4654",
    name: "Mexican Liga de Expansi\xF3n MX",
    country: "M\xE9xico",
    flag: "\u{1F1F2}\u{1F1FD}",
    clubs: [
      ["x4654_134190", "Atl\xE9tico Morelia", "ATL", "#0b2029", "#ffffff", 66],
      ["x4654_134622", "Leones Negros UdeG", "LEO", "#625c2c", "#ffffff", 62],
      ["x4654_135739", "Dorados de Sinaloa", "DOR", "#f75abb", "#ffffff", 65],
      ["x4654_138825", "Alebrijes de Oaxaca", "ALE", "#30eba7", "#ffffff", 63],
      ["x4654_138897", "Jaiba Brava", "JAI", "#770405", "#ffffff", 63],
      ["x4654_138898", "Mineros de Zacatecas", "MIN", "#d04a55", "#ffffff", 65],
      ["x4654_138900", "Venados", "VEN", "#1bce84", "#ffffff", 62],
      ["x4654_138902", "Correcaminos UAT", "COR", "#49e77a", "#ffffff", 66],
      ["x4654_139994", "Canc\xFAn", "CAN", "#b96e0d", "#ffffff", 60],
      ["x4654_140344", "Tepatitl\xE1n", "TEP", "#47fdd4", "#ffffff", 62],
      ["x4654_140345", "Tapat\xEDo", "TAP", "#4d5c32", "#ffffff", 61],
      ["x4654_140346", "Tlaxcala", "TLA", "#b4b6d9", "#ffffff", 66],
      ["x4654_146383", "Alacranes de Durango", "ALA", "#561128", "#ffffff", 61],
      ["x4654_146384", "Atl\xE9tico La Paz", "ATL", "#d98c01", "#ffffff", 65],
      ["x4654_156155", "Cruz Azul Hidalgo", "CRU", "#e75d5f", "#ffffff", 62],
      ["x4654_156156", "Piratas", "PIR", "#11afe2", "#ffffff", 62]
    ]
  },
  {
    id: "x5206",
    name: "Mexican Liga Femenil",
    country: "M\xE9xico",
    flag: "\u{1F1F2}\u{1F1FD}",
    clubs: [
      ["x5206_143068", "Am\xE9rica Femenil", "AMR", "#f6e83e", "#ffffff", 60],
      ["x5206_143069", "Ju\xE1rez Femenil", "JUR", "#e0c77c", "#ffffff", 68],
      ["x5206_143070", "Pumas UNAM Femenil", "PUM", "#707274", "#ffffff", 64],
      ["x5206_143071", "Quer\xE9taro Femenil", "QUE", "#c352bb", "#ffffff", 67],
      ["x5206_143072", "Tijuana Femenil", "TIJ", "#7c4d1b", "#ffffff", 67],
      ["x5206_143073", "Atlas Femenil", "ATL", "#b1c2fa", "#ffffff", 60],
      ["x5206_143074", "Atl\xE9tico de San Luis Femenil", "ATL", "#e2c8a8", "#ffffff", 61],
      ["x5206_143075", "Cruz Azul Femenil", "CRU", "#18fe1f", "#ffffff", 62],
      ["x5206_143076", "CD Guadalajara Femenil", "CDG", "#e20e8e", "#ffffff", 62],
      ["x5206_143077", "Le\xF3n Femenil", "LEN", "#bbb03e", "#ffffff", 66],
      ["x5206_143079", "Monterrey Femenil", "MON", "#db53a0", "#ffffff", 66],
      ["x5206_143080", "Necaxa Femenil", "NEC", "#3036d8", "#ffffff", 61],
      ["x5206_143081", "Pachuca Femenil", "PAC", "#ede83e", "#ffffff", 61],
      ["x5206_143082", "Puebla Femenil", "PUE", "#9be278", "#ffffff", 68],
      ["x5206_143083", "Santos Laguna Femenil", "SAN", "#0fe202", "#ffffff", 61],
      ["x5206_143084", "Tigres UANL Femenil", "TIG", "#d5b365", "#ffffff", 68],
      ["x5206_143085", "Toluca Femenil", "TOL", "#e36281", "#ffffff", 64],
      ["x5206_156328", "Atlante Femenil", "ATL", "#ea0a73", "#ffffff", 68]
    ]
  },
  {
    id: "x4824",
    name: "Japanese J2 League",
    country: "Jap\xE3o",
    flag: "\u{1F1EF}\u{1F1F5}",
    clubs: [
      ["x4824_137706", "Hokkaido Consadole Sapporo", "HOK", "#b58d87", "#ffffff", 60],
      ["x4824_137711", "Oita Trinita", "OIT", "#b5fcb9", "#ffffff", 62],
      ["x4824_137712", "Sagan Tosu", "SAG", "#b5539d", "#ffffff", 60],
      ["x4824_137718", "Vegalta Sendai", "VEG", "#8a5b45", "#ffffff", 64],
      ["x4824_137720", "Yokohama FC", "YOK", "#931736", "#ffffff", 67],
      ["x4824_139892", "Montedio Yamagata", "MON", "#4017a8", "#ffffff", 60],
      ["x4824_139893", "RB Omiya Ardija", "RBO", "#c530e3", "#ffffff", 62],
      ["x4824_139898", "Tokushima Vortis", "TOK", "#48f293", "#ffffff", 61],
      ["x4824_139900", "Ventforet Kofu", "VEN", "#251c63", "#ffffff", 62],
      ["x4824_140509", "Blaublitz Akita", "BLA", "#fedc9f", "#ffffff", 66],
      ["x4824_141245", "Fujieda MYFC", "FUJ", "#bdbc71", "#ffffff", 62],
      ["x4824_141249", "FC Imabari", "FCI", "#440d62", "#ffffff", 67],
      ["x4824_141251", "Kataller Toyama", "KAT", "#c2854f", "#ffffff", 63],
      ["x4824_141254", "Tegevajaro Miyazaki", "TEG", "#7ebc56", "#ffffff", 65],
      ["x4824_141255", "Vanraure Hachinohe", "VAN", "#743adf", "#ffffff", 66],
      ["x4824_144685", "Iwaki FC", "IWA", "#ff1e85", "#ffffff", 66],
      ["x4824_150222", "Tochigi City", "TOC", "#7bf6be", "#ffffff", 64]
    ]
  },
  {
    id: "x4967",
    name: "Japanese J3 League",
    country: "Jap\xE3o",
    flag: "\u{1F1EF}\u{1F1F5}",
    clubs: [
      ["x4967_139883", "Ehime FC", "EHI", "#965f65", "#ffffff", 60],
      ["x4967_139885", "Giravanz Kitakyushu", "GIR", "#e19dce", "#ffffff", 67],
      ["x4967_139890", "Matsumoto Yamaga", "MAT", "#334d51", "#ffffff", 61],
      ["x4967_139894", "Renofa Yamaguchi", "REN", "#a09b17", "#ffffff", 63],
      ["x4967_139895", "FC Ryukyu", "FCR", "#c57530", "#ffffff", 60],
      ["x4967_139896", "Tochigi SC", "TOC", "#7da111", "#ffffff", 62],
      ["x4967_139897", "Thespa Gunma", "THE", "#932f7c", "#ffffff", 60],
      ["x4967_139902", "Zweigen Kanazawa", "ZWE", "#0fae53", "#ffffff", 65],
      ["x4967_139903", "Kagoshima United", "KAG", "#6c4715", "#ffffff", 68],
      ["x4967_139904", "FC Gifu", "FCG", "#6c9814", "#ffffff", 66],
      ["x4967_140510", "Sagamihara", "SAG", "#85727e", "#ffffff", 62],
      ["x4967_141246", "Fukushima United", "FUK", "#ead521", "#ffffff", 62],
      ["x4967_141247", "Gainare Tottori", "GAI", "#a0a37a", "#ffffff", 60],
      ["x4967_141250", "Kamatamare Sanuki", "KAM", "#beb4ee", "#ffffff", 68],
      ["x4967_141252", "Nagano Parceiro", "NAG", "#74ae48", "#ffffff", 64],
      ["x4967_141253", "Roasso Kumamoto", "ROA", "#f005f8", "#ffffff", 64],
      ["x4967_147069", "Nara Club", "NAR", "#634843", "#ffffff", 65],
      ["x4967_147070", "FC Osaka", "FCO", "#475e3b", "#ffffff", 62],
      ["x4967_150223", "Kochi United", "KOC", "#f30b99", "#ffffff", 63],
      ["x4967_150625", "Reilac Shiga", "REI", "#a002fe", "#ffffff", 60]
    ]
  },
  {
    id: "x5481",
    name: "Chile Segunda Divisi\xF3n",
    country: "Chile",
    flag: "\u{1F1E8}\u{1F1F1}",
    clubs: [
      ["x5481_148529", "Conc\xF3n National", "CON", "#ffc010", "#000000", 56],
      ["x5481_148530", "Deportes Rengo", "DEP", "#3b6534", "#ffffff", 55],
      ["x5481_148531", "General Vel\xE1squez", "GEN", "#c1baa3", "#ffffff", 60],
      ["x5481_148532", "Deportes Linares", "DEP", "#ffffff", "#c71514", 57],
      ["x5481_148533", "Provincial Osorno", "PRO", "#829663", "#ffffff", 54],
      ["x5481_148534", "Provincial Ovalle", "PRO", "#6feb7f", "#ffffff", 56],
      ["x5481_148535", "Real San Joaqu\xEDn", "REA", "#c2c20e", "#ffffff", 62],
      ["x5481_148537", "Trasandino", "TRA", "#b8ff2e", "#ffffff", 54],
      ["x5481_149463", "Brujas de Salamanca", "BRU", "#6768bc", "#ffffff", 62],
      ["x5481_149465", "Colchagua", "COL", "#2bcc5a", "#ffffff", 54],
      ["x5481_149468", "Atl\xE9tico Colina", "ATL", "#c40cb9", "#ffffff", 60],
      ["x5481_149474", "Santiago City", "SAN", "#3de807", "#ffffff", 57],
      ["x5481_155066", "Lota Schwager", "LOT", "#e30b13", "#000000", 59]
    ]
  },
  {
    id: "x4957",
    name: "Ecuadorian Serie B",
    country: "Equador",
    flag: "\u{1F1EA}\u{1F1E8}",
    clubs: [
      ["x4957_138226", "LDU Portoviejo", "LDU", "#61471b", "#ffffff", 62],
      ["x4957_140793", "9 de Octubre", "DEO", "#82e1a9", "#ffffff", 62],
      ["x4957_141121", "Cumbay\xE1", "CUM", "#be5466", "#ffffff", 62],
      ["x4957_141123", "Gualaceo", "GUA", "#15c456", "#ffffff", 62],
      ["x4957_141126", "Independiente Juniors", "IND", "#11ec91", "#ffffff", 57],
      ["x4957_147318", "Vinotinto Ecuador", "VIN", "#fc7deb", "#ffffff", 60],
      ["x4957_149503", "San Antonio FC", "SAN", "#81e42f", "#ffffff", 61],
      ["x4957_151314", "22 de Julio", "DEJ", "#d7b973", "#ffffff", 61],
      ["x4957_152286", "Cuenca Juniors", "CUE", "#0c6f49", "#ffffff", 60],
      ["x4957_152289", "Deportivo Santo Domingo", "DEP", "#aaebf3", "#ffffff", 54]
    ]
  },
  {
    id: "x5073",
    name: "Peruvian Segunda Divisi\xF3n",
    country: "Peru",
    flag: "\u{1F1F5}\u{1F1EA}",
    clubs: [
      ["x5073_138312", "Alianza Universidad", "ALI", "#f356cb", "#ffffff", 56],
      ["x5073_138314", "Ayacucho", "AYA", "#b687b4", "#ffffff", 61],
      ["x5073_138315", "Deportivo Binacional", "DEP", "#bdc020", "#ffffff", 58],
      ["x5073_138316", "Academia Cantolao", "ACA", "#4b4b3e", "#ffffff", 58],
      ["x5073_138317", "Carlos A. Mannucci", "CAR", "#aa21fe", "#ffffff", 61],
      ["x5073_138321", "Deportivo Llacuabamba", "DEP", "#8e53a9", "#ffffff", 58],
      ["x5073_138327", "Universidad de San Mart\xEDn de Porres", "UNI", "#0f78c0", "#ffffff", 55],
      ["x5073_138328", "Universidad C\xE9sar Vallejo", "UNI", "#e764a0", "#ffffff", 61],
      ["x5073_139427", "Pirata", "PIR", "#7d5a77", "#ffffff", 58],
      ["x5073_139428", "Uni\xF3n Comercio", "UNI", "#9cc4b8", "#ffffff", 62],
      ["x5073_141816", "Santos de Nazca", "SAN", "#1251e0", "#ffffff", 62],
      ["x5073_147332", "Comerciantes", "COM", "#e68c31", "#ffffff", 55],
      ["x5073_149505", "ADA Ja\xE9n", "ADA", "#67fa68", "#ffffff", 59],
      ["x5073_150362", "Bent\xEDn Tacna Heroica", "BEN", "#aadcbb", "#ffffff", 59],
      ["x5073_155110", "Sport Huancayo II", "SPO", "#8cc6d2", "#ffffff", 62],
      ["x5073_155111", "Estudiantil CNI", "EST", "#f51b7d", "#ffffff", 55],
      ["x5073_155112", "Uni\xF3n Minas", "UNI", "#4e4dfb", "#ffffff", 59]
    ]
  },
  {
    id: "x4640",
    name: "Greek Super League 2",
    country: "Gr\xE9cia",
    flag: "\u{1F1EC}\u{1F1F7}",
    clubs: [
      ["x4640_133747", "Panionios", "PAN", "#3e29da", "#ffffff", 59],
      ["x4640_133872", "Panthrakikos", "PAN", "#90120c", "#ffffff", 56],
      ["x4640_134629", "Niki Volos", "NIK", "#e0f06b", "#ffffff", 60],
      ["x4640_135709", "AEL", "AEL", "#f38222", "#ffffff", 59],
      ["x4640_138095", "Apollon Kalamarias", "APO", "#e5520a", "#ffffff", 54],
      ["x4640_144144", "Anagennisi Karditsas", "ANA", "#94b4a7", "#ffffff", 59],
      ["x4640_144149", "Zakynthos", "ZAK", "#7e5412", "#ffffff", 60],
      ["x4640_144156", "Olympiacos II", "OLY", "#c59602", "#ffffff", 61],
      ["x4640_144157", "PAOK II", "PAO", "#a336f2", "#ffffff", 59],
      ["x4640_149283", "Asteras Tripolis II", "AST", "#9a953e", "#ffffff", 55],
      ["x4640_153173", "Nestos Chrysoupoli", "NES", "#e57fb3", "#ffffff", 55],
      ["x4640_153174", "Hellas Syros", "HEL", "#7e0a30", "#ffffff", 58],
      ["x4640_153175", "Marko", "MAR", "#534204", "#ffffff", 59],
      ["x4640_155053", "Pyrgos", "PYR", "#955ec9", "#ffffff", 61]
    ]
  },
  {
    id: "x4796",
    name: "Austrian Erste Liga",
    country: "\xC1ustria",
    flag: "\u{1F1E6}\u{1F1F9}",
    clubs: [
      ["x4796_134008", "Admira Wacker", "ADM", "#51e7ab", "#ffffff", 60],
      ["x4796_134607", "SKN St. Polten", "SKN", "#9c04a7", "#ffffff", 54],
      ["x4796_139413", "Kapfenberger SV", "KAP", "#3b9fa8", "#ffffff", 58],
      ["x4796_139414", "Floridsdorfer AC", "FLO", "#37a0a4", "#ffffff", 58],
      ["x4796_139416", "FC Liefering", "FCL", "#19eeed", "#ffffff", 62],
      ["x4796_139417", "SKU Amstetten", "SKU", "#399444", "#ffffff", 62],
      ["x4796_139418", "Young Violets Austria Wien", "YOU", "#f57524", "#ffffff", 58],
      ["x4796_139423", "Wacker Innsbruck", "WAC", "#fdcb29", "#ffffff", 62],
      ["x4796_140290", "Rapid Wien II", "RAP", "#872270", "#ffffff", 59],
      ["x4796_140368", "First Vienna", "FIR", "#e60840", "#ffffff", 57],
      ["x4796_146373", "Sturm Graz II", "STU", "#f53c1f", "#ffffff", 56],
      ["x4796_146473", "Hertha Wels", "HER", "#862b3a", "#ffffff", 58],
      ["x4796_146509", "Schwarz-Wei\xDF Bregenz", "SCH", "#d83289", "#ffffff", 61],
      ["x4796_146511", "Austria Salzburg", "AUS", "#60aeb5", "#ffffff", 59],
      ["x4796_147514", "Voitsberg", "VOI", "#6d8010", "#ffffff", 58]
    ]
  },
  {
    id: "x4713",
    name: "Swiss Challenge League",
    country: "Su\xED\xE7a",
    flag: "\u{1F1E8}\u{1F1ED}",
    clubs: [
      ["x4713_137868", "Neuch\xE2tel Xamax", "NEU", "#12f4ee", "#ffffff", 65],
      ["x4713_138986", "Stade Lausanne Ouchy", "SLO", "#957d30", "#ffffff", 61],
      ["x4713_138988", "Wil", "WIL", "#897de3", "#ffffff", 65],
      ["x4713_138991", "Kriens", "KRI", "#27394f", "#ffffff", 62],
      ["x4713_141840", "Yverdon Sport", "YVE", "#24cdbc", "#ffffff", 64],
      ["x4713_146549", "\xC9toile Carouge", "TOI", "#5d55cd", "#ffffff", 68],
      ["x4713_146551", "Rapperswil-Jona", "RAP", "#c00ff3", "#ffffff", 63],
      ["x4713_146553", "Stade Nyonnais", "STA", "#be9dd6", "#ffffff", 62]
    ]
  },
  {
    id: "x5319",
    name: "Swiss Promotion League",
    country: "Su\xED\xE7a",
    flag: "\u{1F1E8}\u{1F1ED}",
    clubs: [
      ["x5319_138989", "Schaffhausen", "SCH", "#14269c", "#ffffff", 67],
      ["x5319_146542", "Basel II", "BAS", "#a83393", "#ffffff", 67],
      ["x5319_146543", "Bavois", "BAV", "#4928c1", "#ffffff", 67],
      ["x5319_146544", "Biel-Bienne", "BIE", "#5bc995", "#ffffff", 68],
      ["x5319_146545", "Breitenrain", "BRE", "#b65ef6", "#ffffff", 68],
      ["x5319_146546", "Br\xFChl", "BRH", "#0b91b2", "#ffffff", 64],
      ["x5319_146547", "Bulle", "BUL", "#951347", "#ffffff", 65],
      ["x5319_146548", "Cham", "CHA", "#3d884d", "#ffffff", 67],
      ["x5319_146550", "Luzern II", "LUZ", "#aacc3b", "#ffffff", 66],
      ["x5319_146554", "Young Fellows Juventus", "YOU", "#8b34f2", "#ffffff", 62],
      ["x5319_146555", "Young Boys II", "YOU", "#dfc490", "#ffffff", 60],
      ["x5319_146556", "Z\xFCrich II", "ZRI", "#e6c283", "#ffffff", 61],
      ["x5319_147488", "Lugano II", "LUG", "#ce3d27", "#ffffff", 68],
      ["x5319_147489", "Paradiso", "PAR", "#1e99ac", "#ffffff", 64],
      ["x5319_148679", "Grand-Saconnex", "GRA", "#c5262c", "#ffffff", 64],
      ["x5319_152463", "Kreuzlingen", "KRE", "#8e8c3a", "#ffffff", 61],
      ["x5319_156095", "Amical Saint-Prex", "AMI", "#d4baaf", "#ffffff", 68]
    ]
  },
  {
    id: "x4632",
    name: "Danish 2nd Division",
    country: "Dinamarca",
    flag: "\u{1F1E9}\u{1F1F0}",
    clubs: [
      ["x4632_138450", "Brabrand", "BRA", "#a7fbba", "#ffffff", 61],
      ["x4632_138452", "Roskilde", "ROS", "#9e1c0e", "#ffffff", 62],
      ["x4632_138453", "Fremad Amager", "FRE", "#9f9730", "#ffffff", 67],
      ["x4632_138454", "Nyk\xF8bing", "NYK", "#978439", "#ffffff", 67],
      ["x4632_138455", "Skive", "SKI", "#8e7968", "#ffffff", 65],
      ["x4632_138456", "Thisted", "THI", "#a3e4f7", "#ffffff", 61],
      ["x4632_139045", "N\xE6stved", "NST", "#9ce5f1", "#ffffff", 65],
      ["x4632_141779", "B.93", "B", "#d536df", "#ffffff", 64],
      ["x4632_141780", "FA 2000", "FA", "#895934", "#ffffff", 62],
      ["x4632_141781", "Hellerup", "HEL", "#6a3974", "#ffffff", 66],
      ["x4632_141783", "Middelfart", "MID", "#0bac40", "#ffffff", 65],
      ["x4632_143407", "VSK Aarhus", "VSK", "#6a8ad0", "#ffffff", 64]
    ]
  },
  {
    id: "x5202",
    name: "Denmark A-Liga",
    country: "Dinamarca",
    flag: "\u{1F1E9}\u{1F1F0}",
    clubs: [
      ["x5202_143491", "Br\xF8ndby Women", "BRN", "#327fed", "#ffffff", 67],
      ["x5202_143492", "Fortuna Hj\xF8rring Women", "FOR", "#def567", "#ffffff", 67],
      ["x5202_143494", "KoldingQ", "KOL", "#38a17c", "#ffffff", 61],
      ["x5202_143495", "K\xF8ge Women", "KGE", "#1be0db", "#ffffff", 64],
      ["x5202_143496", "Nordsj\xE6lland Women", "NOR", "#05202a", "#ffffff", 67],
      ["x5202_143498", "AGF Women", "AGF", "#42a532", "#ffffff", 67],
      ["x5202_146468", "Odense Q", "ODE", "#9a8d16", "#ffffff", 65],
      ["x5202_156162", "Midtjylland Women", "MID", "#7bacdc", "#ffffff", 65],
      ["x5202_156163", "ASA Fodbold Women", "ASA", "#9ae353", "#ffffff", 60],
      ["x5202_156164", "FC Copenhagen Women", "FCK", "#e4393f", "#ffffff", 63]
    ]
  },
  {
    id: "x4403",
    name: "Swedish Superettan",
    country: "Su\xE9cia",
    flag: "\u{1F1F8}\u{1F1EA}",
    clubs: [
      ["x4403_133951", "Helsingborg", "HEL", "#35d0b1", "#ffffff", 64],
      ["x4403_134165", "Norrk\xF6ping", "NOR", "#db83a9", "#ffffff", 60],
      ["x4403_134171", "\xD6ster", "STE", "#483aec", "#ffffff", 68],
      ["x4403_134482", "\xD6rebro", "\xD6SK", "#3bf38f", "#ffffff", 62],
      ["x4403_134483", "Falkenberg", "FAL", "#43e463", "#ffffff", 65],
      ["x4403_134719", "Ljungskile", "LJU", "#af8ca3", "#ffffff", 63],
      ["x4403_134722", "Landskrona", "LAN", "#0bd108", "#ffffff", 66],
      ["x4403_134729", "Sundsvall", "SUN", "#4b0c6c", "#ffffff", 67],
      ["x4403_134730", "Varberg", "VAR", "#444bcd", "#ffffff", 66],
      ["x4403_134732", "\xD6stersund", "STE", "#186657", "#ffffff", 68],
      ["x4403_135855", "Norrby", "NOR", "#320938", "#ffffff", 60],
      ["x4403_136118", "Brage", "BRA", "#0ab322", "#ffffff", 61],
      ["x4403_138260", "Sandvikens", "SAN", "#b2b219", "#ffffff", 64],
      ["x4403_138270", "Oddevold", "ODD", "#3d67e8", "#ffffff", 65],
      ["x4403_147057", "United Nordic", "UNI", "#7c8d72", "#ffffff", 61]
    ]
  },
  {
    id: "x5209",
    name: "Sweden Damallsvenskan",
    country: "Su\xE9cia",
    flag: "\u{1F1F8}\u{1F1EA}",
    clubs: [
      ["x5209_143509", "BK H\xE4cken Women", "BKH", "#4f8668", "#ffffff", 61],
      ["x5209_143510", "Pite\xE5 Women", "PIT", "#972a9c", "#ffffff", 64],
      ["x5209_143511", "Roseng\xE5rd Women", "ROS", "#192057", "#c1122f", 62],
      ["x5209_143512", "Djurg\xE5rden Women", "DJU", "#47ef89", "#ffffff", 67],
      ["x5209_143513", "Eskilstuna United Women", "ESK", "#c59451", "#ffffff", 65],
      ["x5209_143515", "Kristianstad Women", "KRI", "#6ae76e", "#ffffff", 62],
      ["x5209_143517", "Vittsj\xF6", "VIT", "#6e2804", "#ffffff", 67],
      ["x5209_143518", "V\xE4xj\xF6", "VXJ", "#1a1f8f", "#ffffff", 62],
      ["x5209_143519", "AIK Women", "AIK", "#44f6d9", "#ffffff", 67],
      ["x5209_143520", "Hammarby Women", "HAM", "#40a762", "#ffffff", 67],
      ["x5209_144984", "Brommapojkarna Women", "BRO", "#de16ce", "#ffffff", 61],
      ["x5209_147705", "Norrk\xF6ping Women", "NOR", "#278c1d", "#ffffff", 62],
      ["x5209_147706", "Uppsala Women", "UPP", "#1ac1bc", "#ffffff", 68],
      ["x5209_150703", "Malm\xF6 FF Women", "MAL", "#e63937", "#ffffff", 67]
    ]
  },
  {
    id: "x4457",
    name: "Norwegian 1. Divisjon",
    country: "Noruega",
    flag: "\u{1F1F3}\u{1F1F4}",
    clubs: [
      ["x4457_134054", "Stab\xE6k", "STA", "#f17ec9", "#ffffff", 63],
      ["x4457_134563", "Sogndal", "SOG", "#6bf949", "#ffffff", 61],
      ["x4457_134565", "Sandnes Ulf", "SAN", "#ff1c65", "#ffffff", 66],
      ["x4457_134750", "Bryne", "BRY", "#ef4431", "#ffffff", 68],
      ["x4457_134755", "H\xF8dd", "HDD", "#b399ad", "#ffffff", 68],
      ["x4457_134759", "Ranheim", "RAN", "#db4dc8", "#ffffff", 60],
      ["x4457_134760", "Str\xF8mmen", "STR", "#8ebeb7", "#ffffff", 62],
      ["x4457_135718", "\xC5sane", "SAN", "#2dbc83", "#ffffff", 66],
      ["x4457_135722", "Raufoss", "RAU", "#a3ad4b", "#ffffff", 60],
      ["x4457_135724", "Kongsvinger", "KON", "#291a93", "#ffffff", 67],
      ["x4457_140041", "Lyn", "LYN", "#fd7eca", "#ffffff", 67],
      ["x4457_147094", "Moss", "MOS", "#6e3f4a", "#ffffff", 61],
      ["x4457_147882", "Egersund", "EIK", "#eb3e7b", "#ffffff", 60]
    ]
  },
  {
    id: "x5208",
    name: "Norway Toppserien",
    country: "Noruega",
    flag: "\u{1F1F3}\u{1F1F4}",
    clubs: [
      ["x5208_143499", "LSK Kvinner FK Women", "LSK", "#615a46", "#ffffff", 67],
      ["x5208_143500", "V\xE5lerenga Women", "VLE", "#7b8708", "#ffffff", 66],
      ["x5208_143504", "Stab\xE6k Women", "STA", "#5bfc33", "#ffffff", 61],
      ["x5208_143506", "Lyn Women", "LYN", "#c75e54", "#ffffff", 66],
      ["x5208_143507", "Rosenborg Women", "ROS", "#314235", "#ffffff", 64],
      ["x5208_144943", "R\xF8a Women", "RAW", "#493aa1", "#ffffff", 62],
      ["x5208_144944", "Brann Women", "BRA", "#0e6b00", "#ffffff", 61],
      ["x5208_154680", "Aalesunds Women", "AAL", "#6de99d", "#ffffff", 66],
      ["x5208_154681", "Bod\xF8-Glimt Women", "BOD", "#5fa77e", "#ffffff", 60],
      ["x5208_154682", "Haugesund Women", "HAU", "#f51436", "#ffffff", 67],
      ["x5208_154683", "H\xF8nefoss Women", "HNE", "#06e16b", "#ffffff", 63],
      ["x5208_154684", "Molde Women", "MOL", "#9fc915", "#ffffff", 68]
    ]
  },
  {
    id: "x4666",
    name: "Russian First League",
    country: "R\xFAssia",
    flag: "\u{1F1F7}\u{1F1FA}",
    clubs: [
      ["x4666_134439", "Ural Yekaterinburg", "URA", "#305e6b", "#ffffff", 59],
      ["x4666_134553", "Arsenal Tula", "ARS", "#5aa54e", "#ffffff", 55],
      ["x4666_134554", "Torpedo Moscow", "TOR", "#5c0a72", "#ffffff", 58],
      ["x4666_134556", "Ufa", "UFA", "#1a0a90", "#ffffff", 60],
      ["x4666_135909", "SKA-Khabarovsk", "SKA", "#0d563c", "#ffffff", 60],
      ["x4666_136255", "Yenisey Krasnoyarsk", "YEN", "#a72f72", "#ffffff", 58],
      ["x4666_138153", "Nizhny Novgorod", "NIZ", "#feeb9e", "#ffffff", 54],
      ["x4666_138154", "Neftekhimik Nizhnekamsk", "NEF", "#f43df1", "#ffffff", 56],
      ["x4666_138155", "Rotor Volgograd", "ROT", "#c78489", "#ffffff", 55],
      ["x4666_138156", "Shinnik Yaroslavl", "SHI", "#dade86", "#ffffff", 62],
      ["x4666_138158", "Tekstilshchik Ivanovo", "TEK", "#55b798", "#ffffff", 56],
      ["x4666_140085", "Veles Moscow", "VEL", "#dbe33b", "#ffffff", 58],
      ["x4666_141797", "KAMAZ Naberezhnye Chelny", "KAM", "#c0cd9f", "#ffffff", 54],
      ["x4666_143102", "Chelyabinsk", "CHE", "#a1167b", "#ffffff", 55],
      ["x4666_143111", "Leningradets Leningrad Oblast", "LEN", "#453b82", "#ffffff", 60],
      ["x4666_143124", "Volga Ulyanovsk", "VOL", "#d45024", "#ffffff", 55],
      ["x4666_146520", "Spartak Kostroma", "SPA", "#16f4b7", "#ffffff", 58]
    ]
  },
  {
    id: "x5217",
    name: "Russia FNL 2 Group 1",
    country: "R\xFAssia",
    flag: "\u{1F1F7}\u{1F1FA}",
    clubs: [
      ["x5217_134431", "Sevastopol", "SEV", "#e129b7", "#ffffff", 60],
      ["x5217_143100", "Spartak Nalchik", "SPA", "#80fd07", "#ffffff", 60],
      ["x5217_143106", "Druzhba Maykop", "DRU", "#3410e5", "#ffffff", 60],
      ["x5217_147447", "Astrakhan", "AST", "#e95415", "#ffffff", 60],
      ["x5217_147448", "Rubin Yalta", "RUB", "#d30969", "#ffffff", 59],
      ["x5217_149495", "Rostov-2", "ROS", "#87a0dc", "#ffffff", 59],
      ["x5217_149496", "Angusht Nazran", "ANG", "#1e3e6a", "#ffffff", 57],
      ["x5217_149497", "Nart Cherkessk", "NAR", "#06a434", "#ffffff", 59],
      ["x5217_149498", "Pobeda Khasavyurt", "POB", "#121d63", "#ffffff", 61],
      ["x5217_149499", "Dynamo-2 Makhachkala", "DYN", "#2d0638", "#ffffff", 59],
      ["x5217_153430", "PSK Dinskaya", "PSK", "#ee41b3", "#ffffff", 58],
      ["x5217_155210", "Kyzyltash Bakhchisaray", "KYZ", "#89ea76", "#ffffff", 58],
      ["x5217_155223", "Zarya Lugansk", "ZAR", "#7fccb0", "#ffffff", 59],
      ["x5217_155224", "Neftyanik Izberbash", "NEF", "#391095", "#ffffff", 61],
      ["x5217_155225", "Chayka-M Peschanokopskoye", "CHA", "#6ff31c", "#ffffff", 61],
      ["x5217_155226", "Shakhtyor Donetsk Taganrog", "SHA", "#f27e36", "#ffffff", 62]
    ]
  },
  {
    id: "x4677",
    name: "Ukrainian First League",
    country: "Ucr\xE2nia",
    flag: "\u{1F1FA}\u{1F1E6}",
    clubs: [
      ["x4677_138438", "Ahrobiznes Volochysk", "AHR", "#72917d", "#ffffff", 59],
      ["x4677_138443", "Inhulets Petrove", "INH", "#c9cfd2", "#ffffff", 55],
      ["x4677_138448", "Prykarpattia-Blaho", "PRY", "#b94130", "#ffffff", 55],
      ["x4677_140179", "Nyva Ternopil", "NYV", "#b8fe82", "#ffffff", 60],
      ["x4677_142825", "Metalist Kharkiv", "MET", "#bc0e59", "#ffffff", 56],
      ["x4677_146858", "Chernihiv", "CHE", "#712240", "#ffffff", 57],
      ["x4677_146859", "FSC Mariupol", "FSC", "#ca8cbb", "#ffffff", 59],
      ["x4677_146861", "Poltava", "POL", "#fca136", "#ffffff", 55],
      ["x4677_147626", "Viktoriya Sumy", "VIK", "#642113", "#ffffff", 59],
      ["x4677_149226", "UCSA Tarasivka", "UCS", "#da3ed0", "#ffffff", 56],
      ["x4677_152563", "Probiy Horodenka", "PRO", "#26f0a9", "#ffffff", 58],
      ["x4677_156158", "Kulykiv-Bilka", "KUL", "#87741d", "#ffffff", 54],
      ["x4677_156159", "Lokomotyv Kyiv", "LOK", "#f508b8", "#ffffff", 62],
      ["x4677_156160", "Polissya-2 Zhytomyr", "POL", "#f22e41", "#ffffff", 54],
      ["x4677_156161", "Kolos-2 Kovalivka", "KOL", "#3e6e6f", "#ffffff", 61]
    ]
  },
  {
    id: "x4628",
    name: "China League One",
    country: "China",
    flag: "\u{1F1E8}\u{1F1F3}",
    clubs: [
      ["x4628_139002", "Shaanxi Union", "SHA", "#8148cd", "#ffffff", 61],
      ["x4628_139003", "Jiangxi Dingnan United", "JIA", "#efcad7", "#ffffff", 68],
      ["x4628_139004", "Nantong Zhiyun", "NAN", "#8344e8", "#ffffff", 61],
      ["x4628_141325", "Nanjing City", "NAN", "#bc1849", "#ffffff", 66],
      ["x4628_141327", "Suzhou Dongwu", "SUZ", "#c169a2", "#ffffff", 67],
      ["x4628_144999", "Shijiazhuang Gongfu", "SHI", "#88388f", "#ffffff", 61],
      ["x4628_146357", "Ningbo Professional", "NIN", "#5b9c75", "#ffffff", 65],
      ["x4628_146691", "Foshan Nanshi", "FOS", "#28acf7", "#ffffff", 65],
      ["x4628_146693", "Wuxi Wugo", "WUX", "#aabcbb", "#ffffff", 66],
      ["x4628_146694", "Yanbian Longding", "YAN", "#aca125", "#ffffff", 61],
      ["x4628_149549", "Shenzhen Juniors", "SHE", "#811f6f", "#ffffff", 66],
      ["x4628_149550", "Guangxi Hengchen", "GUA", "#876b5f", "#ffffff", 61],
      ["x4628_149553", "Guangdong GZ-Power", "GUA", "#dbee09", "#ffffff", 65],
      ["x4628_149555", "Dalian K'un City", "DAL", "#1e0222", "#ffffff", 66]
    ]
  },
  {
    id: "x5310",
    name: "China league Two",
    country: "China",
    flag: "\u{1F1E8}\u{1F1F3}",
    clubs: [
      ["x5310_141322", "Beijing Institute of Technology", "BEI", "#9e6b83", "#ffffff", 58],
      ["x5310_141323", "Jiangxi Lushan", "JIA", "#e118fb", "#ffffff", 55],
      ["x5310_146688", "Hubei Istar", "HUB", "#d07161", "#ffffff", 58],
      ["x5310_146690", "Qingdao Red Lions", "QIN", "#b3c988", "#ffffff", 60],
      ["x5310_146695", "Wenzhou Professional", "WEN", "#85da5e", "#ffffff", 62],
      ["x5310_146698", "Nantong Haimen Codion", "NAN", "#8f4a03", "#ffffff", 55],
      ["x5310_146699", "Ganzhou Ruishi", "GAN", "#be1e1e", "#ffffff", 60],
      ["x5310_146700", "Tai'an Tiankuang", "TAI", "#7140b2", "#ffffff", 60],
      ["x5310_149548", "Hangzhou Linping Wuyue", "HAN", "#925b80", "#ffffff", 54],
      ["x5310_149551", "Shandong Taishan B", "SHA", "#acd8b2", "#ffffff", 62],
      ["x5310_149552", "Shanghai Port B", "SHA", "#ccadb8", "#ffffff", 58],
      ["x5310_149554", "Lanzhou Longyuan Athletic", "LAN", "#95e864", "#ffffff", 58],
      ["x5310_149556", "Shanxi Chongde Ronghai", "SHA", "#0bfefb", "#ffffff", 54],
      ["x5310_150187", "Changchun Xidu", "CHA", "#870dc4", "#ffffff", 55],
      ["x5310_150190", "Shanghai Second", "SHA", "#ba4f99", "#ffffff", 57],
      ["x5310_150596", "Shenzhen 2028", "SHE", "#06a8b4", "#ffffff", 60],
      ["x5310_150597", "Guizhou Guiyang Athletic", "GUI", "#254f5c", "#ffffff", 59],
      ["x5310_150598", "Guangdong Mingtu", "GUA", "#fa325c", "#ffffff", 60],
      ["x5310_150599", "Guangzhou Dandelion", "GUA", "#1cf6a0", "#ffffff", 55],
      ["x5310_150600", "Wuhan Three Towns B", "WUH", "#3245de", "#ffffff", 61],
      ["x5310_150601", "Chengdu Rongcheng B", "CHE", "#f26e8c", "#ffffff", 62],
      ["x5310_155114", "Xiamen Feilu", "XIA", "#69c77b", "#ffffff", 55],
      ["x5310_155115", "Dalian Kewei", "DAL", "#2f0c78", "#ffffff", 54],
      ["x5310_155116", "Dalian Yingbo B", "DAL", "#03cea0", "#ffffff", 61]
    ]
  },
  {
    id: "x4620",
    name: "Australia ACT NPL",
    country: "Austr\xE1lia",
    flag: "\u{1F1E6}\u{1F1FA}",
    clubs: [
      ["x4620_134593", "Canberra Croatia", "CAN", "#bfbdca", "#ffffff", 62],
      ["x4620_134594", "Cooma Tigers", "COO", "#61b2a0", "#ffffff", 66],
      ["x4620_134595", "Monaro Panthers", "MON", "#9bf2a6", "#ffffff", 68],
      ["x4620_134598", "Tuggeranong United", "TUG", "#add468", "#ffffff", 63],
      ["x4620_134599", "Belconnen United", "BEL", "#650e20", "#ffffff", 68],
      ["x4620_134798", "Canberra Olympic", "CAN", "#625430", "#ffffff", 68],
      ["x4620_145083", "O'Connor Knights", "OCO", "#b310f9", "#ffffff", 61],
      ["x4620_150512", "Queanbeyan City", "QUE", "#e36444", "#ffffff", 68],
      ["x4620_155250", "Brindabella Blues", "BRI", "#0e9a27", "#ffffff", 62],
      ["x4620_155251", "Canberra Juventus", "CAN", "#288b6c", "#ffffff", 67],
      ["x4620_155252", "Canberra White Eagles", "CAN", "#0f4d1a", "#ffffff", 60]
    ]
  },
  {
    id: "x5010",
    name: "Australia Northern NSW NPL",
    country: "Austr\xE1lia",
    flag: "\u{1F1E6}\u{1F1FA}",
    clubs: [
      ["x5010_141675", "Adamstown Rosebud", "ADA", "#7d4adf", "#ffffff", 66],
      ["x5010_141676", "Broadmeadow Magic", "BRO", "#716cee", "#ffffff", 65],
      ["x5010_141677", "Charlestown Azzurri", "CHA", "#ab7c05", "#ffffff", 62],
      ["x5010_141678", "Edgeworth", "EDG", "#572dd7", "#ffffff", 61],
      ["x5010_141679", "Newcastle Olympic", "NEW", "#669eab", "#ffffff", 66],
      ["x5010_141681", "Lambton Jaffas", "LAM", "#c4d5e0", "#ffffff", 60],
      ["x5010_141682", "Maitland", "MAI", "#128a19", "#ffffff", 60],
      ["x5010_141683", "Valentine", "VAL", "#1a00b7", "#ffffff", 61],
      ["x5010_141684", "Weston Bears", "WES", "#ab9b1e", "#ffffff", 66],
      ["x5010_144722", "Cooks Hill United", "COO", "#4fadce", "#ffffff", 66],
      ["x5010_150205", "Belmont Swansea United", "BEL", "#9672ea", "#ffffff", 62],
      ["x5010_154897", "Kahibah", "KAH", "#108bfc", "#ffffff", 67]
    ]
  },
  {
    id: "x4661",
    name: "Polish I liga",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["x4661_134016", "Ruch Chorz\xF3w", "RUC", "#8d7c6d", "#ffffff", 63],
      ["x4661_135299", "Lechia Gda\u0144sk", "LEC", "#78745d", "#ffffff", 64],
      ["x4661_135301", "Podbeskidzie Bielsko-Bia\u0142a", "POD", "#b79e00", "#ffffff", 64],
      ["x4661_135495", "Bruk-Bet Termalica Nieciecza", "BRU", "#a4cc80", "#ffffff", 61],
      ["x4661_135660", "Arka Gdynia", "ARK", "#66c1a6", "#ffffff", 66],
      ["x4661_136190", "Mied\u017A Legnica", "MIE", "#9d708d", "#ffffff", 62],
      ["x4661_137112", "\u0141KS \u0141\xF3d\u017A", "KSD", "#c47846", "#ffffff", 66],
      ["x4661_138905", "Stal Mielec", "STA", "#e8c91f", "#ffffff", 64],
      ["x4661_138906", "Warta Pozna\u0144", "WAR", "#ff17c3", "#ffffff", 67],
      ["x4661_138910", "Chrobry G\u0142og\xF3w", "CHR", "#cdb5d7", "#ffffff", 64],
      ["x4661_138912", "Odra Opole", "ODR", "#d1e89e", "#ffffff", 68],
      ["x4661_138913", "Puszcza Niepo\u0142omice", "PUS", "#886b25", "#ffffff", 60],
      ["x4661_140531", "Polonia Warsaw", "POL", "#ae04d5", "#ffffff", 60],
      ["x4661_146387", "Stal Rzesz\xF3w", "STA", "#842ac3", "#ffffff", 68],
      ["x4661_148483", "Pogo\u0144 Siedlce", "POG", "#bc280c", "#ffffff", 61],
      ["x4661_152460", "Polonia Bytom", "POL", "#de8ce0", "#ffffff", 65],
      ["x4661_152461", "Pogo\u0144 Grodzisk Mazowiecki", "POG", "#675e50", "#ffffff", 68],
      ["x4661_153542", "Unia Skierniewice", "UNI", "#9f795f", "#ffffff", 62]
    ]
  },
  {
    id: "x5709",
    name: "Polish II liga",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["x5709_134612", "Zawisza Bydgoszcz", "ZAW", "#c57bfc", "#ffffff", 65],
      ["x5709_135295", "G\xF3rnik \u0141\u0119czna", "GRN", "#6c04cb", "#ffffff", 65],
      ["x5709_136028", "Sandecja Nowy Sacz", "SAN", "#0c68a9", "#ffffff", 61],
      ["x5709_138908", "Chojniczanka Chojnice", "CHO", "#8426ca", "#ffffff", 65],
      ["x5709_138909", "Olimpia Grudzi\u0105dz", "OLI", "#9c5c39", "#ffffff", 67],
      ["x5709_138917", "GKS Tychy", "GKS", "#0e7d73", "#ffffff", 67],
      ["x5709_140096", "Resovia Rzesz\xF3w", "RES", "#16994d", "#ffffff", 63],
      ["x5709_140167", "Znicz Pruszk\xF3w", "ZNI", "#40e191", "#ffffff", 65],
      ["x5709_143922", "Stal Stalowa Wola", "STA", "#d4a8e0", "#ffffff", 64],
      ["x5709_153534", "Hutnik Krak\xF3w", "HUT", "#2455f4", "#ffffff", 64],
      ["x5709_153537", "Podhale Nowy Targ", "POD", "#fb973d", "#ffffff", 61],
      ["x5709_153538", "Rekord Bielsko-Bia\u0142a", "REK", "#3f1ff1", "#ffffff", 63],
      ["x5709_153539", "Sok\xF3\u0142 Kleczew", "SOK", "#41688b", "#ffffff", 68],
      ["x5709_153540", "\u015Al\u0105sk Wroc\u0142aw II", "LSK", "#7f6f01", "#ffffff", 63],
      ["x5709_153541", "\u015Awit Szczecin", "WIT", "#3677d4", "#ffffff", 67],
      ["x5709_154240", "Legia Warsaw II", "LEG", "#fe1f47", "#ffffff", 61],
      ["x5709_154302", "Lechia Zielona G\xF3ra", "LEC", "#132686", "#ffffff", 62],
      ["x5709_154327", "Avia \u015Awidnik", "AVI", "#be80e5", "#ffffff", 68]
    ]
  },
  {
    id: "x4954",
    name: "Czech National Football League",
    country: "Tch\xE9quia",
    flag: "\u{1F1E8}\u{1F1FF}",
    clubs: [
      ["x4954_136678", "P\u0159\xEDbram", "PBR", "#81e10e", "#ffffff", 58],
      ["x4954_136682", "Dukla Praha", "DUK", "#797412", "#ffffff", 55],
      ["x4954_137809", "Opava", "OPA", "#85c4a3", "#ffffff", 59],
      ["x4954_141111", "Prost\u011Bjov", "PRO", "#48a566", "#ffffff", 59],
      ["x4954_141113", "T\xE1borsko", "TBO", "#544bb5", "#ffffff", 58],
      ["x4954_141114", "T\u0159inec", "TIN", "#986e4a", "#ffffff", 60],
      ["x4954_141115", "\xDAst\xED nad Labem", "STN", "#edb42d", "#ffffff", 60],
      ["x4954_141117", "Viktoria \u017Di\u017Ekov", "VIK", "#a6fa76", "#ffffff", 57],
      ["x4954_141118", "Vla\u0161im", "VLA", "#a1dd7c", "#ffffff", 59],
      ["x4954_141119", "Vyso\u010Dina Jihlava", "VYS", "#95f657", "#ffffff", 60],
      ["x4954_146409", "Slavia Prague B", "SLA", "#8653ea", "#ffffff", 57],
      ["x4954_147434", "Han\xE1ck\xE1 Slavia Krom\u011B\u0159\xED\u017E", "HAN", "#657e86", "#ffffff", 56],
      ["x4954_148503", "Ban\xEDk Ostrava B", "BAN", "#081870", "#ffffff", 56],
      ["x4954_155433", "Kladno", "KLA", "#53def2", "#ffffff", 56],
      ["x4954_155478", "Arsenal \u010Cesk\xE1 L\xEDpa", "ARS", "#fdc10d", "#ffffff", 61]
    ]
  },
  {
    id: "x5878",
    name: "Czech Bohemian Football League Group A",
    country: "Tch\xE9quia",
    flag: "\u{1F1E8}\u{1F1FF}",
    clubs: [
      ["x5878_137808", "Dynamo \u010Cesk\xE9 Bud\u011Bjovice", "DYN", "#9d1289", "#ffffff", 67],
      ["x5878_141795", "Sparta Prague B", "SPA", "#1fb2f2", "#ffffff", 63],
      ["x5878_155432", "Jiskra Doma\u017Elice", "JIS", "#a0da21", "#ffffff", 66],
      ["x5878_155434", "Viktoria Plze\u0148 B", "VIK", "#ab2a50", "#ffffff", 65],
      ["x5878_155435", "Motorlet Praha", "MOT", "#6b52bb", "#ffffff", 65],
      ["x5878_155436", "Bohemians 1905 B", "BOH", "#998610", "#ffffff", 67],
      ["x5878_155437", "Dukla Praha B", "DUK", "#68abca", "#ffffff", 62],
      ["x5878_155439", "P\xEDsek", "PSE", "#9a662a", "#ffffff", 66],
      ["x5878_155463", "Admira Praha", "ADM", "#6da08a", "#ffffff", 67],
      ["x5878_155466", "Loko Praha", "LOK", "#b034cb", "#ffffff", 64],
      ["x5878_155468", "Aritma Praha", "ARI", "#bfad31", "#ffffff", 63],
      ["x5878_155469", "Kr\xE1l\u016Fv Dv\u016Fr", "KRL", "#07868f", "#ffffff", 63],
      ["x5878_155470", "P\u0159\xEDbram Akademie", "PBR", "#835f74", "#ffffff", 67],
      ["x5878_155471", "Slavia Praha C", "SLA", "#8ac0df", "#ffffff", 61],
      ["x5878_156011", "Bene\u0161ov", "BEN", "#b2b6ea", "#ffffff", 62],
      ["x5878_156013", "Povltavsk\xE1 fotbalov\xE1 akademie", "POV", "#3f0c27", "#ffffff", 60]
    ]
  },
  {
    id: "x4952",
    name: "Croatian Druga HNL",
    country: "Cro\xE1cia",
    flag: "\u{1F1ED}\u{1F1F7}",
    clubs: [
      ["x4952_141073", "BSK Bijelo Brdo", "BSK", "#6f5ca0", "#ffffff", 56],
      ["x4952_141075", "Croatia Zmijavci", "CRO", "#139062", "#ffffff", 60],
      ["x4952_141076", "Dinamo Zagreb II", "DIN", "#9eb678", "#ffffff", 60],
      ["x4952_141077", "Dubrava", "DUB", "#0b425a", "#ffffff", 58],
      ["x4952_141078", "Dugopolje", "DUG", "#674c45", "#ffffff", 54],
      ["x4952_141081", "Kusto\u0161ija", "KUS", "#87384a", "#ffffff", 55],
      ["x4952_141083", "Opatija", "OPA", "#1887bf", "#ffffff", 60],
      ["x4952_141084", "Orijent", "ORI", "#08bc32", "#ffffff", 54],
      ["x4952_141087", "Sesvete", "SES", "#587d1a", "#ffffff", 59],
      ["x4952_146467", "Vukovar", "VUK", "#2a35e3", "#ffffff", 62],
      ["x4952_152518", "Hrvace", "HRV", "#000000", "#ffffff", 59],
      ["x4952_152519", "Karlovac", "KAR", "#0903bd", "#ffffff", 62],
      ["x4952_155951", "Segesta Sisak", "SEG", "#4681a7", "#ffffff", 56],
      ["x4952_155952", "Jadran Luka Plo\u010De", "JAD", "#e33beb", "#ffffff", 60],
      ["x4952_155953", "Mladost \u017Ddralovi", "MLA", "#28ef82", "#ffffff", 58]
    ]
  },
  {
    id: "x5910",
    name: "Croatian Second Football League",
    country: "Cro\xE1cia",
    flag: "\u{1F1ED}\u{1F1F7}",
    clubs: [
      ["x5910_140105", "Hrvatski Dragovoljac", "HRV", "#cc4f25", "#ffffff", 54],
      ["x5910_141088", "Solin", "SOL", "#60c759", "#ffffff", 58],
      ["x5910_144015", "Lu\u010Dko", "LUK", "#c7d0d5", "#ffffff", 54],
      ["x5910_146377", "Jarun", "JAR", "#a84709", "#ffffff", 58],
      ["x5910_155985", "Bjelovar", "BJE", "#6d0b99", "#ffffff", 62],
      ["x5910_155986", "Dugo Selo", "DUG", "#375e90", "#ffffff", 55],
      ["x5910_155987", "Grobni\u010Dan \u010Cavle", "GRO", "#ebe4b2", "#ffffff", 59],
      ["x5910_155988", "Inker Zapre\u0161i\u0107", "INK", "#037c93", "#ffffff", 62],
      ["x5910_155990", "Radnik Kri\u017Eevci", "RAD", "#d8fb49", "#ffffff", 55],
      ["x5910_155991", "Slavonija Po\u017Eega", "SLA", "#66b7f3", "#ffffff", 57],
      ["x5910_155992", "Trnje Zagreb", "TRN", "#0db6dd", "#ffffff", 61],
      ["x5910_155993", "Uljanik Pula", "ULJ", "#045aae", "#ffffff", 58],
      ["x5910_155994", "Uskok Klis", "USK", "#baa06d", "#ffffff", 62],
      ["x5910_155995", "Varteks Vara\u017Edin", "VAR", "#39002b", "#ffffff", 59]
    ]
  },
  {
    id: "x4965",
    name: "Hungarian NB II",
    country: "Hungria",
    flag: "\u{1F1ED}\u{1F1FA}",
    clubs: [
      ["x4965_138181", "Mez\u0151k\xF6vesd", "MEZ", "#259f3f", "#ffffff", 62],
      ["x4965_141215", "Ajka", "AJK", "#3197ce", "#ffffff", 59],
      ["x4965_141218", "Cs\xE1kv\xE1r", "CSK", "#27175a", "#ffffff", 58],
      ["x4965_141221", "Gyirm\xF3t", "GYI", "#cc521b", "#ffffff", 55],
      ["x4965_141222", "Kazincbarcika", "KAZ", "#fb5d18", "#ffffff", 54],
      ["x4965_141226", "Soroks\xE1r", "SOR", "#a96424", "#ffffff", 62],
      ["x4965_141227", "Szeged-Csan\xE1d", "SZE", "#2f295d", "#ffffff", 60],
      ["x4965_141228", "Szentl\u0151rinc", "SZE", "#ee3be2", "#ffffff", 57],
      ["x4965_142853", "Tiszak\xE9cske", "TIS", "#b43526", "#ffffff", 55],
      ["x4965_142854", "Kecskem\xE9t", "KEC", "#14532a", "#ffffff", 57],
      ["x4965_146466", "Koz\xE1rmisleny", "KOZ", "#62b209", "#ffffff", 55],
      ["x4965_147620", "BVSC-Zugl\xF3", "BVS", "#3b09f1", "#ffffff", 59],
      ["x4965_152526", "Karcag", "KAR", "#d3b59c", "#ffffff", 59],
      ["x4965_155337", "Nagykanizsa", "NAG", "#2960bc", "#ffffff", 61]
    ]
  },
  {
    id: "x4665",
    name: "Romanian Liga II",
    country: "Rom\xEAnia",
    flag: "\u{1F1F7}\u{1F1F4}",
    clubs: [
      ["x4665_138194", "Politehnica Ia\u0219i", "POL", "#1703fe", "#ffffff", 65],
      ["x4665_138195", "Chindia T\xE2rgovi\u0219te", "CHI", "#9bf577", "#ffffff", 65],
      ["x4665_138920", "Re\u0219i\u021Ba", "REI", "#7b45b7", "#ffffff", 63],
      ["x4665_138921", "Concordia Chiajna", "CON", "#10a6a8", "#ffffff", 61],
      ["x4665_138927", "\u0218tiin\u021Ba Poli Timi\u0219oara", "TII", "#e173d2", "#ffffff", 63],
      ["x4665_138931", "Metaloglobus Bucure\u0219ti", "MET", "#e6a62a", "#ffffff", 68],
      ["x4665_140129", "Slatina", "SLA", "#fd2ab6", "#ffffff", 67],
      ["x4665_140131", "Unirea Slobozia", "UNI", "#1d0027", "#ffffff", 65],
      ["x4665_143176", "CSA Steaua Bucure\u015Fti", "CSA", "#5243dd", "#ffffff", 63],
      ["x4665_143179", "1599 \u0218elimb\u0103r", "ELI", "#8565d5", "#ffffff", 64],
      ["x4665_146566", "Dumbr\u0103vi\u0163a", "DUM", "#73192c", "#ffffff", 63],
      ["x4665_149580", "Afuma\u021Bi", "AFU", "#906d1a", "#ffffff", 60],
      ["x4665_149581", "Metalul Buz\u0103u", "MET", "#1d501b", "#ffffff", 66],
      ["x4665_149582", "Bihor Oradea", "BIH", "#532e61", "#ffffff", 61],
      ["x4665_152474", "FC Bac\u0103u", "FCB", "#2c6280", "#ffffff", 63],
      ["x4665_152475", "CS Dinamo Bucure\u0219ti", "CSD", "#5c7b1f", "#ffffff", 64],
      ["x4665_152630", "Olimpia Satu Mare", "OLI", "#e78ffb", "#ffffff", 64],
      ["x4665_152631", "Gloria Bistri\u021Ba", "GLO", "#74aae2", "#ffffff", 65],
      ["x4665_152632", "ASA T\xE2rgu Mure\u0219", "ASA", "#868021", "#ffffff", 61],
      ["x4665_154554", "Cetatea Suceava", "CET", "#8aeaf2", "#ffffff", 63],
      ["x4665_154596", "Pope\u0219ti-Leordeni", "POP", "#159166", "#ffffff", 64],
      ["x4665_154615", "\u0218tef\u0103ne\u0219ti", "TEF", "#14248a", "#ffffff", 68],
      ["x4665_154641", "R\xE2mnicu V\xE2lcea", "RMN", "#de3640", "#ffffff", 60]
    ]
  },
  {
    id: "x5821",
    name: "Romanian Liga III Seria I",
    country: "Rom\xEAnia",
    flag: "\u{1F1F7}\u{1F1F4}",
    clubs: [
      ["x5821_140127", "Aerostar Bac\u0103u", "AER", "#148d43", "#ffffff", 67],
      ["x5821_147628", "Ceahl\u0103ul Piatra Neam\u0163", "CEA", "#f0b84a", "#ffffff", 65],
      ["x5821_154555", "Viitorul One\u0219ti", "VII", "#c00520", "#ffffff", 63],
      ["x5821_154559", "CSM Vaslui", "CSM", "#6f525d", "#ffffff", 67],
      ["x5821_154560", "Odorheiu Secuiesc", "ODO", "#d046cd", "#ffffff", 63],
      ["x5821_154562", "USV Ia\u0219i", "USV", "#579a18", "#ffffff", 63],
      ["x5821_154563", "Adjud", "ADJ", "#ae0394", "#ffffff", 62],
      ["x5821_154564", "Gheorgheni", "GHE", "#98ba38", "#ffffff", 67],
      ["x5821_154565", "FC Bac\u0103u II", "FCB", "#1128fa", "#ffffff", 66],
      ["x5821_154567", "T\xE2rgu Secuiesc", "TRG", "#7f0ed7", "#ffffff", 61],
      ["x5821_156886", "Bradul Putna", "BRA", "#d627a9", "#ffffff", 62],
      ["x5821_156887", "Pa\u0219cani", "PAC", "#21b06c", "#ffffff", 68]
    ]
  },
  {
    id: "x4913",
    name: "Bulgarian Second League",
    country: "Bulg\xE1ria",
    flag: "\u{1F1E7}\u{1F1EC}",
    clubs: [
      ["x4913_137917", "Etar Veliko Tarnovo", "ETA", "#cc2468", "#ffffff", 59],
      ["x4913_140765", "Dobrudzha Dobrich", " ", "#245e9f", "#ffffff", 56],
      ["x4913_140766", "Hebar Pazardzhik", "HEB", "#005af4", "#ffffff", 56],
      ["x4913_140768", "Lokomotiv Gorna Oryahovitsa", "LOK", "#11a54a", "#ffffff", 62],
      ["x4913_140770", "Ludogorets Razgrad II", "LUD", "#dee73f", "#ffffff", 58],
      ["x4913_140773", "Pirin Blagoevgrad", "PIR", "#2a613d", "#ffffff", 59],
      ["x4913_140776", "Sportist Svoge", "SPO", "#543dc3", "#ffffff", 57],
      ["x4913_140778", "Yantra Gabrovo", "YAN", "#093427", "#ffffff", 59],
      ["x4913_142830", "Marek Dupnitsa", "MAR", "#6d1f07", "#ffffff", 57],
      ["x4913_146406", "Spartak Pleven", "SPA", "#2b0209", "#ffffff", 54],
      ["x4913_147433", "Chernomorets 1919 Burgas", "CHE", "#a6b4fc", "#ffffff", 57],
      ["x4913_148490", "Nesebar", "NES", "#340ee6", "#ffffff", 60],
      ["x4913_148491", "Fratria Varna", "FRA", "#608530", "#ffffff", 57],
      ["x4913_148492", "CSKA Sofia II", "CSK", "#efdea8", "#ffffff", 56],
      ["x4913_152573", "Vihren Sandanski", "VIH", "#6811cd", "#ffffff", 58],
      ["x4913_156096", "Rilski Sportist Samokov", "RIL", "#304901", "#ffffff", 61]
    ]
  },
  {
    id: "x5074",
    name: "Serbian Prva Liga",
    country: "S\xE9rvia",
    flag: "\u{1F1F7}\u{1F1F8}",
    clubs: [
      ["x5074_134079", "Borac 1926 \u010Ca\u010Dak", "BOR", "#0c68c8", "#ffffff", 68],
      ["x5074_137861", "Napredak Kru\u0161evac", "NAP", "#49371c", "#ffffff", 62],
      ["x5074_137863", "Javor-Matis Ivanjica", "JAV", "#82eaab", "#ffffff", 63],
      ["x5074_140067", "Metalac Gornji Milanovac", "MET", "#801ece", "#ffffff", 65],
      ["x5074_141831", "Grafi\u010Dar", "GRA", "#860c52", "#ffffff", 66],
      ["x5074_141834", "Loznica", "LOZ", "#bf27f6", "#ffffff", 63],
      ["x5074_146379", "Vr\u0161ac", "VRA", "#f47cb7", "#ffffff", 65],
      ["x5074_147655", "Jedinstvo Ub", "JED", "#280238", "#ffffff", 61],
      ["x5074_147657", "Smederevo 1924", "SME", "#25dafa", "#ffffff", 66],
      ["x5074_152530", "Dinamo Jug", "DIN", "#55bae6", "#ffffff", 67],
      ["x5074_155942", "Naftagas Elemir", "NAF", "#faa211", "#ffffff", 63],
      ["x5074_155943", "Bor 1919", "BOR", "#e2a916", "#ffffff", 63],
      ["x5074_155944", "Teleoptik Zemun", "TEL", "#357365", "#ffffff", 66]
    ]
  },
  {
    id: "x4657",
    name: "Moroccan Botola 2",
    country: "Marrocos",
    flag: "\u{1F1F2}\u{1F1E6}",
    clubs: [
      ["x4657_136406", "KAC Kenitra", "KAC", "#ad8fb9", "#ffffff", 57],
      ["x4657_136411", "Olympique Khouribga", "OLY", "#0633ac", "#ffffff", 58],
      ["x4657_138840", "Wydad de F\xE8s", "WYD", "#0de08e", "#ffffff", 59],
      ["x4657_138841", "Olympique Dcheira", "OLY", "#b013fa", "#ffffff", 59],
      ["x4657_138843", "JS Massira", "JSM", "#25fbb3", "#ffffff", 59],
      ["x4657_138845", "Ittihad Khemisset", "ITT", "#244d40", "#ffffff", 58],
      ["x4657_138849", "JS Soualem", "JSS", "#d75d15", "#ffffff", 54],
      ["x4657_138850", "Chabab Atlas Kh\xE9nifra", "CHA", "#9809ba", "#ffffff", 57],
      ["x4657_138851", "Chabab Ben Guerir", "CHA", "#ab71f4", "#ffffff", 55],
      ["x4657_140802", "Stade Marocain", "STA", "#c9e867", "#ffffff", 61],
      ["x4657_143784", "USM Oujda", "USM", "#18bfa1", "#ffffff", 58],
      ["x4657_149360", "Yacoub El Mansour", "YAC", "#78d566", "#ffffff", 62],
      ["x4657_153102", "US Boujaad", "USB", "#b51734", "#ffffff", 56]
    ]
  },
  {
    id: "x4741",
    name: "Iranian Azadegan League",
    country: "Ir\xE3",
    flag: "\u{1F1EE}\u{1F1F7}",
    clubs: [
      ["x4741_139156", "Pars Jonoubi Jam", "PAR", "#2f4eb9", "#ffffff", 64],
      ["x4741_139160", "Saipa", "SAI", "#4b7afd", "#ffffff", 67],
      ["x4741_139161", "Naft Masjed Soleyman", "NAF", "#2c5f17", "#ffffff", 68],
      ["x4741_139171", "Mes Kerman", "MES", "#8abb42", "#ffffff", 65],
      ["x4741_139176", "Niroye Zamini", "NIR", "#9e2036", "#ffffff", 68],
      ["x4741_146878", "Shahin Bandar Ameri", "SHA", "#3cc62c", "#ffffff", 63],
      ["x4741_149380", "Naft Gachsaran", "NAF", "#f6e8eb", "#ffffff", 61],
      ["x4741_149382", "Ario Eslamshahr", "ARI", "#fd7576", "#ffffff", 60],
      ["x4741_149383", "Be'sat Kermanshah", "BES", "#b991e3", "#ffffff", 64],
      ["x4741_149384", "Kara Gostar", "KAR", "#1ee7e4", "#ffffff", 66],
      ["x4741_149386", "Naft Bandar Abbas", "NAF", "#7485d6", "#ffffff", 67],
      ["x4741_152971", "Fard Alborz", "FAR", "#1724cf", "#ffffff", 64],
      ["x4741_152972", "Shenavarsazi Qeshm", "SHE", "#cf40a8", "#ffffff", 66],
      ["x4741_156885", "Foolad Khuzestan B", "FOO", "#e456d9", "#ffffff", 67]
    ]
  },
  {
    id: "x4797",
    name: "Indian I-League",
    country: "\xCDndia",
    flag: "\u{1F1EE}\u{1F1F3}",
    clubs: [
      ["x4797_139431", "Aizawl", "AIZ", "#e7c2c3", "#ffffff", 65],
      ["x4797_139433", "Gokulam Kerala", "GOK", "#12fbe2", "#ffffff", 62],
      ["x4797_139440", "Real Kashmir", "REA", "#f65f0e", "#ffffff", 67],
      ["x4797_144706", "Rajasthan United", "RAJ", "#c806fb", "#ffffff", 66],
      ["x4797_144707", "Sreenidi Deccan", "SRE", "#f458e6", "#ffffff", 66],
      ["x4797_148043", "Dempo", "DEM", "#56d764", "#ffffff", 66],
      ["x4797_149413", "Namdhari", "NAM", "#98f8ba", "#ffffff", 67],
      ["x4797_149414", "Shillong Lajong", "SHI", "#add386", "#ffffff", 66],
      ["x4797_151727", "Chanmari", "CHA", "#984afd", "#ffffff", 60],
      ["x4797_151728", "Diamond Harbour", "DIA", "#5bee7e", "#ffffff", 61]
    ]
  },
  {
    id: "x4821",
    name: "Indian I-League 2nd Division",
    country: "\xCDndia",
    flag: "\u{1F1EE}\u{1F1F3}",
    clubs: [
      ["x4821_139434", "NEROCA", "NER", "#f63251", "#ffffff", 61],
      ["x4821_139813", "Bengaluru United", "BEN", "#2e62f0", "#ffffff", 68],
      ["x4821_140356", "Sudeva Delhi", "SUD", "#ff05f7", "#ffffff", 67],
      ["x4821_148045", "SC Bengaluru", "SCB", "#974d5e", "#ffffff", 68],
      ["x4821_148046", "Sporting Goa", "SPO", "#a79fab", "#ffffff", 68],
      ["x4821_148047", "United Sports Club", "UNI", "#604944", "#ffffff", 64],
      ["x4821_149415", "Delhi FC", "DEL", "#b0b737", "#ffffff", 61],
      ["x4821_155258", "Karbi Anglong Morning Star", "KAR", "#f6ad90", "#ffffff", 63],
      ["x4821_155259", "MYJ\u2013GMSC", "MYJ", "#561881", "#ffffff", 63]
    ]
  },
  {
    id: "x5214",
    name: "Vietnam V.League 2",
    country: "Vietn\xE3",
    flag: "\u{1F1FB}\u{1F1F3}",
    clubs: [
      ["x5214_139491", "Becamex H\u1ED3 Ch\xED Minh City", "BEC", "#610218", "#ffffff", 62],
      ["x5214_140658", "Quy Nh\u01A1n United", "QUY", "#ce526b", "#ffffff", 54],
      ["x5214_142833", "Kh\xE1nh H\xF2a", "KHN", "#f5813d", "#ffffff", 55],
      ["x5214_142836", "Hu\u1EBF", "HU", "#5dceb3", "#ffffff", 62],
      ["x5214_142838", "Long An", "LON", "#8d5c6c", "#ffffff", 61],
      ["x5214_142839", "PVF-CAND", "PVF", "#9823d8", "#ffffff", 55],
      ["x5214_142842", "H\u1ED3 Ch\xED Minh City", "HCH", "#f69b6c", "#ffffff", 57],
      ["x5214_149374", "Aurora Saigon United", "AUR", "#0ad0d5", "#ffffff", 55],
      ["x5214_153178", "Xu\xE2n Thi\u1EC7n Ph\xFA Th\u1ECD", "XUN", "#698661", "#ffffff", 58],
      ["x5214_153179", "V\u0103n Hi\u1EBFn University", "VNH", "#690fda", "#ffffff", 62],
      ["x5214_153181", "Qu\u1EA3ng Ninh", "QUN", "#c5b86d", "#ffffff", 56],
      ["x5214_156675", "Th\xE1i Nguy\xEAn", "THI", "#512723", "#ffffff", 55],
      ["x5214_156676", "H\u01B0ng Y\xEAn", "HNG", "#6f161e", "#ffffff", 59],
      ["x5214_156677", "L\xE2m \u0110\u1ED3ng", "LMN", "#df6990", "#ffffff", 61]
    ]
  },
  {
    id: "x4789",
    name: "Malaysian Premier League",
    country: "Mal\xE1sia",
    flag: "\u{1F1F2}\u{1F1FE}",
    clubs: [
      ["x4789_139326", "Petaling Jaya City", "PET", "#01735b", "#ffffff", 67],
      ["x4789_139328", "Melaka United", "MEL", "#91808f", "#ffffff", 68],
      ["x4789_139339", "Sarawak United", "SAR", "#a38c2a", "#ffffff", 66],
      ["x4789_139340", "Terengganu City II", "TER", "#33f90b", "#ffffff", 68],
      ["x4789_139344", "UiTM FC", "UIT", "#235d59", "#ffffff", 68],
      ["x4789_139345", "Johor Darul Tazim II", "JOH", "#c73561", "#ffffff", 65],
      ["x4789_140114", "Selangor II", "SEL", "#265d68", "#ffffff", 63],
      ["x4789_140800", "FAM-MSN Squad Project", "FAM", "#26208b", "#ffffff", 62]
    ]
  },
  {
    id: "x4966",
    name: "Israeli Liga Leumit",
    country: "Israel",
    flag: "\u{1F1EE}\u{1F1F1}",
    clubs: [
      ["x4966_134009", "Bnei Yehuda", "BNE", "#9b3eae", "#ffffff", 65],
      ["x4966_135991", "Ashdod", "ASH", "#284358", "#ffffff", 63],
      ["x4966_135996", "Hapoel Kfar Saba", "HAP", "#cb8657", "#ffffff", 65],
      ["x4966_135997", "Hapoel Ra'anana", "HAP", "#1ae7c5", "#ffffff", 67],
      ["x4966_136025", "Hapoel Akko", "HAP", "#1badae", "#ffffff", 68],
      ["x4966_141233", "Hapoel Afula", "HAP", "#140c3f", "#ffffff", 65],
      ["x4966_141236", "Hapoel Kfar Shalem", "HAP", "#c62599", "#ffffff", 66],
      ["x4966_141240", "Hapoel Rishon LeZion", "HAP", "#12edec", "#ffffff", 64],
      ["x4966_141242", "Kafr Qasim", "KAF", "#d7f521", "#ffffff", 66],
      ["x4966_141243", "Maccabi Akhi Nazareth", "MAC", "#cb5503", "#ffffff", 68],
      ["x4966_141801", "Maccabi Bnei Reineh", "MAC", "#23e8cf", "#ffffff", 64],
      ["x4966_145953", "Maccabi Herzliya", "MAC", "#bb7ca8", "#ffffff", 63],
      ["x4966_146402", "Maccabi Kabilio Jaffa", "MAC", "#37b43d", "#ffffff", 67],
      ["x4966_152495", "Ironi Modi'in", "IRO", "#715135", "#ffffff", 67],
      ["x4966_152496", "Hapoel Kiryat Yam", "HAP", "#6812ad", "#ffffff", 61],
      ["x4966_155950", "Maccabi Kiryat Gat", "MAC", "#02f0be", "#ffffff", 63]
    ]
  },
  {
    id: "x5314",
    name: "Slovakian 2 Liga",
    country: "Eslov\xE1quia",
    flag: "\u{1F1F8}\u{1F1F0}",
    clubs: [
      ["x5314_134029", "Inter Bratislava", "INT", "#9c4b80", "#ffffff", 59],
      ["x5314_137870", "Pohronie", "POH", "#18552f", "#ffffff", 54],
      ["x5314_137873", "ViOn Zlat\xE9 Moravce", "VIO", "#8f64e9", "#ffffff", 61],
      ["x5314_141802", "Tatran Liptovsk\xFD Mikul\xE1\u0161", "TAT", "#79c423", "#ffffff", 56],
      ["x5314_146306", "Petr\u017Ealka", "PET", "#000000", "#ffffff", 56],
      ["x5314_146625", "Humenn\xE9", "HUM", "#d8a721", "#ffffff", 62],
      ["x5314_146627", "\u017Dilina B", "ILI", "#21175c", "#ffffff", 59],
      ["x5314_146628", "Pova\u017Esk\xE1 Bystrica", "POV", "#651453", "#ffffff", 59],
      ["x5314_146631", "\u0160amor\xEDn", "AMO", "#ee848e", "#ffffff", 56],
      ["x5314_146633", "Slovan Bratislava B", "SLO", "#a2f830", "#ffffff", 58],
      ["x5314_146635", "Tatran Pre\u0161ov", "TAT", "#0fae1e", "#ffffff", 62],
      ["x5314_147486", "Dynamo Mal\u017Eenice", "DYN", "#8fd019", "#ffffff", 62],
      ["x5314_149032", "Zvolen", "ZVO", "#fb560a", "#ffffff", 61],
      ["x5314_152528", "Ban\xEDk Lehota pod Vt\xE1\u010Dnikom", "BAN", "#ddcca5", "#ffffff", 59],
      ["x5314_156008", "Slovan Galanta", "SLO", "#c7f713", "#ffffff", 62],
      ["x5314_156009", "Byt\u010Da", "BYT", "#6897ce", "#ffffff", 54]
    ]
  },
  {
    id: "x5313",
    name: "Slovenian 2 SNL",
    country: "Eslov\xEAnia",
    flag: "\u{1F1F8}\u{1F1EE}",
    clubs: [
      ["x5313_138215", "Triglav Kranj", "TRI", "#8667ce", "#ffffff", 58],
      ["x5313_138216", "Tabor Se\u017Eana", "TAB", "#c51f4a", "#ffffff", 58],
      ["x5313_138218", "Rudar Velenje", "RUD", "#7678fb", "#ffffff", 60],
      ["x5313_143604", "Krka", "KRK", "#b98ab2", "#ffffff", 58],
      ["x5313_146612", "Beltinci", "BEL", "#302071", "#ffffff", 61],
      ["x5313_146613", "Bilje", "BIL", "#b4c43d", "#ffffff", 56],
      ["x5313_146614", "Bistrica", "BIS", "#f8e734", "#ffffff", 57],
      ["x5313_146616", "Jadran Dekani", "JAD", "#fc4461", "#ffffff", 56],
      ["x5313_146619", "Ilirija", "ILI", "#9c8485", "#ffffff", 62],
      ["x5313_146620", "Kr\u0161ko", "KRK", "#890eac", "#ffffff", 58],
      ["x5313_147443", "Dravinja", "DRA", "#b00c01", "#ffffff", 61],
      ["x5313_148596", "Slovan Ljubljana", "SLO", "#3e5641", "#ffffff", 54],
      ["x5313_151188", "Jesenice", "JES", "#feb2f1", "#ffffff", 57],
      ["x5313_151201", "Bre\u017Eice", "BRE", "#a93b53", "#ffffff", 60],
      ["x5313_151293", "Dren Vrhnika", "DRE", "#ada6ba", "#ffffff", 57]
    ]
  },
  {
    id: "x4963",
    name: "Finnish Ykk\xF6nen",
    country: "Finl\xE2ndia",
    flag: "\u{1F1EB}\u{1F1EE}",
    clubs: [
      ["x4963_134053", "JJK", "JJK", "#0cad48", "#ffffff", 64],
      ["x4963_134606", "RoPS", "ROP", "#79d4b4", "#ffffff", 64],
      ["x4963_137877", "KPV", "KPV", "#66a72a", "#ffffff", 66],
      ["x4963_144686", "Tampere United", "TAM", "#dc295e", "#ffffff", 62],
      ["x4963_147086", "SalPa", "SAL", "#ea5608", "#ffffff", 64],
      ["x4963_148385", "Jazz", "JAZ", "#500afb", "#ffffff", 60],
      ["x4963_148386", "TPV", "TPV", "#29a042", "#ffffff", 68],
      ["x4963_149014", "KuPS II", "KUP", "#c5939e", "#ffffff", 64],
      ["x4963_149015", "OLS", "OLS", "#6af6f7", "#ffffff", 66],
      ["x4963_149016", "PKKU", "PKK", "#deecd0", "#ffffff", 62],
      ["x4963_150691", "Inter Turku II", "INT", "#7ca48b", "#ffffff", 63],
      ["x4963_150696", "VJS", "VJS", "#bbd88f", "#ffffff", 66]
    ]
  },
  {
    id: "x5474",
    name: "Finnish Ykk\xF6sliiga",
    country: "Finl\xE2ndia",
    flag: "\u{1F1EB}\u{1F1EE}",
    clubs: [
      ["x5474_140516", "KTP", "KTP", "#007000", "#ffffff", 64],
      ["x5474_141148", "EIF", "EIF", "#e245af", "#ffffff", 68],
      ["x5474_141150", "JIPPO", "JIP", "#29880b", "#ffffff", 61],
      ["x5474_141151", "Klubi 04", "KLU", "#7faa10", "#ffffff", 63],
      ["x5474_141152", "MP", "MP", "#47ae04", "#ffffff", 66],
      ["x5474_141154", "PK-35", "PK", "#3be7a4", "#ffffff", 63],
      ["x5474_145257", "J\xE4PS", "JPS", "#0d0b68", "#ffffff", 68],
      ["x5474_145259", "SJK Akatemia", "SJK", "#e2d90f", "#ffffff", 65],
      ["x5474_147085", "K\xE4Pa", "KPA", "#c21d18", "#ffffff", 60]
    ]
  },
  {
    id: "x4906",
    name: "Icelandic 1 deild karla",
    country: "Isl\xE2ndia",
    flag: "\u{1F1EE}\u{1F1F8}",
    clubs: [
      ["x4906_137968", "Fylkir", "FYL", "#b01bed", "#ffffff", 60],
      ["x4906_137969", "Grindav\xEDk", "GRI", "#e7a33e", "#ffffff", 61],
      ["x4906_137971", "HK K\xF3pavogur", "HKK", "#9f2361", "#ffffff", 61],
      ["x4906_139968", "Gr\xF3tta", "GRT", "#c9a5e3", "#ffffff", 61],
      ["x4906_140779", "Afturelding", "AFT", "#52d273", "#ffffff", 60],
      ["x4906_140783", "Leiknir Reykjav\xEDk", "LEI", "#d7bebd", "#ffffff", 62],
      ["x4906_140787", "\xDEr\xF3ttur Reykjavik", "RTT", "#8439d0", "#ffffff", 61],
      ["x4906_147055", "Njar\xF0v\xEDk", "NJA", "#f870f5", "#ffffff", 68],
      ["x4906_147883", "\xCDR Reykjav\xEDk", "\xCDR", "#ea0de9", "#ffffff", 60],
      ["x4906_147885", "\xC6gir", "K\xC6", "#60344a", "#ffffff", 61],
      ["x4906_150524", "\xCDF V\xF6lsungur", "FVL", "#0551cb", "#ffffff", 64]
    ]
  },
  {
    id: "x5885",
    name: "Icelandic 2 deild karla",
    country: "Isl\xE2ndia",
    flag: "\u{1F1EE}\u{1F1F8}",
    clubs: [
      ["x5885_139969", "Fj\xF6lnir", "FJL", "#780935", "#ffffff", 58],
      ["x5885_140784", "Selfoss", "SEL", "#81a2b4", "#ffffff", 60],
      ["x5885_140786", "V\xEDkingur \xD3lafsv\xEDk", "VKI", "#ee7fc6", "#ffffff", 57],
      ["x5885_144759", "\xDEr\xF3ttur Vogum", "RTT", "#026032", "#ffffff", 60],
      ["x5885_147884", "Dalv\xEDk/Reynir", "KDR", "#916d15", "#ffffff", 59],
      ["x5885_155577", "K\xE1ri", "KRI", "#b0bc52", "#ffffff", 59],
      ["x5885_155578", "Haukar", "HAU", "#e4d1f5", "#ffffff", 56],
      ["x5885_155579", "Korm\xE1kur/Hv\xF6t", "KOR", "#d0ac1d", "#ffffff", 56],
      ["x5885_155580", "KFA Fjar\xF0abygg\xF0", "KFA", "#856c7c", "#ffffff", 56],
      ["x5885_155581", "KFG Gar\xF0ab\xE6jar", "KFG", "#0ae44d", "#ffffff", 58],
      ["x5885_155582", "Hv\xEDti Riddarinn", "HVT", "#aa00d7", "#ffffff", 55],
      ["x5885_155583", "Magni Greniv\xEDk", "MAG", "#914c98", "#ffffff", 57]
    ]
  },
  {
    id: "x4757",
    name: "Irish First Division",
    country: "Irlanda",
    flag: "\u{1F1EE}\u{1F1EA}",
    clubs: [
      ["x4757_138032", "Finn Harps", "FIN", "#d80c58", "#ffffff", 55],
      ["x4757_139302", "Cobh Ramblers", "COB", "#fa6101", "#ffffff", 59],
      ["x4757_139303", "Athlone Town", "ATH", "#b68ff1", "#ffffff", 60],
      ["x4757_139304", "Wexford", "WEX", "#16ff6f", "#ffffff", 55],
      ["x4757_139306", "Bray Wanderers", "BRA", "#a481e5", "#ffffff", 54],
      ["x4757_139309", "Longford Town", "LON", "#c99783", "#ffffff", 55],
      ["x4757_139319", "UCD", "UCD", "#4fef1d", "#ffffff", 62],
      ["x4757_141165", "Treaty United", "TRE", "#7e55b0", "#ffffff", 58],
      ["x4757_147296", "Kerry", "KER", "#125631", "#ffffff", 55]
    ]
  },
  {
    id: "x5659",
    name: "Venezuelan Segunda Division",
    country: "Venezuela",
    flag: "\u{1F1FB}\u{1F1EA}",
    clubs: [
      ["x5659_137628", "Aragua", "ARA", "#6e719c", "#ffffff", 54],
      ["x5659_137633", "Deportivo Lara", "DEP", "#7fdcd5", "#ffffff", 55],
      ["x5659_137640", "Mineros de Guayana", "MIN", "#b1ab45", "#ffffff", 57],
      ["x5659_138813", "Yaracuyanos", "YAR", "#459652", "#ffffff", 55],
      ["x5659_151955", "Deportivo Miranda", "DEP", "#faf57d", "#ffffff", 60],
      ["x5659_151956", "Mar\xEDtimo de La Guaira", "MAR", "#8fee7c", "#ffffff", 54],
      ["x5659_152512", "Atl\xE9tico El Vig\xEDa", "ATL", "#55cad2", "#ffffff", 60],
      ["x5659_152513", "Academia Puerto Cabello B", "ACA", "#f27277", "#ffffff", 59],
      ["x5659_152514", "Barquisimeto", "BAR", "#24034d", "#ffffff", 57],
      ["x5659_152516", "Real Frontera", "REA", "#b13d2b", "#ffffff", 54],
      ["x5659_152535", "Ure\xF1a", "URE", "#0b543e", "#ffffff", 54],
      ["x5659_152536", "Bol\xEDvar SC", "BOL", "#c502f3", "#ffffff", 62],
      ["x5659_152537", "Dynamo Puerto", "DYN", "#93f532", "#ffffff", 55],
      ["x5659_152538", "Monagas B", "MON", "#26087a", "#ffffff", 55],
      ["x5659_154940", "Atl\xE9tico Barinas", "ATL", "#f3c016", "#ffffff", 56],
      ["x5659_154941", "\xC1vila", "VIL", "#0a3659", "#ffffff", 54],
      ["x5659_154942", "Zamora FC B", "ZAM", "#709e96", "#ffffff", 56]
    ]
  },
  {
    id: "x5743",
    name: "CONMEBOL Liga de Naciones Femenina",
    country: "Venezuela",
    flag: "\u{1F1FB}\u{1F1EA}",
    clubs: [
      ["x5743_136813", "Argentina Women", "ARG", "#0d0cb7", "#ffffff", 65],
      ["x5743_136821", "Chile Women", "CHI", "#ec52da", "#ffffff", 60],
      ["x5743_137433", "Colombia Women", "COL", "#f89072", "#ffffff", 67],
      ["x5743_147890", "Uruguay Women", "URU", "#9ece0e", "#ffffff", 62],
      ["x5743_147891", "Ecuador Women", "ECU", "#423c35", "#ffffff", 63],
      ["x5743_148190", "Paraguay Women", "PAR", "#f140b7", "#ffffff", 66],
      ["x5743_152716", "Venezuela Women", "VEN", "#82e1ff", "#ffffff", 60],
      ["x5743_152717", "Peru Women", "PER", "#b91afb", "#ffffff", 60],
      ["x5743_152718", "Bolivia Women", "BOL", "#756cbd", "#ffffff", 63]
    ]
  },
  {
    id: "x4590",
    name: "English National League",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["x4590_133810", "Scunthorpe United", "SCU", "#a91141", "#ffffff", 56],
      ["x4590_134209", "Southend United", "SOU", "#5d8099", "#ffffff", 56],
      ["x4590_134300", "Yeovil Town", "YEO", "#34d351", "#ffffff", 57],
      ["x4590_134360", "Carlisle United", "CRU", "#2ebca8", "#ffffff", 56],
      ["x4590_134372", "Hartlepool United", "HAR", "#204284", "#ffffff", 56],
      ["x4590_134401", "Aldershot Town", "ALD", "#db1725", "#1d4da0", 54],
      ["x4590_134448", "Kidderminster Harriers", "KID", "#d02424", "#ffffff", 60],
      ["x4590_134486", "Halifax Town", "HAL", "#1767ac", "#2196f3", 57],
      ["x4590_134765", "Gateshead", "GAT", "#e04a09", "#ffffff", 58],
      ["x4590_135901", "Forest Green Rovers", "FGR", "#303881", "#ffffff", 54],
      ["x4590_135959", "Altrincham", "ALT", "#e7000e", "#ffffff", 56],
      ["x4590_135963", "Eastleigh", "EAS", "#042394", "#ffffff", 56],
      ["x4590_135968", "Boreham Wood", "BOR", "#ffffff", "#000000", 56],
      ["x4590_135975", "Wealdstone", "WEA", "#64f101", "#ffffff", 56],
      ["x4590_135977", "AFC Fylde", "AFC", "#ffffff", "#004990", 62],
      ["x4590_135999", "Woking", "WOK", "#92b891", "#ffffff", 59],
      ["x4590_136000", "Barrow", "BRW", "#dcfe83", "#ffffff", 57],
      ["x4590_136002", "Solihull Moors", "SOL", "#209508", "#ffffff", 61],
      ["x4590_136003", "Sutton United", "SUU", "#0fac0c", "#ffffff", 59],
      ["x4590_137534", "Harrogate Town", "HAT", "#bc6c8f", "#ffffff", 55],
      ["x4590_137701", "Boston United", "BOS", "#0f5b92", "#ffffff", 58],
      ["x4590_137950", "Hornchurch", "HOR", "#030e8a", "#ffffff", 60],
      ["x4590_137956", "Worthing", "WOR", "#cb2be3", "#ffffff", 56],
      ["x4590_140380", "Tamworth", "TAM", "#227a7c", "#ffffff", 58]
    ]
  },
  {
    id: "x4695",
    name: "German Regionalliga Nord",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["x4695_138353", "Werder Bremen II", "WER", "#fef0fe", "#ffffff", 61],
      ["x4695_138355", "Hamburg II", "HAM", "#41f2ce", "#ffffff", 57],
      ["x4695_138356", "Hannover 96 II", "HAN", "#474d01", "#ffffff", 55],
      ["x4695_138357", "St Pauli II", "STP", "#891c00", "#ffffff", 57],
      ["x4695_138370", "L\xFCbeck", "LBE", "#9bee1a", "#ffffff", 61],
      ["x4695_138371", "Weiche Flensburg 08", "WEI", "#1c0515", "#ffffff", 56],
      ["x4695_138372", "Eintracht Norderstedt 03", "EIN", "#47d4d6", "#ffffff", 61],
      ["x4695_138373", "Drochtersen/Assel", "DRO", "#74a3dc", "#ffffff", 56],
      ["x4695_138376", "Oldenburg", "OLD", "#3ab0b8", "#ffffff", 56],
      ["x4695_138378", "Jeddeloh II", "JED", "#4d5d66", "#ffffff", 62],
      ["x4695_138381", "HSC Hannover", "HSC", "#b710be", "#ffffff", 62],
      ["x4695_139975", "Atlas Delmenhorst", "ATL", "#8d89d6", "#ffffff", 55],
      ["x4695_140024", "Ph\xF6nix L\xFCbeck", "PHN", "#583920", "#ffffff", 60],
      ["x4695_140216", "Todesfelde", "TOD", "#702df2", "#ffffff", 61],
      ["x4695_142323", "Bremer SV", "BRE", "#19874c", "#ffffff", 61],
      ["x4695_146314", "Kickers Emden", "KIC", "#0a3087", "#ffffff", 60],
      ["x4695_147612", "Eimsb\xFCttel", "EIM", "#015a21", "#ffffff", 58],
      ["x4695_152574", "Sch\xF6ningen", "SCH", "#784d4c", "#ffffff", 60]
    ]
  },
  {
    id: "x4746",
    name: "German Regionalliga West",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["x4746_138359", "K\xF6ln II", "KLN", "#276fe8", "#ffffff", 59],
      ["x4746_138360", "Borussia M\xF6nchengladbach II", "BOR", "#37e295", "#ffffff", 59],
      ["x4746_138361", "Borussia Dortmund II", "BOR", "#84a712", "#ffffff", 56],
      ["x4746_138362", "Schalke 04 II", "SCH", "#afb15e", "#ffffff", 58],
      ["x4746_138398", "R\xF6dinghausen", "RDI", "#ad70a2", "#ffffff", 55],
      ["x4746_138401", "Rot-Wei\xDF Oberhausen", "ROT", "#636aa3", "#ffffff", 61],
      ["x4746_138403", "Sportfreunde Lotte", "SPO", "#9a3a80", "#ffffff", 57],
      ["x4746_138404", "Bonner", "BON", "#b3510b", "#ffffff", 61],
      ["x4746_138409", "Bergisch Gladbach 09", "BER", "#4a994e", "#ffffff", 57],
      ["x4746_139260", "Wattenscheid 09", "WAT", "#0d1fc6", "#ffffff", 58],
      ["x4746_140049", "Wiedenbr\xFCck", "WIE", "#6e27f9", "#ffffff", 55],
      ["x4746_146315", "Bocholt", "BOC", "#ffffff", "#000000", 57],
      ["x4746_147415", "G\xFCtersloh", "GTE", "#33c558", "#ffffff", 58],
      ["x4746_147615", "Paderborn II", "PAD", "#fe0bb6", "#ffffff", 60],
      ["x4746_152577", "Sportfreunde Siegen", "SPO", "#41de54", "#ffffff", 58],
      ["x4746_152578", "Bochum II", "BOC", "#0f63dd", "#ffffff", 56],
      ["x4746_155848", "Hilden", "HIL", "#9e8dde", "#ffffff", 58],
      ["x4746_155857", "Westfalia Rhynern", "WES", "#f4b364", "#ffffff", 58]
    ]
  },
  {
    id: "x5320",
    name: "French National 1 Group A",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["x5320_134718", "Cr\xE9teil", "CRT", "#96577e", "#ffffff", 55],
      ["x5320_137651", "Chambly Oise", "CHA", "#a018c1", "#ffffff", 58],
      ["x5320_138820", "Borgo", "BOR", "#2deca1", "#ffffff", 60],
      ["x5320_138827", "\xC9pinal", "PIN", "#b377de", "#ffffff", 57],
      ["x5320_142576", "Haguenau", "HAG", "#8a7496", "#ffffff", 55],
      ["x5320_142590", "Lusitanos Saint-Maur", "LUS", "#aedf74", "#ffffff", 62],
      ["x5320_142599", "Chantilly", "CHA", "#99b6e7", "#ffffff", 56],
      ["x5320_142605", "Furiani-Agliani", "FUR", "#28d99f", "#ffffff", 59],
      ["x5320_146347", "Saint-Pryv\xE9 Saint-Hilaire", "SAI", "#bee9ce", "#ffffff", 55],
      ["x5320_146352", "SR Colmar", "SRC", "#d5d802", "#ffffff", 61],
      ["x5320_146356", "Racing Club de France", "RAC", "#0d0692", "#ffffff", 57],
      ["x5320_147562", "Biesheim", "BIE", "#9bada0", "#ffffff", 55],
      ["x5320_147565", "Entente Feignies Aulnoye", "ENT", "#dd5d97", "#ffffff", 61],
      ["x5320_147876", "Dieppe", "DIE", "#45edbf", "#ffffff", 58],
      ["x5320_152580", "Montlouis", "MON", "#1a2ae8", "#ffffff", 59],
      ["x5320_154093", "Le Pays du Valois", "LEP", "#6e246c", "#ffffff", 56]
    ]
  }
];
var API_LEAGUES = RAW.map((l) => ({
  id: l.id,
  name: l.name,
  country: l.country,
  flag: l.flag,
  clubs: l.clubs.map(([id, name, short, primary, secondary, strength]) => ({
    id,
    name,
    short,
    league: l.id,
    primary,
    secondary,
    strength
  }))
}));

// src/game/data/leagues-access.ts
var RAW2 = [
  {
    id: "y5079a",
    name: "Brasileir\xE3o S\xE9rie D Grupo A",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["y5079a_134743", "Joinville", "JEC", "#1283fa", "#ffffff", 53],
      ["y5079a_134746", "Am\xE9rica de Natal", "AMR", "#261287", "#ffffff", 53],
      ["y5079a_135663", "Brasil de Pelotas", "BRA", "#0d4b29", "#ffffff", 54],
      ["y5079a_137814", "Ferrovi\xE1rio", "FER", "#d290a8", "#ffffff", 52],
      ["y5079a_137815", "Imperatriz", "IMP", "#479597", "#ffffff", 50],
      ["y5079a_137817", "Manaus", "MAN", "#c142b0", "#ffffff", 53],
      ["y5079a_138058", "S\xE3o Jos\xE9", "SOJ", "#5d164b", "#ffffff", 56],
      ["y5079a_139998", "XV de Novembro", "XVD", "#da2a2e", "#ffffff", 54],
      ["y5079a_142244", "Uberl\xE2ndia", "UBE", "#1ab3f6", "#ffffff", 49],
      ["y5079a_142246", "Aparecidense", "APA", "#1e158d", "#ffffff", 49],
      ["y5079a_142258", "Moto Club", "MOT", "#075970", "#ffffff", 56],
      ["y5079a_142262", "Atl\xE9tico Cearense", "ATL", "#bf3d22", "#ffffff", 49],
      ["y5079a_142266", "Madureira", "MAD", "#7b1b62", "#ffffff", 56],
      ["y5079a_142285", "Marc\xEDlio Dias", "MAR", "#c5b15c", "#ffffff", 54],
      ["y5079a_142294", "Porto Velho", "POR", "#eb226e", "#ffffff", 56],
      ["y5079a_142296", "Retr\xF4", "RET", "#6f1f5f", "#ffffff", 55]
    ]
  },
  {
    id: "y5079b",
    name: "Brasileir\xE3o S\xE9rie D Grupo B",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["y5079b_142914", "Central SC", "CEN", "#142c02", "#ffffff", 49],
      ["y5079b_144961", "Nova Igua\xE7u", "NOV", "#968524", "#ffffff", 49],
      ["y5079b_144962", "Portuguesa-RJ", "POR", "#64ec39", "#ffffff", 49],
      ["y5079b_144971", "Pouso Alegre", "POU", "#517f9d", "#ffffff", 51],
      ["y5079b_144974", "Maric\xE1", "MAR", "#169c09", "#ffffff", 49],
      ["y5079b_145391", "CSE", "CSE", "#8650a6", "#ffffff", 53],
      ["y5079b_145393", "S\xE3o Luiz", "SOL", "#ad7c4c", "#ffffff", 53],
      ["y5079b_147145", "Democrata-GV", "DEM", "#513d50", "#ffffff", 52],
      ["y5079b_147147", "Iguatu", "IGU", "#b36c70", "#ffffff", 53],
      ["y5079b_147309", "CRAC", "CRA", "#1ab0c0", "#ffffff", 50],
      ["y5079b_147315", "Nacional-AM", "NAC", "#d4e232", "#ffffff", 48],
      ["y5079b_148198", "\xC1gua Santa", "GUA", "#f8cbff", "#ffffff", 51],
      ["y5079b_148207", "Manauara", "MAN", "#a77912", "#ffffff", 52],
      ["y5079b_148208", "Maracan\xE3", "MAR", "#9e671a", "#ffffff", 55],
      ["y5079b_150117", "Goiatuba", "GOI", "#7932f5", "#ffffff", 54],
      ["y5079b_150118", "Guarany de Bag\xE9", "GUA", "#18fcc7", "#ffffff", 55]
    ]
  },
  {
    id: "y5079c",
    name: "Brasileir\xE3o S\xE9rie D Grupo C",
    country: "Brasil",
    flag: "\u{1F1E7}\u{1F1F7}",
    clubs: [
      ["y5079c_152619", "Santa Catarina", "SAN", "#aa9540", "#ffffff", 53],
      ["y5079c_152621", "Sampaio Corr\xEAa FE", "SAM", "#4d7fe4", "#ffffff", 54],
      ["y5079c_152623", "Tirol", "TIR", "#9627a6", "#ffffff", 52],
      ["y5079c_152627", "Inhumas", "INH", "#9ffd5e", "#ffffff", 49],
      ["y5079c_152629", "Ouvidorense", "OUV", "#3cfb56", "#ffffff", 54],
      ["y5079c_152633", "IAPE", "IAP", "#60bc18", "#ffffff", 55],
      ["y5079c_152640", "Betim", "BET", "#e832cd", "#ffffff", 50],
      ["y5079c_152654", "Velo Clube", "VEL", "#046a83", "#ffffff", 48],
      ["y5079c_152655", "Noroeste", "NOR", "#0b0007", "#ffffff", 48],
      ["y5079c_152656", "Maguary", "MAG", "#24a55f", "#ffffff", 49],
      ["y5079c_152657", "Decis\xE3o Sert\xE2nia", "DEC", "#ec4836", "#ffffff", 48],
      ["y5079c_152662", "Laguna", "LAG", "#21c671", "#ffffff", 53],
      ["y5079c_152668", "Guapor\xE9", "GUA", "#6108a7", "#ffffff", 51],
      ["y5079c_155256", "America-RJ", "AME", "#e332ac", "#ffffff", 56],
      ["y5079c_155257", "Blumenau", "BEC", "#d0b8a7", "#ffffff", 52]
    ]
  },
  {
    id: "y5340",
    name: "Serie C Girone A",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y5340_133673", "Novara", "NOV", "#171fe9", "#ffffff", 60],
      ["y5340_133860", "Treviso", "TRE", "#a985e9", "#ffffff", 60],
      ["y5340_133972", "Pro Vercelli", "PRO", "#bd400d", "#ffffff", 62],
      ["y5340_134651", "Giana Erminio", "GIA", "#53060c", "#ffffff", 58],
      ["y5340_134652", "Lumezzane", "LUM", "#9b8a44", "#ffffff", 56],
      ["y5340_134653", "Renate", "REN", "#1e3875", "#ffffff", 63],
      ["y5340_134785", "AlbinoLeffe", "ALB", "#b70057", "#ffffff", 63],
      ["y5340_137116", "Lecco", "LEC", "#d1986b", "#ffffff", 57],
      ["y5340_137118", "Pergolettese", "PER", "#7b3fb4", "#ffffff", 59],
      ["y5340_137120", "Juventus Next Gen", "JUV", "#745b5c", "#ffffff", 62],
      ["y5340_137256", "Arzignano Valchiampo", "ARZ", "#47329b", "#ffffff", 60],
      ["y5340_142940", "Folgore Caratese", "FOL", "#52dd8d", "#ffffff", 56],
      ["y5340_142971", "Desenzano", "DES", "#5fe000", "#ffffff", 61],
      ["y5340_143532", "Trento", "TRE", "#818a31", "#ffffff", 60],
      ["y5340_143901", "Dolomiti Bellunesi", "DOL", "#fd4b4b", "#ffffff", 59],
      ["y5340_143905", "Alcione Milano", "ALC", "#99639f", "#ffffff", 59],
      ["y5340_143906", "Carpi", "CAR", "#d7ff64", "#ffffff", 59],
      ["y5340_149237", "Ospitaletto", "OSP", "#09dcab", "#ffffff", 56],
      ["y5340_152839", "Union Brescia", "UNI", "#b11ea9", "#ffffff", 56]
    ]
  },
  {
    id: "y5339",
    name: "Serie C Girone B",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y5339_133685", "Pescara", "PES", "#fb08d0", "#ffffff", 61],
      ["y5339_133694", "Livorno", "LIV", "#1df1b4", "#ffffff", 61],
      ["y5339_133698", "Gubbio", "GUB", "#ebd78f", "#ffffff", 57],
      ["y5339_133880", "Ravenna", "RAV", "#f07533", "#ffffff", 60],
      ["y5339_134233", "Perugia", "PER", "#b31ad8", "#ffffff", 62],
      ["y5339_134404", "Latina", "LAT", "#8dfb9b", "#ffffff", 61],
      ["y5339_134656", "Torres", "TOR", "#9c4874", "#ffffff", 56],
      ["y5339_134671", "Forl\xEC", "FOR", "#c67987", "#ffffff", 61],
      ["y5339_135736", "Sambenedettese", "SAM", "#ac7d32", "#ffffff", 63],
      ["y5339_137117", "Pianese", "PIA", "#c6c8e1", "#ffffff", 58],
      ["y5339_137253", "Vis Pesaro", "VIS", "#3ef13f", "#ffffff", 56],
      ["y5339_138167", "Grosseto", "GRO", "#9748bd", "#ffffff", 56],
      ["y5339_140303", "Pineto", "PIN", "#7d9357", "#ffffff", 58],
      ["y5339_142931", "Vado", "VAD", "#448f31", "#ffffff", 60],
      ["y5339_142983", "Guidonia Montecelio", "GUI", "#453544", "#ffffff", 63],
      ["y5339_143005", "Campobasso", "CAM", "#bad364", "#ffffff", 63],
      ["y5339_143023", "Ostiamare", "OST", "#8fd74d", "#ffffff", 59],
      ["y5339_147679", "Atalanta U23", "ATA", "#0af35c", "#ffffff", 63]
    ]
  },
  {
    id: "y5088",
    name: "Primera Federaci\xF3n Grupo 2",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5088_133815", "H\xE9rcules", "HRC", "#8a98ae", "#ffffff", 64],
      ["y5088_133878", "Real Murcia", "RM", "#cb1a2b", "#ffffff", 57],
      ["y5088_134211", "Gimn\xE0stic", "GIM", "#ce5e44", "#ffffff", 62],
      ["y5088_134485", "Real Madrid Castilla", "REA", "#ffffff", "#00529f", 62],
      ["y5088_134488", "Villarreal B", "VIL", "#005187", "#ffe667", 64],
      ["y5088_134699", "Alcorc\xF3n", "ALC", "#04d9c6", "#ffffff", 64],
      ["y5088_136249", "Rayo Majadahonda", "RAY", "#e9aa17", "#ffffff", 62],
      ["y5088_137446", "Cartagena", "CAR", "#e1e252", "#ffffff", 58],
      ["y5088_137748", "Ibiza", "IBI", "#b5f3ff", "#ffffff", 57],
      ["y5088_137763", "Real Ja\xE9n", "REA", "#36adb2", "#ffffff", 63],
      ["y5088_137820", "Atl\xE9tico Madrile\xF1o", "ATL", "#732ddc", "#ffffff", 58],
      ["y5088_138306", "Algeciras", "ALG", "#958fb7", "#ffffff", 59],
      ["y5088_142536", "Teruel", "TER", "#9cfdb6", "#ffffff", 64],
      ["y5088_144229", "CE Europa", "CEE", "#650764", "#ffffff", 59],
      ["y5088_144237", "Antequera", "ANT", "#1cd49c", "#ffffff", 59],
      ["y5088_144249", "\xC1guilas", "GUI", "#45cc6b", "#ffffff", 59],
      ["y5088_144942", "Sant Andreu", "SAN", "#5ac4b9", "#ffffff", 57],
      ["y5088_146798", "Juventud Torremolinos", "JUV", "#ea6ebb", "#ffffff", 62]
    ]
  },
  {
    id: "y5089",
    name: "Segunda Federaci\xF3n Grupo 2",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5089_134487", "Barcelona Atl\xE8tic", "BAR", "#004d98", "#a50044", 54],
      ["y5089_137747", "Ebro", "EBR", "#f2ba38", "#ffffff", 60],
      ["y5089_138245", "Tudelano", "TUD", "#9aefe0", "#ffffff", 60],
      ["y5089_138246", "Osasuna B", "OSA", "#cf02ed", "#ffffff", 54],
      ["y5089_138279", "Espanyol B", "ESP", "#1727ef", "#ffffff", 56],
      ["y5089_138281", "Olot", "OLO", "#10e6ce", "#ffffff", 53],
      ["y5089_140495", "SD Logro\xF1\xE9s", "SDL", "#917dfb", "#ffffff", 56],
      ["y5089_142539", "Terrassa", "TER", "#46f6de", "#ffffff", 58],
      ["y5089_144220", "Pe\xF1a Sport", "PEA", "#f9005e", "#ffffff", 59],
      ["y5089_144226", "N\xE1xara", "NXA", "#b22270", "#ffffff", 60],
      ["y5089_144227", "UD Logro\xF1\xE9s B", "UDL", "#54ddbd", "#ffffff", 57],
      ["y5089_146791", "Arnedo", "ARN", "#cee8a8", "#ffffff", 55],
      ["y5089_146800", "Manresa", "MAN", "#8bff8f", "#ffffff", 56],
      ["y5089_146803", "Utebo", "UTE", "#9f1b89", "#ffffff", 55],
      ["y5089_147599", "Barbastro", "BAR", "#1843e3", "#ffffff", 56],
      ["y5089_149216", "Girona B", "GIR", "#fabf0d", "#ffffff", 59],
      ["y5089_150225", "Reus FC Reddis", "REU", "#60ed6a", "#ffffff", 53],
      ["y5089_150476", "Calamocha", "CAL", "#bc1a4c", "#ffffff", 57]
    ]
  },
  {
    id: "y5090",
    name: "Segunda Federaci\xF3n Grupo 3",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5090_135679", "UCAM Murcia", "UCA", "#80cd7a", "#ffffff", 56],
      ["y5090_137749", "Yeclano Deportivo", "YEC", "#f63c94", "#ffffff", 57],
      ["y5090_137755", "Orihuela", "ORI", "#886064", "#ffffff", 54],
      ["y5090_137843", "Atl\xE9tico Baleares", "ATL", "#00b379", "#ffffff", 54],
      ["y5090_137844", "Pe\xF1a Deportiva", "PEA", "#985de8", "#ffffff", 52],
      ["y5090_138282", "Valencia Mestalla", "VAL", "#f0d29e", "#ffffff", 55],
      ["y5090_138284", "La Nuc\xEDa", "LAN", "#216878", "#ffffff", 59],
      ["y5090_140497", "Alcoyano", "ALC", "#30af55", "#ffffff", 60],
      ["y5090_140502", "Lorca Deportiva", "LOR", "#9c5050", "#ffffff", 53],
      ["y5090_140505", "Poblense", "POB", "#64e471", "#ffffff", 52],
      ["y5090_144244", "Intercity", "INT", "#8451d3", "#ffffff", 59],
      ["y5090_144986", "Elche Ilicitano", "ELC", "#600115", "#ffffff", 58],
      ["y5090_146799", "Mallorca B", "MAL", "#81adc9", "#ffffff", 56],
      ["y5090_149458", "Deportiva Minera", "DEP", "#9a2f64", "#ffffff", 53],
      ["y5090_150098", "Castell\xF3n B", "CAS", "#aedd0b", "#ffffff", 54],
      ["y5090_150297", "Real Murcia Imperial", "REA", "#a40b90", "#ffffff", 60],
      ["y5090_150336", "Castellonense", "CAS", "#e2c338", "#ffffff", 58],
      ["y5090_150429", "Cieza", "CIE", "#fbb837", "#ffffff", 59]
    ]
  },
  {
    id: "y5091",
    name: "Segunda Federaci\xF3n Grupo 4",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5091_133842", "Xerez", "XER", "#28c6e4", "#ffffff", 52],
      ["y5091_133855", "Recreativo de Huelva", "REC", "#2a1782", "#ffffff", 56],
      ["y5091_135678", "Sevilla Atl\xE9tico", "SEV", "#d0e3ec", "#ffffff", 54],
      ["y5091_137750", "Badajoz", "BAD", "#9c1e8a", "#ffffff", 55],
      ["y5091_137754", "Marbella", "MAR", "#5a184a", "#ffffff", 60],
      ["y5091_137756", "Tamaraceite", "TAM", "#54f22d", "#ffffff", 59],
      ["y5091_137849", "Las Palmas Atl\xE9tico", "LAS", "#c951e1", "#ffffff", 55],
      ["y5091_138303", "Atl\xE9tico Sanluque\xF1o", "ATL", "#6ba232", "#ffffff", 58],
      ["y5091_138304", "Don Benito", "DON", "#a35228", "#ffffff", 53],
      ["y5091_140501", "Linares Deportivo", "LIN", "#e7415c", "#ffffff", 59],
      ["y5091_140503", "Betis Deportivo", "BET", "#c8fcbe", "#ffffff", 60],
      ["y5091_142540", "Ciudad de Lucena", "CIU", "#9603e1", "#ffffff", 53],
      ["y5091_147603", "Atl\xE9tico Antoniano", "ATL", "#385c14", "#ffffff", 60],
      ["y5091_147605", "Estepona", "EST", "#77483b", "#ffffff", 57],
      ["y5091_149459", "Tenerife B", "TEN", "#0d233c", "#ffffff", 59],
      ["y5091_150387", "Mijas-Las Lagunas", "MIJ", "#3e2d2a", "#ffffff", 53],
      ["y5091_150399", "Puente Genil", "PUE", "#02b3e3", "#ffffff", 52],
      ["y5091_150400", "Atl\xE9tico Central", "ATL", "#07e977", "#ffffff", 56]
    ]
  },
  {
    id: "y5092",
    name: "Segunda Federaci\xF3n Grupo 5",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5092_133856", "Numancia", "NUM", "#996c78", "#ffffff", 56],
      ["y5092_137757", "San Sebasti\xE1n de los Reyes", "SAN", "#50c96d", "#ffffff", 54],
      ["y5092_137848", "Getafe B", "GET", "#ed8e36", "#ffffff", 53],
      ["y5092_138247", "Real Valladolid Promesas", "REA", "#fec42d", "#ffffff", 55],
      ["y5092_138249", "Salamanca UDS", "SAL", "#6e2722", "#ffffff", 56],
      ["y5092_138305", "Talavera de la Reina", "TAL", "#146d5d", "#ffffff", 54],
      ["y5092_140504", "Navalcarnero", "NAV", "#852a4e", "#ffffff", 54],
      ["y5092_142537", "Gimn\xE1stica Segoviana", "GIM", "#d8a8f8", "#ffffff", 54],
      ["y5092_144250", "Calvo Sotelo Puertollano", "CAL", "#513135", "#ffffff", 60],
      ["y5092_144987", "Conquense", "CON", "#3355b7", "#ffffff", 59],
      ["y5092_146792", "Atl\xE9tico Paso", "ATL", "#e1d559", "#ffffff", 56],
      ["y5092_149455", "Real \xC1vila", "REA", "#e1c221", "#ffffff", 53],
      ["y5092_149462", "Real Madrid C", "REA", "#906dad", "#ffffff", 56],
      ["y5092_150019", "Atl\xE9tico Albacete", "ATL", "#a54e9b", "#ffffff", 59],
      ["y5092_150349", "Alcal\xE1", "ALC", "#c523b3", "#ffffff", 55],
      ["y5092_150367", "Atl\xE9tico Tordesillas", "ATL", "#94deb6", "#ffffff", 56],
      ["y5092_153127", "Atl\xE9tico Madrid C", "ATL", "#dfaca0", "#ffffff", 59]
    ]
  },
  {
    id: "y5747",
    name: "Campeonato de Portugal",
    country: "Portugal",
    flag: "\u{1F1F5}\u{1F1F9}",
    clubs: [
      ["y5747_143713", "Oliveira do Hospital", "OLI", "#608feb", "#ffffff", 55],
      ["y5747_144669", "F\xE1tima", "FTI", "#3ad5b7", "#ffffff", 56],
      ["y5747_150004", "Benfica e Castelo Branco", "BEN", "#e116d1", "#ffffff", 57],
      ["y5747_150005", "Os Marialvas", "OSM", "#ce4b96", "#ffffff", 56],
      ["y5747_150007", "Mort\xE1gua", "MOR", "#66ba37", "#ffffff", 55],
      ["y5747_150008", "O Elvas", "OEL", "#872ca9", "#ffffff", 53],
      ["y5747_150010", "Sertanense", "SER", "#0d8192", "#ffffff", 50],
      ["y5747_150976", "Uni\xE3o da Serra", "UNI", "#7cc563", "#ffffff", 56],
      ["y5747_153017", "Naval 1893", "NAV", "#47ce7b", "#ffffff", 57],
      ["y5747_153022", "Malveira", "MAL", "#951a61", "#ffffff", 57],
      ["y5747_153036", "Fazendense", "FAZ", "#7c1d88", "#ffffff", 56],
      ["y5747_153040", "Nazarenos", "NAZ", "#482028", "#ffffff", 50],
      ["y5747_153725", "Alverca B", "ALV", "#e53600", "#ffffff", 54],
      ["y5747_156366", "Nogueirense", "NOG", "#f23d62", "#ffffff", 49]
    ]
  },
  {
    id: "y4616a",
    name: "Primera Nacional Grupo A",
    country: "Argentina",
    flag: "\u{1F1E6}\u{1F1F7}",
    clubs: [
      ["y4616a_135153", "Atl\xE9tico de Rafaela", "ATL", "#581716", "#ffffff", 55],
      ["y4616a_135157", "Col\xF3n", "COL", "#148ecc", "#ffffff", 56],
      ["y4616a_135162", "Godoy Cruz", "GOD", "#5e8bc6", "#ffffff", 62],
      ["y4616a_135174", "San Mart\xEDn de San Juan", "SAN", "#638ca7", "#ffffff", 62],
      ["y4616a_135682", "Patronato", "PAT", "#95dab8", "#ffffff", 56],
      ["y4616a_137766", "Mitre", "MIT", "#e1be60", "#ffffff", 60],
      ["y4616a_137767", "Estudiantes de Buenos Aires", "EST", "#dccdef", "#ffffff", 60],
      ["y4616a_137783", "Gimnasia y Esgrima de Jujuy", "GIM", "#eaedea", "#ffffff", 61],
      ["y4616a_141012", "G\xFCemes", "GEM", "#7273e2", "#ffffff", 59],
      ["y4616a_141013", "Deportivo Maip\xFA", "DEP", "#379277", "#ffffff", 54],
      ["y4616a_141014", "San Telmo", "SAN", "#481543", "#ffffff", 62],
      ["y4616a_141015", "Trist\xE1n Su\xE1rez", "TRI", "#de39c2", "#ffffff", 54],
      ["y4616a_142489", "Central Norte", "CEN", "#8f8534", "#ffffff", 59],
      ["y4616a_143087", "Los Andes", "LOS", "#dc2d64", "#ffffff", 62],
      ["y4616a_143091", "Acassuso", "ACA", "#c00725", "#ffffff", 58],
      ["y4616a_143096", "San Miguel", "SAN", "#53a8f5", "#ffffff", 61],
      ["y4616a_144738", "Gimnasia y Tiro", "GIM", "#cd71c8", "#ffffff", 59],
      ["y4616a_144739", "Racing de C\xF3rdoba", "RAC", "#18081b", "#ffffff", 62]
    ]
  },
  {
    id: "y5279a",
    name: "MLS Next Pro Grupo A",
    country: "Estados Unidos",
    flag: "\u{1F1FA}\u{1F1F8}",
    clubs: [
      ["y5279a_138865", "Atlanta United II", "ATL", "#872448", "#ffffff", 54],
      ["y5279a_138866", "Tacoma Defiance", "TAC", "#41f83d", "#ffffff", 53],
      ["y5279a_138868", "New York Red Bulls II", "NEW", "#4ae4d9", "#ffffff", 58],
      ["y5279a_138869", "Sporting Kansas City II", "SPO", "#fed0d7", "#ffffff", 56],
      ["y5279a_138879", "Portland Timbers II", "POR", "#a9f203", "#ffffff", 56],
      ["y5279a_138887", "Ventura County", "VEN", "#623424", "#ffffff", 55],
      ["y5279a_138890", "Real Monarchs", "REA", "#e8615b", "#ffffff", 57],
      ["y5279a_138894", "Philadelphia Union II", "PHI", "#e7f022", "#ffffff", 55],
      ["y5279a_142156", "Toronto FC II", "TOR", "#7055cc", "#ffffff", 59],
      ["y5279a_142162", "Inter Miami II", "INT", "#b5d4b9", "#ffffff", 51],
      ["y5279a_142163", "New England Revolution II", "NEW", "#592fa5", "#ffffff", 51],
      ["y5279a_142164", "North Texas SC", "NOR", "#3b608e", "#ffffff", 56],
      ["y5279a_143566", "Chattanooga FC", "CHA", "#39f25d", "#ffffff", 55],
      ["y5279a_145852", "Orlando City B", "ORL", "#568611", "#ffffff", 52],
      ["y5279a_145854", "Whitecaps FC 2", "WHI", "#3d78d5", "#ffffff", 58]
    ]
  },
  {
    id: "y5279b",
    name: "MLS Next Pro Grupo B",
    country: "Estados Unidos",
    flag: "\u{1F1FA}\u{1F1F8}",
    clubs: [
      ["y5279b_145855", "Colorado Rapids 2", "COL", "#07914e", "#ffffff", 53],
      ["y5279b_145856", "St. Louis City SC 2", "STL", "#747598", "#ffffff", 54],
      ["y5279b_145857", "Columbus Crew 2", "COL", "#d5e832", "#ffffff", 59],
      ["y5279b_145858", "FC Cincinnati 2", "FCC", "#f14058", "#ffffff", 53],
      ["y5279b_145859", "Houston Dynamo 2", "HOU", "#fa9f91", "#ffffff", 56],
      ["y5279b_145860", "Minnesota United FC 2", "MIN", "#b38cd8", "#ffffff", 52],
      ["y5279b_145861", "New York City FC II", "NEW", "#0d609a", "#ffffff", 58],
      ["y5279b_145862", "San Jose Earthquakes II", "SAN", "#123c3c", "#ffffff", 52],
      ["y5279b_147304", "Austin FC II", "AUS", "#4df936", "#ffffff", 57],
      ["y5279b_147305", "Crown Legacy", "CRO", "#6e0642", "#ffffff", 54],
      ["y5279b_147306", "Huntsville City", "HUN", "#bad369", "#ffffff", 57],
      ["y5279b_147307", "Los Angeles FC II", "LOS", "#7d52da", "#ffffff", 57],
      ["y5279b_148111", "Carolina Core", "CAR", "#ba3297", "#ffffff", 55],
      ["y5279b_148112", "Chicago Fire II", "CHI", "#7fb3c0", "#ffffff", 54],
      ["y5279b_154528", "Connecticut United", "CON", "#c017d1", "#ffffff", 53]
    ]
  },
  {
    id: "y4822",
    name: "K League 2",
    country: "Coreia do Sul",
    flag: "\u{1F1F0}\u{1F1F7}",
    clubs: [
      ["y4822_138116", "Suwon Samsung Bluewings", "SUW", "#e37f27", "#ffffff", 58],
      ["y4822_139079", "Gyeongnam FC", "GYE", "#afe781", "#ffffff", 62],
      ["y4822_139784", "Chungnam Asan", "CHU", "#38ed69", "#ffffff", 61],
      ["y4822_139787", "Jeonnam Dragons", "JEO", "#b81e6e", "#ffffff", 62],
      ["y4822_139788", "Seoul E-Land", "SEO", "#13cd94", "#ffffff", 59],
      ["y4822_144995", "Gimpo FC", "GIM", "#9e6ed0", "#ffffff", 59],
      ["y4822_147078", "Chungbuk Cheongju", "CHU", "#05bd4e", "#ffffff", 55],
      ["y4822_150531", "Hwaseong FC", "HWA", "#557654", "#ffffff", 60],
      ["y4822_152158", "Gimhae FC", "GIM", "#08488b", "#ffffff", 55],
      ["y4822_152161", "Paju Frontier", "PAJ", "#5ce5b0", "#ffffff", 55],
      ["y4822_154522", "Yongin FC", "YON", "#905ac2", "#ffffff", 62]
    ]
  },
  {
    id: "y4910",
    name: "Nacional B",
    country: "Bol\xEDvia",
    flag: "\u{1F1E7}\u{1F1F4}",
    clubs: [
      ["y4910_140712", "Deportivo FATIC", "DEP", "#4923af", "#ffffff", 54],
      ["y4910_140714", "Empresa Minera", "EMP", "#b9930a", "#ffffff", 49],
      ["y4910_140721", "Municipal Tiquipaya", "MUN", "#e3dba4", "#ffffff", 52],
      ["y4910_144996", "Universitario de Sucre", "UNI", "#1ac01a", "#ffffff", 49],
      ["y4910_146961", "Wilstermann Cooperativas", "WIL", "#41e404", "#ffffff", 56],
      ["y4910_146969", "Universitario Beni", "UNI", "#f32230", "#ffffff", 52],
      ["y4910_149587", "Universitario de Tarija", "UNI", "#1955c0", "#ffffff", 50],
      ["y4910_149588", "Ciudad Nueva Santa Cruz", "CIU", "#ba9c01", "#ffffff", 54],
      ["y4910_153056", "Primero de Mayo", "PRI", "#1f0a70", "#ffffff", 51],
      ["y4910_153057", "Ingenieros", "ING", "#c82235", "#ffffff", 51],
      ["y4910_153058", "Uni\xF3n Tarija", "UNI", "#a72eb3", "#ffffff", 49],
      ["y4910_153061", "Chaco", "CHA", "#6d72cd", "#ffffff", 54],
      ["y4910_153162", "IN San Juan", "INS", "#40714f", "#ffffff", 54],
      ["y4910_153376", "Guadalajara de Qaqachaca", "GUA", "#db8ffd", "#ffffff", 56],
      ["y4910_156790", "Atl\xE9tico Sucre", "ATL", "#7bac45", "#ffffff", 48],
      ["y4910_156791", "Hiska Nacional", "HIS", "#0e9621", "#ffffff", 50],
      ["y4910_156792", "Independiente CBBA", "IND", "#11c294", "#ffffff", 50],
      ["y4910_156793", "Atl\xE9tico Juniors", "ATL", "#3905c9", "#ffffff", 56],
      ["y4910_156794", "Mineros Potos\xED", "MIN", "#d23160", "#ffffff", 56],
      ["y4910_156795", "Virginia USC", "VIR", "#f1942e", "#ffffff", 48],
      ["y4910_156796", "San Mart\xEDn de Yacuiba", "SAN", "#259a2b", "#ffffff", 52],
      ["y4910_156797", "Deportivo Tigres", "DEP", "#9b4d87", "#ffffff", 49],
      ["y4910_156798", "26 de Febrero", "DEF", "#9f9fac", "#ffffff", 53]
    ]
  },
  {
    id: "y5538",
    name: "Tercera Federaci\xF3n Grupo 1",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5538_144211", "Arenteiro", "ARE", "#ac5a63", "#ffffff", 52],
      ["y5538_147598", "Racing Villalb\xE9s", "RAC", "#e61f88", "#ffffff", 56],
      ["y5538_149134", "Gran Pe\xF1a", "GRA", "#8934d4", "#ffffff", 52],
      ["y5538_150226", "Sarriana", "SAR", "#ec5432", "#ffffff", 49],
      ["y5538_150246", "Alondras", "ALO", "#c206d5", "#ffffff", 49],
      ["y5538_150247", "Atl\xE9tico Arteixo", "ATL", "#e978e8", "#ffffff", 50],
      ["y5538_150251", "Estradense", "EST", "#540393", "#ffffff", 56],
      ["y5538_150252", "Silva", "SIL", "#6f870f", "#ffffff", 55],
      ["y5538_150253", "Somozas", "SOM", "#0986c2", "#ffffff", 53],
      ["y5538_150254", "Viveiro", "VIV", "#29bc90", "#ffffff", 54],
      ["y5538_150255", "Boiro", "BOI", "#a08f26", "#ffffff", 48],
      ["y5538_152233", "Barco", "BAR", "#1c070f", "#ffffff", 52],
      ["y5538_153119", "C\xE9ltiga", "CLT", "#8727bf", "#ffffff", 55],
      ["y5538_153120", "Atl\xE9tico Coru\xF1a Monta\xF1eros", "ATL", "#1bcef5", "#ffffff", 51],
      ["y5538_155954", "Pontevedra B", "PON", "#419949", "#ffffff", 51],
      ["y5538_156499", "Antela", "ANT", "#9abb96", "#ffffff", 49],
      ["y5538_156500", "Lal\xEDn", "LAL", "#c1c148", "#ffffff", 48],
      ["y5538_156501", "Portonovo", "POR", "#716714", "#ffffff", 56]
    ]
  },
  {
    id: "y5539",
    name: "Tercera Federaci\xF3n Grupo 2",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5539_137803", "Sporting Atl\xE9tico", "SPO", "#608a5d", "#ffffff", 55],
      ["y5539_137833", "Langreo", "LAN", "#136dd4", "#ffffff", 48],
      ["y5539_140491", "Covadonga", "COV", "#8ad64d", "#ffffff", 50],
      ["y5539_140492", "Lealtad", "LEA", "#97a02d", "#ffffff", 51],
      ["y5539_144213", "Ceares", "CEA", "#447cb2", "#ffffff", 51],
      ["y5539_149512", "Astur", "AST", "#d2d642", "#ffffff", 49],
      ["y5539_150260", "Avil\xE9s Stadium", "AVI", "#234c85", "#ffffff", 52],
      ["y5539_150262", "Caudal", "CAU", "#4e19d5", "#ffffff", 48],
      ["y5539_150263", "Colunga", "COL", "#83d32f", "#ffffff", 48],
      ["y5539_150264", "Condal", "CON", "#89e807", "#ffffff", 49],
      ["y5539_150265", "L'Entregu", "LEN", "#a4d8d0", "#ffffff", 51],
      ["y5539_150267", "Praviano", "PRA", "#61cb2f", "#ffffff", 51],
      ["y5539_150270", "Mosconia", "MOS", "#277799", "#ffffff", 55],
      ["y5539_150272", "San Mart\xEDn", "SAN", "#077892", "#ffffff", 48],
      ["y5539_152234", "Llanes", "LLA", "#998c7f", "#ffffff", 50],
      ["y5539_152236", "Siero", "SIE", "#5e201b", "#ffffff", 55],
      ["y5539_152467", "Gij\xF3n Industrial", "GIJ", "#6c02c9", "#ffffff", 55],
      ["y5539_156502", "And\xE9s", "AND", "#578e10", "#ffffff", 53]
    ]
  },
  {
    id: "y5540",
    name: "Tercera Federaci\xF3n Grupo 3",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5540_137759", "Escobedo", "ESC", "#52da7b", "#ffffff", 50],
      ["y5540_140493", "Laredo", "LAR", "#e9e4e9", "#ffffff", 51],
      ["y5540_144222", "Tropez\xF3n", "TRO", "#b265b7", "#ffffff", 52],
      ["y5540_144228", "Cay\xF3n", "CAY", "#c44645", "#ffffff", 54],
      ["y5540_149527", "Selaya", "SEL", "#6f6655", "#ffffff", 54],
      ["y5540_150273", "Atl\xE9tico Albericia", "ATL", "#16ca7b", "#ffffff", 49],
      ["y5540_150274", "Atl\xE9tico Mineros", "ATL", "#275f52", "#ffffff", 54],
      ["y5540_150275", "Bezana", "BEZ", "#2a0fd3", "#ffffff", 56],
      ["y5540_150276", "Castro", "CAS", "#a4f6cc", "#ffffff", 55],
      ["y5540_150278", "Guarnizo", "GUA", "#bc6cef", "#ffffff", 53],
      ["y5540_150279", "Revilla", "REV", "#5f9a98", "#ffffff", 55],
      ["y5540_150280", "S\xE1mano", "SMA", "#f38fd9", "#ffffff", 54],
      ["y5540_150282", "Torina", "TOR", "#b560f6", "#ffffff", 48],
      ["y5540_150283", "Vimenor", "VIM", "#d700a9", "#ffffff", 52],
      ["y5540_150284", "Barquere\xF1o", "BAR", "#1e02d7", "#ffffff", 56],
      ["y5540_156071", "Solares-Medio Cudeyo", "SOL", "#f0e8d3", "#ffffff", 55],
      ["y5540_156072", "Velarde", "VEL", "#8e7d86", "#ffffff", 52],
      ["y5540_156497", "Naval Reinosa", "NAV", "#113b2a", "#ffffff", 52]
    ]
  },
  {
    id: "y5541",
    name: "Tercera Federaci\xF3n Grupo 4",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5541_137850", "Leioa", "LEI", "#3d1d01", "#ffffff", 54],
      ["y5541_144223", "Real Sociedad C", "REA", "#a42cec", "#ffffff", 52],
      ["y5541_146793", "Beasain", "BEA", "#492b9e", "#ffffff", 56],
      ["y5541_149513", "Aurrer\xE1 de Vitoria", "AUR", "#4748fe", "#ffffff", 48],
      ["y5541_150288", "Deportivo Alav\xE9s C", "DEP", "#a4e52b", "#ffffff", 50],
      ["y5541_150290", "Eibar Urko", "EIB", "#0518e8", "#ffffff", 56],
      ["y5541_150304", "Cultural Durango", "CUL", "#a2e641", "#ffffff", 49],
      ["y5541_150305", "Derio", "DER", "#1e30c6", "#ffffff", 52],
      ["y5541_150307", "Lagun Onak", "LAG", "#448631", "#ffffff", 51],
      ["y5541_150309", "Pasaia", "PAS", "#c92aa4", "#ffffff", 51],
      ["y5541_150310", "San Ignacio", "SAN", "#b3f491", "#ffffff", 56],
      ["y5541_150311", "Touring", "TOU", "#b4f2c9", "#ffffff", 51],
      ["y5541_150313", "Aretxabaleta", "ARE", "#2ad835", "#ffffff", 48],
      ["y5541_150315", "Santurtzi", "SAN", "#b59f68", "#ffffff", 49],
      ["y5541_156073", "Amurrio", "AMU", "#f2d1a5", "#ffffff", 49],
      ["y5541_156074", "Sodupe", "SOD", "#fa7634", "#ffffff", 48],
      ["y5541_156503", "Erandio", "ERA", "#00397f", "#ffffff", 56],
      ["y5541_156504", "Real Uni\xF3n B", "REA", "#69d89e", "#ffffff", 52]
    ]
  },
  {
    id: "y5542",
    name: "Tercera Federaci\xF3n Grupo 5",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5542_138285", "Cornell\xE0", "COR", "#d23084", "#ffffff", 51],
      ["y5542_140499", "L'Hospitalet", "LHO", "#02e00f", "#ffffff", 50],
      ["y5542_142554", "Monta\xF1esa", "MON", "#83d917", "#ffffff", 52],
      ["y5542_144231", "Cerdanyola del Vall\xE8s", "CER", "#1c676d", "#ffffff", 49],
      ["y5542_150291", "CE Europa B", "CEE", "#cded20", "#ffffff", 49],
      ["y5542_150316", "Badalona", "BAD", "#2ae5e8", "#ffffff", 49],
      ["y5542_150317", "Grama", "GRA", "#189858", "#ffffff", 56],
      ["y5542_150318", "L'Escala", "LES", "#246284", "#ffffff", 53],
      ["y5542_150319", "Mollerussa", "MOL", "#247762", "#ffffff", 48],
      ["y5542_150320", "Peralada", "PER", "#6fe577", "#ffffff", 50],
      ["y5542_150321", "San Crist\xF3bal", "SAN", "#6936f2", "#ffffff", 49],
      ["y5542_150322", "Tona", "TON", "#1c4d47", "#ffffff", 54],
      ["y5542_150323", "Vilassar de Mar", "VIL", "#275f27", "#ffffff", 49],
      ["y5542_150324", "Atl\xE8tic Lleida", "ATL", "#9abd5e", "#ffffff", 52],
      ["y5542_156498", "Pobla de Mafumet", "POB", "#988d7a", "#ffffff", 52],
      ["y5542_156505", "Martinenc", "MAR", "#9337e6", "#ffffff", 55],
      ["y5542_156506", "San Juan Atl\xE9tico de Montcada", "SAN", "#3591de", "#ffffff", 49]
    ]
  },
  {
    id: "y5543",
    name: "Tercera Federaci\xF3n Grupo 6",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5543_138276", "Atl\xE9tico Levante", "ATL", "#4540d9", "#ffffff", 50],
      ["y5543_140498", "Atzeneta", "ATZ", "#c846ef", "#ffffff", 49],
      ["y5543_142559", "Bu\xF1ol", "BUO", "#c1b8e4", "#ffffff", 50],
      ["y5543_146802", "Atl\xE9tico Saguntino", "ATL", "#233da1", "#ffffff", 51],
      ["y5543_147602", "Torrent", "TOR", "#29168a", "#ffffff", 50],
      ["y5543_149510", "Espa\xF1ol de San Vicente", "ESP", "#cbc8e2", "#ffffff", 54],
      ["y5543_150090", "Soneja", "SON", "#328b45", "#ffffff", 49],
      ["y5543_150134", "Villarreal C", "VIL", "#e2cb40", "#ffffff", 51],
      ["y5543_150335", "Athletic Torrellano", "ATH", "#5803ae", "#ffffff", 51],
      ["y5543_150337", "Ontinyent 1931", "ONT", "#f692a3", "#ffffff", 56],
      ["y5543_150340", "Roda", "ROD", "#420fcc", "#ffffff", 51],
      ["y5543_150341", "Utiel", "UTI", "#19d8ab", "#ffffff", 51],
      ["y5543_150342", "Crevillente", "CRE", "#ec42ca", "#ffffff", 50],
      ["y5543_150343", "Vall de Ux\xF3", "VAL", "#47fd2a", "#ffffff", 48],
      ["y5543_152468", "H\xE9rcules B", "HRC", "#b1e064", "#ffffff", 53],
      ["y5543_156507", "Acero", "ACE", "#2a8fe7", "#ffffff", 51],
      ["y5543_156508", "Eldense B", "ELD", "#b7467d", "#ffffff", 48],
      ["y5543_156509", "Torrevieja", "TOR", "#c067a5", "#ffffff", 52]
    ]
  },
  {
    id: "y5544",
    name: "Tercera Federaci\xF3n Grupo 7",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5544_137751", "Fuenlabrada", "FUE", "#d4675c", "#ffffff", 56],
      ["y5544_137846", "Las Rozas", "LAS", "#3dccdb", "#ffffff", 50],
      ["y5544_144215", "Legan\xE9s B", "LEG", "#547620", "#ffffff", 53],
      ["y5544_144216", "M\xF3stoles URJC", "MST", "#cc052b", "#ffffff", 51],
      ["y5544_144217", "Uni\xF3n Adarve", "UNI", "#a5a714", "#ffffff", 52],
      ["y5544_149461", "Colonia Moscard\xF3", "COL", "#d245f3", "#ffffff", 54],
      ["y5544_149523", "Parla Escuela", "PAR", "#a3c2d3", "#ffffff", 48],
      ["y5544_150293", "Rayo Vallecano B", "RAY", "#d9b038", "#ffffff", 55],
      ["y5544_150344", "M\xE9xico FC", "MXI", "#4e7a70", "#ffffff", 56],
      ["y5544_150352", "Galapagar", "GAL", "#dab1dd", "#ffffff", 48],
      ["y5544_150354", "Torrej\xF3n", "TOR", "#98fd40", "#ffffff", 55],
      ["y5544_150356", "Trival Valderas", "TRI", "#242c9a", "#ffffff", 53],
      ["y5544_150358", "Cala Pozuelo", "CAL", "#a7ae96", "#ffffff", 54],
      ["y5544_152469", "Pozuelo de Alarc\xF3n", "POZ", "#6bbb7e", "#ffffff", 50],
      ["y5544_153129", "San Sebasti\xE1n de los Reyes B", "SAN", "#882ab9", "#ffffff", 48],
      ["y5544_153130", "Siello", "SIE", "#01c163", "#ffffff", 49],
      ["y5544_156510", "Rayo Ciudad Alcobendas", "RAY", "#c9d044", "#ffffff", 56],
      ["y5544_156511", "Real Aranjuez", "REA", "#6fff30", "#ffffff", 56]
    ]
  },
  {
    id: "y5545",
    name: "Tercera Federaci\xF3n Grupo 8",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5545_137851", "Guijuelo", "GUI", "#a3409f", "#ffffff", 51],
      ["y5545_142556", "Colegios Diocesanos", "COL", "#2263f7", "#ffffff", 55],
      ["y5545_144218", "Cristo Atl\xE9tico", "CRI", "#e3141e", "#ffffff", 51],
      ["y5545_144224", "Burgos Promesas", "BUR", "#c43193", "#ffffff", 53],
      ["y5545_147596", "Arandina", "ARA", "#cca81e", "#ffffff", 55],
      ["y5545_150294", "Mirand\xE9s B", "MIR", "#b05a09", "#ffffff", 49],
      ["y5545_150364", "Almaz\xE1n", "ALM", "#7de557", "#ffffff", 53],
      ["y5545_150366", "Atl\xE9tico Bembibre", "ATL", "#1e9bd1", "#ffffff", 48],
      ["y5545_150369", "La Virgen del Camino", "LAV", "#9a15cf", "#ffffff", 56],
      ["y5545_150371", "Palencia", "PAL", "#47f337", "#ffffff", 52],
      ["y5545_150372", "Santa Marta", "SAN", "#0eaa07", "#ffffff", 53],
      ["y5545_150373", "Villaralbo", "VIL", "#e2ab29", "#ffffff", 55],
      ["y5545_150374", "Atl\xE9tico Mansill\xE9s", "ATL", "#aa551d", "#ffffff", 49],
      ["y5545_150516", "J\xFApiter Leon\xE9s", "JPI", "#74c8c3", "#ffffff", 56],
      ["y5545_153131", "Unionistas de Salamanca B", "UNI", "#1e663b", "#ffffff", 51],
      ["y5545_156512", "Calasanz", "CAL", "#3dd91c", "#ffffff", 55],
      ["y5545_156513", "Salamanca UDS B", "SAL", "#cfda30", "#ffffff", 54],
      ["y5545_156514", "Tur\xE9gano", "TUR", "#e26319", "#ffffff", 54]
    ]
  },
  {
    id: "y5546",
    name: "Tercera Federaci\xF3n Grupo 9",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5546_137847", "Melilla", "MEL", "#0afca1", "#ffffff", 52],
      ["y5546_138308", "Recreativo Granada", "REC", "#dec83a", "#ffffff", 51],
      ["y5546_144247", "Atl\xE9tico Mancha Real", "ATL", "#61d479", "#ffffff", 49],
      ["y5546_144940", "Almer\xEDa B", "ALM", "#78f7f8", "#ffffff", 52],
      ["y5546_149525", "UD San Pedro", "UDS", "#700188", "#ffffff", 53],
      ["y5546_150378", "Arenas de Armilla", "ARE", "#7250fe", "#ffffff", 51],
      ["y5546_150379", "Atl\xE9tico Malague\xF1o", "ATL", "#410c27", "#ffffff", 50],
      ["y5546_150380", "Ciudad de Torredonjimeno", "CIU", "#a27127", "#ffffff", 49],
      ["y5546_150381", "Atl\xE9tico Porcuna", "ATL", "#3f07bd", "#ffffff", 53],
      ["y5546_150383", "Hu\xE9tor Vega", "HUT", "#c358d1", "#ffffff", 54],
      ["y5546_150384", "M\xE1laga Juniors", "MLA", "#824835", "#ffffff", 53],
      ["y5546_150385", "Marbell\xED", "MAR", "#87cb19", "#ffffff", 54],
      ["y5546_150388", "Motril", "MOT", "#15134c", "#ffffff", 49],
      ["y5546_150390", "Torre del Mar", "TOR", "#90b48b", "#ffffff", 50],
      ["y5546_152471", "Alhaurino", "ALH", "#89f7c0", "#ffffff", 55],
      ["y5546_153132", "Churriana de la Vega", "CHU", "#5105f4", "#ffffff", 54],
      ["y5546_156515", "Atl\xE9tico de Marbella Para\xEDso", "ATL", "#4ee27e", "#ffffff", 53],
      ["y5546_156516", "Cantoria", "CAN", "#6f7ec1", "#ffffff", 55]
    ]
  },
  {
    id: "y5547",
    name: "Tercera Federaci\xF3n Grupo 10",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5547_138288", "Linense", "LIN", "#c46427", "#ffffff", 56],
      ["y5547_138302", "C\xE1diz Mirandilla", "CDI", "#b653ea", "#ffffff", 51],
      ["y5547_142563", "Tomares", "TOM", "#2307e9", "#ffffff", 56],
      ["y5547_144238", "San Roque de Lepe", "SAN", "#89821c", "#ffffff", 48],
      ["y5547_144239", "Xerez Deportivo", "XER", "#4fe692", "#ffffff", 48],
      ["y5547_146804", "Utrera", "UTR", "#416c1c", "#ffffff", 54],
      ["y5547_149516", "Chiclana", "CHI", "#a55d20", "#ffffff", 49],
      ["y5547_150020", "Pozoblanco", "POZ", "#1e821f", "#ffffff", 49],
      ["y5547_150036", "C\xF3rdoba B", "CRD", "#2441ff", "#ffffff", 52],
      ["y5547_150101", "Sevilla C", "SEV", "#e1c40e", "#ffffff", 48],
      ["y5547_150295", "Ceuta B", "CEU", "#04afe5", "#ffffff", 51],
      ["y5547_150393", "Bollullos", "BOL", "#1003c6", "#ffffff", 56],
      ["y5547_150395", "Conil", "CON", "#cb7989", "#ffffff", 48],
      ["y5547_150401", "Atl\xE9tico Onubense", "ATL", "#a17ac3", "#ffffff", 54],
      ["y5547_153134", "Dos Hermanas", "DOS", "#1b085f", "#ffffff", 48],
      ["y5547_156517", "Real Betis C", "REA", "#c36bb6", "#ffffff", 54],
      ["y5547_156518", "Egabrense", "EGA", "#10f061", "#ffffff", 56],
      ["y5547_156519", "Racing Club Portuense", "RAC", "#04b0e1", "#ffffff", 53]
    ]
  },
  {
    id: "y5548",
    name: "Tercera Federaci\xF3n Grupo 11",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5548_142541", "Ibiza Islas Pitiusas", "IBI", "#a7d7ed", "#ffffff", 48],
      ["y5548_142547", "Cardassar", "CAR", "#ab2fd1", "#ffffff", 55],
      ["y5548_144230", "Andratx", "AND", "#cd5cc1", "#ffffff", 50],
      ["y5548_144232", "Formentera", "FOR", "#8516d9", "#ffffff", 49],
      ["y5548_150402", "Alc\xFAdia", "ALC", "#363a77", "#ffffff", 54],
      ["y5548_150403", "Binissalem", "BIN", "#c2f730", "#ffffff", 54],
      ["y5548_150405", "Const\xE0ncia", "CON", "#d8a1c0", "#ffffff", 53],
      ["y5548_150407", "Llosetense", "LLO", "#51587c", "#ffffff", 53],
      ["y5548_150408", "Manacor", "MAN", "#4e6051", "#ffffff", 56],
      ["y5548_150409", "Mercadal", "MER", "#87225f", "#ffffff", 49],
      ["y5548_150410", "Platges de Calvi\xE0", "PLA", "#1af9af", "#ffffff", 56],
      ["y5548_150412", "Santany\xED", "SAN", "#eee1c4", "#ffffff", 48],
      ["y5548_150414", "Migjorn", "MIG", "#24cd50", "#ffffff", 54],
      ["y5548_150415", "Porreres", "POR", "#bb474f", "#ffffff", 55],
      ["y5548_150416", "PE Sant Jordi", "PES", "#00f0ea", "#ffffff", 49],
      ["y5548_152477", "Inter Ibiza", "INT", "#5e31af", "#ffffff", 49],
      ["y5548_156520", "Arenal", "ARE", "#edb033", "#ffffff", 54],
      ["y5548_156521", "Sineu", "SIN", "#bbde2c", "#ffffff", 51]
    ]
  },
  {
    id: "y5549",
    name: "Tercera Federaci\xF3n Grupo 12",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5549_140508", "Marino", "MAR", "#b9720a", "#ffffff", 55],
      ["y5549_144235", "Mensajero", "MEN", "#61ccec", "#ffffff", 55],
      ["y5549_144240", "Panader\xEDa Pulido", "PAN", "#afa04b", "#ffffff", 56],
      ["y5549_144241", "San Fernando", "SAN", "#38af1d", "#ffffff", 51],
      ["y5549_149460", "Uni\xF3n Sur Yaiza", "UNI", "#812719", "#ffffff", 52],
      ["y5549_149511", "Lanzarote", "LAN", "#758e46", "#ffffff", 53],
      ["y5549_149522", "Playas de Sotavento", "PLA", "#5eeb12", "#ffffff", 56],
      ["y5549_150421", "San Bartolom\xE9", "SAN", "#a14da5", "#ffffff", 51],
      ["y5549_150422", "Real Uni\xF3n Tenerife", "REA", "#485245", "#ffffff", 53],
      ["y5549_150423", "Villa de Santa Br\xEDgida", "VIL", "#ba3062", "#ffffff", 56],
      ["y5549_150424", "Estrella CF", "EST", "#cb485c", "#ffffff", 50],
      ["y5549_150425", "Los Llanos de Aridane", "LOS", "#975b6d", "#ffffff", 55],
      ["y5549_152479", "Las Palmas C", "LAS", "#b483e0", "#ffffff", 50],
      ["y5549_153480", "Laguna de Tenerife", "LAG", "#481c44", "#ffffff", 55],
      ["y5549_153482", "Tenerife C", "TEN", "#f97692", "#ffffff", 53],
      ["y5549_155113", "Arc\xE1ngel San Miguel", "ARC", "#c542a4", "#ffffff", 53],
      ["y5549_156522", "A\xF1aza", "AAZ", "#9829da", "#ffffff", 48],
      ["y5549_156523", "Villaverde Norte", "VIL", "#4039a7", "#ffffff", 51]
    ]
  },
  {
    id: "y5550",
    name: "Tercera Federaci\xF3n Grupo 13",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5550_142542", "Atl\xE9tico Pulpile\xF1o", "ATL", "#1ffd3f", "#ffffff", 48],
      ["y5550_146794", "Cartagena B", "CAR", "#194c48", "#ffffff", 53],
      ["y5550_150296", "UCAM Murcia B", "UCA", "#554cc7", "#ffffff", 54],
      ["y5550_150298", "\xC1guilas B", "GUI", "#ccc060", "#ffffff", 55],
      ["y5550_150427", "Alcantarilla", "ALC", "#6c4bc0", "#ffffff", 56],
      ["y5550_150430", "Deportivo Mar\xEDtimo", "DEP", "#60219b", "#ffffff", 56],
      ["y5550_150434", "Uni\xF3n Molinense", "UNI", "#07d571", "#ffffff", 48],
      ["y5550_150435", "Bala Azul", "BAL", "#58472f", "#ffffff", 56],
      ["y5550_150436", "Minerva", "MIN", "#03f27c", "#ffffff", 53],
      ["y5550_150437", "Santomera", "SAN", "#545f74", "#ffffff", 55],
      ["y5550_152481", "Mazarr\xF3n", "MAZ", "#e0beb6", "#ffffff", 56],
      ["y5550_152482", "Ol\xEDmpico de Totana", "OLM", "#125b1a", "#ffffff", 48],
      ["y5550_153137", "Atl\xE9tico Santa Cruz", "ATL", "#9e80d1", "#ffffff", 56],
      ["y5550_153366", "Los Garres", "LOS", "#e7069e", "#ffffff", 54],
      ["y5550_156525", "Algar", "ALG", "#333c3f", "#ffffff", 54],
      ["y5550_156526", "Bullas Deportivo", "BUL", "#c87d1f", "#ffffff", 54],
      ["y5550_156528", "San Javier", "SAN", "#4f1f78", "#ffffff", 50],
      ["y5550_157242", "Cotillas", "COT", "#dfc467", "#ffffff", 50]
    ]
  },
  {
    id: "y5551",
    name: "Tercera Federaci\xF3n Grupo 14",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5551_140507", "Villanovense", "VIL", "#b61043", "#ffffff", 56],
      ["y5551_144242", "Montijo", "MON", "#30db04", "#ffffff", 56],
      ["y5551_147610", "Llerenense", "LLE", "#210243", "#ffffff", 50],
      ["y5551_149518", "G\xE9vora", "GVO", "#791e02", "#ffffff", 53],
      ["y5551_150439", "Atl\xE9tico Pueblonuevo", "ATL", "#8745fa", "#ffffff", 52],
      ["y5551_150440", "Azuaga", "AZU", "#44708a", "#ffffff", 54],
      ["y5551_150442", "Castuera", "CAS", "#bff4dd", "#ffffff", 55],
      ["y5551_150443", "Jara\xEDz", "JAR", "#b586f4", "#ffffff", 50],
      ["y5551_150444", "Jerez", "JER", "#bb1e16", "#ffffff", 50],
      ["y5551_150445", "Moralo", "MOR", "#978cb0", "#ffffff", 50],
      ["y5551_150448", "Villafranca", "VIL", "#ae60bd", "#ffffff", 56],
      ["y5551_150449", "Puebla de la Calzada", "PUE", "#a69195", "#ffffff", 54],
      ["y5551_150450", "Santa Amalia", "SAN", "#95bf78", "#ffffff", 54],
      ["y5551_153139", "Cabeza del Buey", "CAB", "#c746f0", "#ffffff", 52],
      ["y5551_156540", "Guadiana", "GUA", "#b12889", "#ffffff", 51],
      ["y5551_156541", "Plasencia", "PLA", "#8fb2b3", "#ffffff", 56],
      ["y5551_156542", "Quintana", "QUI", "#7daf78", "#ffffff", 49],
      ["y5551_156543", "Zafra", "ZAF", "#8e684f", "#ffffff", 48]
    ]
  },
  {
    id: "y5552",
    name: "Tercera Federaci\xF3n Grupo 15",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5552_138248", "Izarra", "IZA", "#d6a510", "#ffffff", 53],
      ["y5552_140494", "Mutilvera", "MUT", "#1b46cc", "#ffffff", 50],
      ["y5552_142544", "AD San Juan", "ADS", "#8c647f", "#ffffff", 48],
      ["y5552_142549", "Cantolagua", "CAN", "#af2a17", "#ffffff", 53],
      ["y5552_146795", "Cirbonero", "CIR", "#6112d8", "#ffffff", 51],
      ["y5552_147600", "Valle de Eg\xFC\xE9s", "VAL", "#12002b", "#ffffff", 54],
      ["y5552_149508", "Cortes", "COR", "#52bbae", "#ffffff", 52],
      ["y5552_150038", "Subiza", "SUB", "#51bfbb", "#ffffff", 54],
      ["y5552_150451", "Beti Kozkor", "BET", "#393f09", "#ffffff", 52],
      ["y5552_150452", "Beti Onak", "BET", "#a0875f", "#ffffff", 51],
      ["y5552_150453", "Bidezarra", "BID", "#5c31bf", "#ffffff", 55],
      ["y5552_150455", "Huarte", "HUA", "#3c4252", "#ffffff", 48],
      ["y5552_150456", "Pamplona", "PAM", "#c166ec", "#ffffff", 51],
      ["y5552_150457", "Txantrea", "TXA", "#28683e", "#ffffff", 54],
      ["y5552_152484", "Avance Ezcabarte", "AVA", "#9adaf2", "#ffffff", 52],
      ["y5552_153140", "Aoiz", "AOI", "#7e5b80", "#ffffff", 55],
      ["y5552_156544", "Doneztebe", "DON", "#0085c7", "#ffffff", 53],
      ["y5552_156545", "Gazte Berriak", "GAZ", "#f3e863", "#ffffff", 50]
    ]
  },
  {
    id: "y5553",
    name: "Tercera Federaci\xF3n Grupo 16",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5553_137744", "Haro Deportivo", "HAR", "#aa4e1f", "#ffffff", 52],
      ["y5553_138242", "Calahorra", "CAL", "#f79c19", "#ffffff", 48],
      ["y5553_142545", "Varea", "VAR", "#d476d4", "#ffffff", 50],
      ["y5553_146790", "Alfaro", "ALF", "#758182", "#ffffff", 50],
      ["y5553_149457", "Anguiano", "ANG", "#0bb5d8", "#ffffff", 52],
      ["y5553_150461", "Atl\xE9tico Vian\xE9s", "ATL", "#053e15", "#ffffff", 53],
      ["y5553_150462", "Berceo", "BER", "#48453a", "#ffffff", 48],
      ["y5553_150463", "Casalarreina", "CAS", "#9f236a", "#ffffff", 50],
      ["y5553_150464", "Comillas", "COM", "#c116a7", "#ffffff", 56],
      ["y5553_150465", "La Calzada", "LAC", "#f5b70e", "#ffffff", 51],
      ["y5553_150466", "Oyonesa", "OYO", "#dc018e", "#ffffff", 48],
      ["y5553_150468", "River Ebro", "RIV", "#25873b", "#ffffff", 54],
      ["y5553_150470", "Agoncillo", "AGO", "#850851", "#ffffff", 54],
      ["y5553_150472", "Yag\xFCe", "YAG", "#9c7221", "#ffffff", 56],
      ["y5553_152486", "Pradej\xF3n", "PRA", "#7224c9", "#ffffff", 51],
      ["y5553_153142", "San Marcial", "SAN", "#e65d67", "#ffffff", 53],
      ["y5553_156546", "Calasancio", "CAL", "#2e14db", "#ffffff", 54],
      ["y5553_156547", "Cenicero", "CEN", "#a6ac6f", "#ffffff", 52]
    ]
  },
  {
    id: "y5554",
    name: "Tercera Federaci\xF3n Grupo 17",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5554_138278", "Ejea", "EJE", "#93cd96", "#ffffff", 48],
      ["y5554_142551", "\xC9pila", "PIL", "#cfb821", "#ffffff", 48],
      ["y5554_144233", "Brea", "BRE", "#5d3862", "#ffffff", 56],
      ["y5554_144234", "Huesca B", "HUE", "#75a952", "#ffffff", 48],
      ["y5554_146801", "Deportivo Arag\xF3n", "DEP", "#f85239", "#ffffff", 56],
      ["y5554_149509", "Cuarte", "CUA", "#1f11a3", "#ffffff", 52],
      ["y5554_150133", "Atl\xE9tico Monz\xF3n", "ATL", "#795630", "#ffffff", 56],
      ["y5554_150473", "Almud\xE9var", "ALM", "#b84e1f", "#ffffff", 53],
      ["y5554_150474", "Belchite 97", "BEL", "#2386df", "#ffffff", 49],
      ["y5554_150475", "Bin\xE9far", "BIN", "#53cedd", "#ffffff", 55],
      ["y5554_150477", "Caspe", "CAS", "#a4f384", "#ffffff", 54],
      ["y5554_150478", "Fraga", "FRA", "#6c5a9a", "#ffffff", 56],
      ["y5554_150480", "Tamarite", "TAM", "#05be07", "#ffffff", 48],
      ["y5554_150482", "Andorra CF", "AND", "#a1cd18", "#ffffff", 48],
      ["y5554_150483", "La Almunia", "LAA", "#60449f", "#ffffff", 51],
      ["y5554_152489", "Illueca", "ILL", "#3dc6f5", "#ffffff", 53],
      ["y5554_152490", "Robres", "ROB", "#240ed4", "#ffffff", 50],
      ["y5554_156548", "Internacional Huesca", "INT", "#4b4fa7", "#ffffff", 50]
    ]
  },
  {
    id: "y5555",
    name: "Tercera Federaci\xF3n Grupo 18",
    country: "Espanha",
    flag: "\u{1F1EA}\u{1F1F8}",
    clubs: [
      ["y5555_138287", "Villarrobledo", "VIL", "#d75f9b", "#ffffff", 49],
      ["y5555_138307", "Villarrubia", "VIL", "#cf8629", "#ffffff", 54],
      ["y5555_140506", "Socu\xE9llamos", "SOC", "#dcd073", "#ffffff", 51],
      ["y5555_142546", "Quintanar del Rey", "QUI", "#7356bc", "#ffffff", 51],
      ["y5555_142552", "Marchamalo", "MAR", "#b57ca1", "#ffffff", 52],
      ["y5555_144251", "Toledo", "TOL", "#fea512", "#ffffff", 54],
      ["y5555_147608", "Manchego Ciudad Real", "MAN", "#c3239b", "#ffffff", 56],
      ["y5555_147609", "Illescas", "ILL", "#86cba5", "#ffffff", 51],
      ["y5555_150487", "Hurac\xE1n Balazote", "HUR", "#e0b467", "#ffffff", 49],
      ["y5555_150488", "Taranc\xF3n", "TAR", "#93d2cd", "#ffffff", 53],
      ["y5555_150489", "Villaca\xF1as", "VIL", "#6809cb", "#ffffff", 56],
      ["y5555_150491", "Noblejas", "NOB", "#5495d6", "#ffffff", 50],
      ["y5555_152491", "La Solana", "LAS", "#024b22", "#ffffff", 48],
      ["y5555_152492", "San Clemente", "SAN", "#0b9ce4", "#ffffff", 53],
      ["y5555_153161", "Guadalajara B", "GUA", "#c00f5c", "#ffffff", 48],
      ["y5555_156549", "Almansa", "ALM", "#de5876", "#ffffff", 50],
      ["y5555_156550", "Torrijos", "TOR", "#3bbf13", "#ffffff", 48],
      ["y5555_156551", "Villa", "VIL", "#1a7dc0", "#ffffff", 53]
    ]
  },
  {
    id: "y4747",
    name: "Regionalliga S\xFCdwest",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y4747_134689", "Aalen", "AAL", "#9f43dc", "#ffffff", 54],
      ["y4747_134691", "Sandhausen", "SAN", "#305fbd", "#ffffff", 56],
      ["y4747_134692", "FSV Frankfurt", "FSV", "#e69c1f", "#ffffff", 59],
      ["y4747_138364", "Mainz II", "MAI", "#29b7a2", "#ffffff", 52],
      ["y4747_138366", "Freiburg II", "FRE", "#218381", "#ffffff", 53],
      ["y4747_138412", "Steinbach Haiger", "STE", "#60a9b8", "#ffffff", 59],
      ["y4747_138413", "Homburg", "HOM", "#efbd77", "#ffffff", 56],
      ["y4747_138414", "Ulm", "ULM", "#9dc859", "#ffffff", 54],
      ["y4747_138415", "Astoria Walldorf", "AST", "#52d3d8", "#ffffff", 58],
      ["y4747_138417", "Kickers Offenbach", "KIC", "#254b8d", "#ffffff", 52],
      ["y4747_140009", "Eintracht Trier", "EIN", "#9b7905", "#ffffff", 59],
      ["y4747_140054", "Hessen Kassel", "HES", "#0eb0b2", "#ffffff", 53],
      ["y4747_140088", "Stuttgarter Kickers", "STU", "#1eea45", "#ffffff", 54],
      ["y4747_146316", "SGV Freiberg", "SGV", "#2dcc37", "#ffffff", 55],
      ["y4747_146317", "Barockstadt Fulda-Lehnerz", "BAR", "#6a9026", "#ffffff", 52],
      ["y4747_147617", "Eintracht Frankfurt II", "EIN", "#d8f8a5", "#ffffff", 55],
      ["y4747_155609", "Mannheim", "MAN", "#3e80a6", "#ffffff", 55],
      ["y4747_155892", "Kaiserslautern II", "KAI", "#a624a1", "#ffffff", 60]
    ]
  },
  {
    id: "y4748",
    name: "Regionalliga Bayern",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y4748_134242", "1860 Munich", "MUN", "#f1e96e", "#ffffff", 60],
      ["y4748_134268", "Unterhaching", "UNT", "#5aeca9", "#ffffff", 60],
      ["y4748_137964", "Bayern Munich II", "BAY", "#ede9ee", "#ffffff", 52],
      ["y4748_138367", "N\xFCrnberg II", "NRN", "#2a0460", "#ffffff", 55],
      ["y4748_138368", "Greuther F\xFCrth II", "GRE", "#4e2171", "#ffffff", 60],
      ["y4748_138369", "Augsburg II", "AUG", "#16c196", "#ffffff", 55],
      ["y4748_138424", "Schweinfurt", "SCH", "#7f947c", "#ffffff", 58],
      ["y4748_138425", "Bayreuth", "BAY", "#b7a3f8", "#ffffff", 56],
      ["y4748_138427", "Eichst\xE4tt", "EIC", "#3c564b", "#ffffff", 60],
      ["y4748_138428", "Buchbach", "BUC", "#06574b", "#ffffff", 58],
      ["y4748_138429", "Aubstadt", "AUB", "#8f9217", "#ffffff", 54],
      ["y4748_138430", "Illertissen", "ILL", "#98cfad", "#ffffff", 54],
      ["y4748_138432", "Wacker Burghausen", "WAC", "#1d062a", "#ffffff", 52],
      ["y4748_138436", "Memmingen", "MEM", "#e82c1f", "#ffffff", 53],
      ["y4748_140556", "Schwaben Augsburg", "SCH", "#29e697", "#ffffff", 56],
      ["y4748_142916", "Eltersdorf", "ELT", "#7b3584", "#ffffff", 56],
      ["y4748_146319", "Ansbach 09", "ANS", "#e881b4", "#ffffff", 52],
      ["y4748_146320", "Vilzing", "VIL", "#729a5a", "#ffffff", 52],
      ["y4748_155715", "Landsberg", "LAN", "#763342", "#ffffff", 58]
    ]
  },
  {
    id: "y4749",
    name: "Regionalliga Nordost",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y4749_134445", "Erzgebirge Aue", "ERZ", "#fc39fb", "#ffffff", 59],
      ["y4749_137957", "Chemnitzer", "CHE", "#7172e7", "#ffffff", 58],
      ["y4749_137959", "Hallescher", "HAL", "#7fb53c", "#ffffff", 55],
      ["y4749_137960", "Carl Zeiss Jena", "CAR", "#95c89a", "#ffffff", 60],
      ["y4749_137967", "Zwickau", "ZWI", "#0becb1", "#ffffff", 55],
      ["y4749_138358", "Hertha II", "HER", "#7a85c0", "#ffffff", 60],
      ["y4749_138382", "Lokomotive Leipzig", "LOK", "#d74d11", "#ffffff", 57],
      ["y4749_138383", "Altglienicke", "ALT", "#7a83b3", "#ffffff", 53],
      ["y4749_138384", "Berliner FC Dynamo", "BER", "#46ca9b", "#ffffff", 59],
      ["y4749_138392", "Chemie Leipzig", "CHE", "#f94de0", "#ffffff", 55],
      ["y4749_138393", "Rot-Wei\xDF Erfurt", "ROT", "#570054", "#ffffff", 53],
      ["y4749_138396", "Babelsberg 03", "BAB", "#238340", "#ffffff", 52],
      ["y4749_140012", "Tasmania Berlin", "TAS", "#ae313f", "#ffffff", 54],
      ["y4749_140046", "Luckenwalde", "LUC", "#22349f", "#ffffff", 58],
      ["y4749_142325", "Greifswalder", "GRE", "#eb4df3", "#ffffff", 60],
      ["y4749_152266", "RSV Eintracht", "RSV", "#004181", "#ffffff", 52],
      ["y4749_152575", "BFC Preussen", "BFC", "#690e77", "#ffffff", 56],
      ["y4749_152576", "Magdeburg II", "MAG", "#64718d", "#ffffff", 55]
    ]
  },
  {
    id: "y5321",
    name: "National 1 Grupo B",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5321_137671", "Aviron Bayonnais", "AVI", "#708798", "#ffffff", 54],
      ["y5321_137673", "Granville", "GRA", "#7b7549", "#ffffff", 54],
      ["y5321_137675", "Stade Briochin", "STA", "#1f9004", "#ffffff", 59],
      ["y5321_138819", "Avranches", "AVR", "#5e032d", "#ffffff", 52],
      ["y5321_141332", "Voltigeurs de Ch\xE2teaubriant", "VOL", "#adada3", "#ffffff", 51],
      ["y5321_141333", "Olympique Saumur", "OLY", "#ee79ac", "#ffffff", 51],
      ["y5321_142568", "Les Herbiers", "LES", "#6c3b88", "#ffffff", 55],
      ["y5321_142587", "Saint-Malo", "SAI", "#c66e78", "#ffffff", 57],
      ["y5321_142613", "Saint-Colomban Locmin\xE9", "SAI", "#e23461", "#ffffff", 55],
      ["y5321_142629", "Dinan-L\xE9hon", "DIN", "#f876df", "#ffffff", 59],
      ["y5321_146322", "Angoul\xEAme Charente", "ANG", "#bb6fba", "#ffffff", 52],
      ["y5321_146335", "Lorient II", "LOR", "#30c4fc", "#ffffff", 51],
      ["y5321_149127", "Vend\xE9e Poir\xE9-sur-Vie", "VPF", "#003a7c", "#62c5ee", 57],
      ["y5321_152579", "Chauray", "CHA", "#f3346d", "#ffffff", 52],
      ["y5321_153861", "GSI Pontivy", "GSI", "#cf3794", "#ffffff", 56],
      ["y5321_154069", "Tarbes", "TAR", "#2cf05a", "#ffffff", 51]
    ]
  },
  {
    id: "y5322",
    name: "National 1 Grupo C",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5322_134235", "Istres", "IST", "#a708ce", "#ffffff", 53],
      ["y5322_134710", "Ch\xE2teauroux", "CHT", "#09b3d6", "#ffffff", 59],
      ["y5322_134715", "N\xEEmes Olympique", "NME", "#1eab31", "#ffffff", 59],
      ["y5322_138457", "Toulon", "TOU", "#06aab1", "#ffffff", 52],
      ["y5322_138822", "Lyon - La Duch\xE8re", "LYO", "#d39ac7", "#ffffff", 53],
      ["y5322_140000", "Limonest Saint-Didier", "LIM", "#e7630d", "#ffffff", 54],
      ["y5322_141330", "Canet Roussillon", "CAN", "#f1d24f", "#ffffff", 52],
      ["y5322_141331", "Rumilly-Valli\xE8res", "RUM", "#43b18a", "#ffffff", 54],
      ["y5322_142570", "Andr\xE9zieux-Bouth\xE9on", "AND", "#b1fd54", "#ffffff", 57],
      ["y5322_142623", "Saint-Priest", "SAI", "#a9dd71", "#ffffff", 56],
      ["y5322_146325", "Bourges Foot 18", "BOU", "#66c532", "#ffffff", 58],
      ["y5322_146328", "GOAL FC", "GOA", "#2fe544", "#ffffff", 57],
      ["y5322_146330", "Fr\xE9jus Saint-Rapha\xEBl", "FRJ", "#dd6315", "#ffffff", 59],
      ["y5322_146333", "Hy\xE8res", "HYR", "#ae724a", "#ffffff", 54],
      ["y5322_149686", "Hauts Lyonnais", "HAU", "#72c9ec", "#ffffff", 54],
      ["y5322_154095", "Troyes II", "TRO", "#da099f", "#ffffff", 58]
    ]
  },
  {
    id: "y4681",
    name: "National League North",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4681_134369", "Morecambe", "MRC", "#db1dc6", "#ffffff", 52],
      ["y4681_134706", "Chester", "CHE", "#45544d", "#ffffff", 52],
      ["y4681_134770", "Southport", "SOU", "#23c477", "#ffffff", 57],
      ["y4681_135966", "Brackley Town", "BRA", "#8bfb5e", "#ffffff", 57],
      ["y4681_136007", "Spennymoor Town", "SPE", "#415e79", "#ffffff", 58],
      ["y4681_136144", "Hereford", "HER", "#1ac3d8", "#ffffff", 55],
      ["y4681_136147", "Oxford City", "OXF", "#fa3b87", "#ffffff", 58],
      ["y4681_136149", "Chorley", "CHO", "#04f3c9", "#ffffff", 57],
      ["y4681_136153", "AFC Telford United", "AFC", "#6e2e6f", "#ffffff", 58],
      ["y4681_137480", "Darlington", "DAR", "#34ff62", "#ffffff", 56],
      ["y4681_137881", "Buxton", "BUX", "#6c5556", "#ffffff", 51],
      ["y4681_137886", "Radcliffe", "RAD", "#199995", "#ffffff", 57],
      ["y4681_137887", "Scarborough Athletic", "SCA", "#0a5f91", "#ffffff", 51],
      ["y4681_137888", "South Shields", "SOU", "#13ae05", "#ffffff", 56],
      ["y4681_138015", "King's Lynn Town", "KIN", "#e64f2f", "#ffffff", 57],
      ["y4681_138238", "Merthyr Town", "MER", "#9861b3", "#ffffff", 55],
      ["y4681_140200", "Worksop Town", "WOR", "#716e79", "#ffffff", 59],
      ["y4681_140378", "Hednesford Town", "HED", "#4de061", "#ffffff", 55],
      ["y4681_140385", "Marine", "MAR", "#2bef19", "#ffffff", 52],
      ["y4681_145171", "Bedford Town", "BED", "#632852", "#ffffff", 53],
      ["y4681_145207", "Spalding United", "SPA", "#e1a0fb", "#ffffff", 57],
      ["y4681_145234", "Hebburn Town", "HEB", "#26785a", "#ffffff", 57],
      ["y4681_146305", "Macclesfield", "MAC", "#18345e", "#f7e300", 55],
      ["y4681_146607", "Harborough Town", "HAR", "#f594a9", "#ffffff", 53]
    ]
  },
  {
    id: "y4682",
    name: "National League South",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4682_134356", "Dagenham and Redbridge", "DAG", "#ed251b", "#111d6e", 52],
      ["y4682_134380", "Torquay United", "TOR", "#ad568d", "#ffffff", 52],
      ["y4682_134774", "Dover Athletic", "DOV", "#40a06f", "#ffffff", 55],
      ["y4682_135961", "Chesham United", "CHE", "#dbddb6", "#ffffff", 55],
      ["y4682_135965", "Maidenhead United", "MAI", "#231f20", "#ffffff", 54],
      ["y4682_135967", "Braintree Town", "BRA", "#fbc6f7", "#ffffff", 57],
      ["y4682_135971", "Maidstone United", "MAI", "#d522fa", "#ffffff", 57],
      ["y4682_136145", "Slough Town", "SLO", "#491212", "#ffffff", 59],
      ["y4682_136148", "Billericay Town", "BIL", "#84bafd", "#ffffff", 51],
      ["y4682_136150", "Truro City", "TRU", "#a7745a", "#ffffff", 53],
      ["y4682_136152", "Ebbsfleet United", "EBB", "#c00d0d", "#ffffff", 59],
      ["y4682_136154", "Chelmsford City", "CHE", "#1427b9", "#ffffff", 55],
      ["y4682_136258", "Weston-super-Mare", "WES", "#e3c411", "#ffffff", 55],
      ["y4682_136261", "Hemel Hempstead Town", "HEM", "#a6cf45", "#ffffff", 56],
      ["y4682_136672", "Hampton and Richmond Borough", "HAM", "#e04b6a", "#ffffff", 58],
      ["y4682_137949", "Folkestone Invicta", "FOL", "#014475", "#ffffff", 57],
      ["y4682_137951", "Horsham", "HOR", "#633d39", "#ffffff", 59],
      ["y4682_138020", "Dorking Wanderers", "DOR", "#e40a20", "#ffffff", 57],
      ["y4682_138024", "Tonbridge Angels", "TON", "#9ac33a", "#ffffff", 52],
      ["y4682_138025", "Salisbury", "SAL", "#7beff3", "#ffffff", 57],
      ["y4682_138028", "Farnborough", "FAR", "#21b7f9", "#ffffff", 56],
      ["y4682_145168", "AFC Totton", "AFC", "#492907", "#ffffff", 52],
      ["y4682_146591", "Walton and Hersham", "WAL", "#720fcc", "#ffffff", 54],
      ["y4682_148816", "Farnham Town", "FAR", "#cc2c8b", "#ffffff", 54]
    ]
  },
  {
    id: "y4646",
    name: "Northern Premier League",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4646_134359", "Bury", "BUR", "#d36544", "#ffffff", 56],
      ["y4646_134410", "Ashton United", "ASH", "#af8222", "#ffffff", 54],
      ["y4646_134631", "Alfreton Town", "ALF", "#304abe", "#ffffff", 53],
      ["y4646_135969", "FC United of Manchester", "FCU", "#c85d79", "#ffffff", 53],
      ["y4646_135970", "Gainsborough Trinity", "GAI", "#c4f5f3", "#ffffff", 56],
      ["y4646_136001", "Curzon Ashton", "CUR", "#532e24", "#ffffff", 51],
      ["y4646_136034", "Guiseley", "GUI", "#a32fad", "#ffffff", 57],
      ["y4646_136157", "Hyde United", "HYD", "#2e267c", "#ffffff", 50],
      ["y4646_136260", "Warrington Town", "WAR", "#364b55", "#ffffff", 52],
      ["y4646_137880", "Bamber Bridge", "BAM", "#7440a0", "#ffffff", 50],
      ["y4646_137883", "Lancaster City", "LAN", "#85cd6d", "#ffffff", 54],
      ["y4646_137890", "Whitby Town", "WHI", "#8edc2d", "#ffffff", 57],
      ["y4646_140306", "Warrington Rylands", "WAR", "#41f0b0", "#ffffff", 52],
      ["y4646_145138", "Ilkeston Town", "ILK", "#f89cbb", "#ffffff", 51],
      ["y4646_145141", "Leek Town", "LEE", "#b98e22", "#ffffff", 55],
      ["y4646_145164", "Workington", "WOR", "#11a04a", "#ffffff", 49],
      ["y4646_145181", "Cleethorpes Town", "CLE", "#c30e37", "#ffffff", 53],
      ["y4646_145242", "Stockton Town", "STO", "#66317a", "#ffffff", 51],
      ["y4646_147585", "Quorn", "QUO", "#a4c9f4", "#ffffff", 51],
      ["y4646_147592", "Avro", "AVR", "#6972d7", "#ffffff", 49],
      ["y4646_148808", "Emley", "EML", "#8163fa", "#ffffff", 53],
      ["y4646_148930", "Redcar Athletic", "RED", "#9fd535", "#ffffff", 50]
    ]
  },
  {
    id: "y4647",
    name: "Isthmian League",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4647_134414", "Aveley", "AVE", "#70065a", "#ffffff", 55],
      ["y4647_135942", "St Albans City", "STA", "#cbd49f", "#ffffff", 51],
      ["y4647_135943", "Dartford", "DAR", "#9f0d7a", "#ffffff", 50],
      ["y4647_135957", "Whitehawk", "WHI", "#ec3195", "#ffffff", 51],
      ["y4647_135960", "Welling United", "WEL", "#24b08d", "#ffffff", 54],
      ["y4647_136008", "Eastbourne Borough", "EAS", "#d9cbb8", "#ffffff", 54],
      ["y4647_136146", "Leatherhead", "LEA", "#4a5683", "#ffffff", 52],
      ["y4647_137702", "Maldon and Tiptree", "MAL", "#1f6a10", "#ffffff", 53],
      ["y4647_137932", "Wingate and Finchley", "WIN", "#93ebdc", "#ffffff", 55],
      ["y4647_137933", "Carshalton Athletic", "CAR", "#265ca6", "#ffffff", 53],
      ["y4647_137935", "Cheshunt", "CHE", "#3e89a0", "#ffffff", 52],
      ["y4647_137946", "Cray Wanderers", "CRA", "#57e37c", "#ffffff", 56],
      ["y4647_137948", "Enfield Town", "ENF", "#0bb260", "#ffffff", 53],
      ["y4647_137953", "Lewes", "LEW", "#e27c76", "#ffffff", 49],
      ["y4647_138021", "Dulwich Hamlet", "DUL", "#12a0b2", "#ffffff", 54],
      ["y4647_140237", "Brentwood Town", "BRE", "#283fd2", "#ffffff", 49],
      ["y4647_145123", "Burgess Hill Town", "BUR", "#ad3e23", "#ffffff", 54],
      ["y4647_145202", "Ramsgate", "RAM", "#bb8e5c", "#ffffff", 56],
      ["y4647_145211", "Three Bridges", "THR", "#67dfa6", "#ffffff", 57],
      ["y4647_146593", "Chatham Town", "CHA", "#46e721", "#ffffff", 49],
      ["y4647_148729", "AFC Whyteleafe", "AFC", "#9ef8a0", "#ffffff", 49],
      ["y4647_148966", "Stanway Rovers", "STA", "#da311b", "#ffffff", 53]
    ]
  },
  {
    id: "y4648",
    name: "Southern League South",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4648_135978", "Basingstoke Town", "BAS", "#a14e08", "#ffffff", 55],
      ["y4648_136004", "Taunton Town", "TAU", "#048563", "#ffffff", 56],
      ["y4648_136254", "Poole Town", "POO", "#39722c", "#ffffff", 56],
      ["y4648_136256", "Chippenham Town", "CHI", "#8c2ef5", "#ffffff", 53],
      ["y4648_138013", "Gloucester City", "GLO", "#8a49e7", "#ffffff", 53],
      ["y4648_138018", "Bath City", "BAT", "#0bd739", "#ffffff", 49],
      ["y4648_138022", "Havant and Waterlooville", "HAV", "#b1a498", "#ffffff", 49],
      ["y4648_138164", "Yate Town", "YAT", "#649cf5", "#ffffff", 49],
      ["y4648_138235", "Gosport Borough", "GOS", "#0afcc7", "#ffffff", 55],
      ["y4648_138241", "Wimborne Town", "WIM", "#ffd521", "#ffffff", 53],
      ["y4648_145121", "Berkhamsted", "BER", "#200f06", "#ffffff", 53],
      ["y4648_145130", "Frome Town", "FRO", "#85e895", "#ffffff", 51],
      ["y4648_145157", "Uxbridge", "UXB", "#27694d", "#ffffff", 52],
      ["y4648_145174", "Bracknell Town", "BRA", "#57bc6c", "#ffffff", 51],
      ["y4648_145179", "Chertsey Town", "CHE", "#d642ff", "#ffffff", 49],
      ["y4648_145180", "Chichester City", "CHI", "#c69db1", "#ffffff", 55],
      ["y4648_145185", "Evesham United", "EVE", "#afec2e", "#ffffff", 54],
      ["y4648_145188", "Hanwell Town", "HAN", "#85078c", "#ffffff", 53],
      ["y4648_145205", "Sholing", "SHO", "#b88109", "#ffffff", 52],
      ["y4648_145238", "Plymouth Parkway", "PLY", "#6adb6f", "#ffffff", 55],
      ["y4648_146589", "Hanworth Villa", "HAN", "#2cda6e", "#ffffff", 50],
      ["y4648_147577", "Malvern Town", "MAL", "#9fe2e1", "#ffffff", 56]
    ]
  },
  {
    id: "y5324",
    name: "Southern League Central",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5324_134413", "Redditch United", "RED", "#62d741", "#ffffff", 52],
      ["y5324_134418", "Banbury United", "BAN", "#78c44b", "#ffffff", 51],
      ["y5324_134764", "Worcester City", "WOR", "#9d9d4c", "#ffffff", 54],
      ["y5324_135962", "Stourbridge", "STO", "#63d230", "#ffffff", 57],
      ["y5324_136006", "Stamford", "STA", "#ba5712", "#ffffff", 55],
      ["y5324_136673", "Hitchin Town", "HIT", "#d80e08", "#ffffff", 57],
      ["y5324_137929", "Bishop's Stortford", "BIS", "#640683", "#ffffff", 54],
      ["y5324_138014", "Kettering Town", "KET", "#51a74a", "#ffffff", 51],
      ["y5324_138016", "Leamington", "LEA", "#12d367", "#ffffff", 53],
      ["y5324_140239", "Needham Market", "NEE", "#13d144", "#ffffff", 54],
      ["y5324_144691", "Stratford Town", "STR", "#79ac29", "#ffffff", 50],
      ["y5324_145176", "Bury Town", "BUR", "#906e3e", "#ffffff", 57],
      ["y5324_145187", "Halesowen Town", "HAL", "#ec03ea", "#ffffff", 56],
      ["y5324_145220", "Alvechurch", "ALV", "#e64a52", "#ffffff", 55],
      ["y5324_145222", "Bromsgrove Sporting", "BRO", "#ff88b8", "#ffffff", 50],
      ["y5324_145224", "Leiston", "LEI", "#ef9d0e", "#ffffff", 56],
      ["y5324_145226", "Peterborough Sports", "PET", "#7af2ff", "#ffffff", 53],
      ["y5324_145228", "Rushall Olympic", "RUS", "#6037ce", "#ffffff", 56],
      ["y5324_147582", "Anstey Nomads", "ANS", "#7f5bea", "#ffffff", 49],
      ["y5324_147589", "Leighton Town", "LEI", "#3cb12f", "#ffffff", 51],
      ["y5324_148926", "Racing Club Warwick", "RAC", "#912a69", "#ffffff", 52],
      ["y5324_148929", "Real Bedford", "REA", "#f3786f", "#ffffff", 52]
    ]
  },
  {
    id: "y5777",
    name: "National 2 Grupo A",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5777_137697", "Tr\xE9lissac", "TRL", "#c3f557", "#ffffff", 49],
      ["y5777_142571", "Gen\xEAts Anglet", "GEN", "#c8b0f5", "#ffffff", 52],
      ["y5777_142575", "Chamali\xE8res", "CHA", "#cb604f", "#ffffff", 49],
      ["y5777_142579", "L\xE8ge-Cap-Ferret", "LGE", "#f7ba37", "#ffffff", 55],
      ["y5777_142600", "Colomiers", "COL", "#863605", "#ffffff", 49],
      ["y5777_142609", "M\xE9rignac-Arlac", "MRI", "#10e7d6", "#ffffff", 49],
      ["y5777_142646", "Onet-le-Ch\xE2teau", "ONE", "#84b24f", "#ffffff", 50],
      ["y5777_147622", "Toulouse II", "TOU", "#d0acb4", "#ffffff", 56],
      ["y5777_153863", "Bassin Arcachon", "BAS", "#70c341", "#ffffff", 54],
      ["y5777_153864", "Blagnac", "BLA", "#3feca4", "#ffffff", 50],
      ["y5777_154067", "Pau II", "PAU", "#fa5a20", "#ffffff", 54],
      ["y5777_154068", "SAG Cestas", "SAG", "#817471", "#ffffff", 53],
      ["y5777_154070", "Castanet", "CAS", "#66443c", "#ffffff", 49]
    ]
  },
  {
    id: "y5778",
    name: "National 2 Grupo B",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5778_142594", "Vend\xE9e Fontenay Foot", "VEN", "#53aae6", "#ffffff", 49],
      ["y5778_142642", "Panazol", "PAN", "#8711d9", "#ffffff", 56],
      ["y5778_142652", "Saint-Philbert-de-Grand-Lieu", "SAI", "#b4bc9f", "#ffffff", 53],
      ["y5778_144770", "Chauvigny", "CHA", "#f89579", "#ffffff", 53],
      ["y5778_146321", "Angers II", "ANG", "#523013", "#ffffff", 55],
      ["y5778_146341", "Nantes II", "NAN", "#4b86eb", "#ffffff", 56],
      ["y5778_147034", "La Ch\xE2taigneraie", "LAC", "#3b79b7", "#ffffff", 49],
      ["y5778_147878", "Challans", "CHA", "#b1bbd4", "#ffffff", 56],
      ["y5778_149978", "Vertou", "VER", "#03b7a7", "#ffffff", 48],
      ["y5778_153854", "Touraine", "TOU", "#0b1567", "#ffffff", 50],
      ["y5778_153862", "Les Sables VF", "LES", "#22ab58", "#ffffff", 48],
      ["y5778_154071", "Ch\xE2teauroux II", "CHT", "#9ae8dc", "#ffffff", 50],
      ["y5778_154072", "Ch\xE2tellerault", "CHT", "#2901f8", "#ffffff", 49]
    ]
  },
  {
    id: "y5779",
    name: "National 2 Grupo C",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5779_142593", "Vannes", "VAN", "#dfc4d0", "#ffffff", 56],
      ["y5779_142615", "Virois", "VIR", "#5ddf5a", "#ffffff", 51],
      ["y5779_142635", "Saint-Pierre Milizac", "SAI", "#cf1a05", "#ffffff", 52],
      ["y5779_144768", "Vitr\xE9", "VIT", "#835722", "#ffffff", 49],
      ["y5779_146332", "Guingamp II", "GUI", "#c75e99", "#ffffff", 52],
      ["y5779_146350", "Rennes II", "REN", "#1de6ea", "#ffffff", 48],
      ["y5779_147036", "Lannion", "LAN", "#a86ae1", "#ffffff", 52],
      ["y5779_149704", "Cesson", "CES", "#091181", "#ffffff", 55],
      ["y5779_149939", "Alen\xE7on", "ALE", "#b3845f", "#ffffff", 49],
      ["y5779_154073", "Ergu\xE9-Gab\xE9ric", "ERG", "#13e152", "#ffffff", 53],
      ["y5779_154074", "Brest II", "BRE", "#d471b9", "#ffffff", 55],
      ["y5779_154075", "Laval II", "LAV", "#bbed5b", "#ffffff", 53],
      ["y5779_154076", "Foug\xE8res", "FOU", "#7ffd9c", "#ffffff", 53]
    ]
  },
  {
    id: "y5780",
    name: "National 2 Grupo D",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5780_137698", "Linas-Montlh\xE9ry", "LIN", "#281f59", "#ffffff", 55],
      ["y5780_146326", "Chartres", "CHA", "#1b43dd", "#ffffff", 56],
      ["y5780_146327", "Caen II", "CAE", "#4316fc", "#ffffff", 50],
      ["y5780_146346", "Sainte-Genevi\xE8ve", "SAI", "#269e23", "#ffffff", 49],
      ["y5780_147561", "Aubervilliers", "AUB", "#80f578", "#ffffff", 52],
      ["y5780_149938", "Dives Cabourg", "DIV", "#5e2b1c", "#ffffff", 49],
      ["y5780_149972", "Br\xE9tigny", "BRT", "#ebba3d", "#ffffff", 48],
      ["y5780_153857", "Oissel", "OIS", "#120244", "#ffffff", 52],
      ["y5780_154077", "Saint-Ouen-l'Aum\xF4ne", "SAI", "#2c7b0d", "#ffffff", 49],
      ["y5780_154078", "Trouville-Deauville-Villers", "TRO", "#2e92b8", "#ffffff", 49],
      ["y5780_154086", "Versailles II", "VER", "#24f50d", "#ffffff", 52],
      ["y5780_154087", "Havre Caucriauville", "HAV", "#d305fd", "#ffffff", 53],
      ["y5780_154088", "Bastia II", "BAS", "#dffbd6", "#ffffff", 56]
    ]
  },
  {
    id: "y5781",
    name: "National 2 Grupo E",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5781_134716", "Gaz\xE9lec Ajaccio", "GAZ", "#538685", "#ffffff", 53],
      ["y5781_142567", "JA Drancy", "JAD", "#65a9f9", "#ffffff", 55],
      ["y5781_142583", "Olympique Saint-Quentin", "OLY", "#f10f7a", "#ffffff", 52],
      ["y5781_142585", "Olympique Charleville Prix AM", "OLY", "#372201", "#ffffff", 52],
      ["y5781_146337", "Metz II", "MET", "#eb2541", "#ffffff", 54],
      ["y5781_146345", "Stade de Reims II", "STA", "#5adab3", "#ffffff", 52],
      ["y5781_147052", "Pays de Cassel", "PAY", "#6dba4a", "#ffffff", 55],
      ["y5781_149128", "Balagne", "BAL", "#937dba", "#ffffff", 48],
      ["y5781_149974", "Neuilly-sur-Marne", "NEU", "#1329ec", "#ffffff", 52],
      ["y5781_153856", "Croix", "CRO", "#00b777", "#ffffff", 52],
      ["y5781_154091", "Amiens II", "AMI", "#10c2d4", "#ffffff", 49],
      ["y5781_154092", "Lille II", "LIL", "#5c9b04", "#ffffff", 50],
      ["y5781_154094", "Vimy", "VIM", "#d013df", "#ffffff", 52]
    ]
  },
  {
    id: "y5782",
    name: "National 2 Grupo F",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5782_139091", "ASM Belfort", "ASM", "#ab3893", "#ffffff", 48],
      ["y5782_140487", "Mulhouse", "MUL", "#58ad65", "#ffffff", 52],
      ["y5782_142573", "Besan\xE7on Football", "BES", "#87b02c", "#ffffff", 49],
      ["y5782_142591", "Thaon", "THA", "#8d4f15", "#ffffff", 49],
      ["y5782_142610", "Pontarlier", "PON", "#b0c7fe", "#ffffff", 53],
      ["y5782_142637", "Thonon Evian Grand Gen\xE8ve", "THO", "#1d5162", "#ffffff", 48],
      ["y5782_146349", "Racing Besan\xE7on", "RAC", "#182106", "#ffffff", 56],
      ["y5782_149700", "Jura Dolois", "JUR", "#393b35", "#ffffff", 56],
      ["y5782_153855", "Torcy", "TOR", "#5d46e1", "#ffffff", 55],
      ["y5782_153858", "Ivry", "IVR", "#44f7ef", "#ffffff", 49],
      ["y5782_153860", "Chalon", "CHA", "#773c95", "#ffffff", 49],
      ["y5782_154096", "Sochaux II", "SOC", "#624675", "#ffffff", 52],
      ["y5782_154097", "Strasbourg II", "STR", "#1ca55e", "#ffffff", 51]
    ]
  },
  {
    id: "y5783",
    name: "National 2 Grupo G",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5783_140489", "Jura Sud Foot", "JUR", "#800528", "#ffffff", 50],
      ["y5783_142603", "Feurs", "FEU", "#1dfd67", "#ffffff", 54],
      ["y5783_142608", "Moulins Yzeure Foot", "MOU", "#caa874", "#ffffff", 53],
      ["y5783_142611", "Romorantin", "ROM", "#2beae3", "#ffffff", 55],
      ["y5783_142619", "M\xE2con 71", "MCO", "#a36f66", "#ffffff", 56],
      ["y5783_142670", "Cosne", "COS", "#b82e04", "#ffffff", 53],
      ["y5783_146323", "Auxerre II", "AUX", "#587068", "#ffffff", 53],
      ["y5783_146351", "Vierzon", "VIE", "#f8336a", "#ffffff", 49],
      ["y5783_152841", "Rousset", "ROU", "#56cca7", "#ffffff", 55],
      ["y5783_154098", "Saint-\xC9tienne II", "SAI", "#f4c368", "#ffffff", 49],
      ["y5783_154099", "Dijon II", "DIJ", "#3f7193", "#ffffff", 55],
      ["y5783_154101", "Saran", "SAR", "#162c45", "#ffffff", 53],
      ["y5783_154102", "Orl\xE9ans II", "ORL", "#7991d8", "#ffffff", 52]
    ]
  },
  {
    id: "y5784",
    name: "National 2 Grupo H",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y5784_141010", "Olympique Al\xE8s", "OLY", "#0e28fe", "#ffffff", 52],
      ["y5784_142614", "Seyssinet", "SEY", "#6f8c7e", "#ffffff", 54],
      ["y5784_146324", "Blois", "BLO", "#5a6a96", "#ffffff", 55],
      ["y5784_146340", "Montpellier II", "MON", "#abab7c", "#ffffff", 49],
      ["y5784_146342", "Lyon II", "LYO", "#be3827", "#ffffff", 53],
      ["y5784_146343", "Marseille II", "MAR", "#7a255c", "#ffffff", 53],
      ["y5784_147564", "Bourgoin-Jallieu", "BOU", "#4dee2a", "#ffffff", 50],
      ["y5784_149726", "Lucciana", "LUC", "#510f3a", "#ffffff", 51],
      ["y5784_149805", "Cannet-Rocheville", "CAN", "#353d91", "#ffffff", 51],
      ["y5784_149806", "Carnoux", "CAR", "#33197a", "#ffffff", 52],
      ["y5784_149966", "Stade Beaucairois", "STA", "#6c7eef", "#ffffff", 56],
      ["y5784_153859", "ASPTT Dijon", "ASP", "#df17d2", "#ffffff", 48],
      ["y5784_154103", "Fos", "FOS", "#445a29", "#ffffff", 52],
      ["y5784_154104", "Riviera", "RIV", "#b35b8e", "#ffffff", 50]
    ]
  },
  {
    id: "y5891",
    name: "Oberliga Baden-W\xFCrttemberg",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5891_138416", "Bahlinger SC", "BAH", "#d876c9", "#ffffff", 56],
      ["y5891_138421", "Balingen", "BAL", "#b4e706", "#ffffff", 50],
      ["y5891_139978", "Villingen", "VIL", "#884d7b", "#ffffff", 53],
      ["y5891_140557", "Reutlingen 05", "REU", "#00ff66", "#ffffff", 50],
      ["y5891_146276", "Oberachern", "OBE", "#14d747", "#ffffff", 49],
      ["y5891_155610", "Pforzheim", "PFO", "#4dd068", "#ffffff", 54],
      ["y5891_155611", "N\xF6ttingen", "NTT", "#b34c42", "#ffffff", 56],
      ["y5891_155612", "Backnang", "BAC", "#cf89b2", "#ffffff", 53],
      ["y5891_155615", "Essingen", "ESS", "#1612a3", "#ffffff", 56],
      ["y5891_155617", "Normannia Gm\xFCnd", "NOR", "#4b4785", "#ffffff", 51],
      ["y5891_155619", "Ravensburg", "RAV", "#c15187", "#ffffff", 50],
      ["y5891_155620", "Karlsruhe II", "KAR", "#4c5638", "#ffffff", 49],
      ["y5891_155670", "T\xFCrkspor Neckarsulm", "TRK", "#ca9d6f", "#ffffff", 56],
      ["y5891_155671", "Singen", "SIN", "#c20d5b", "#ffffff", 48],
      ["y5891_155796", "Holzhausen", "HOL", "#569600", "#ffffff", 48],
      ["y5891_156192", "M\xFChlhausen", "MHL", "#a21f1e", "#ffffff", 54],
      ["y5891_156193", "Teningen", "TEN", "#3db740", "#ffffff", 55],
      ["y5891_156194", "Young Boys Reutlingen", "YOU", "#08c014", "#ffffff", 56]
    ]
  },
  {
    id: "y5892",
    name: "Oberliga Bayern Nord",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5892_138426", "Viktoria Aschaffenburg", "VIK", "#9e81a7", "#ffffff", 50],
      ["y5892_147618", "Eintracht Bamberg", "EIN", "#689032", "#ffffff", 54],
      ["y5892_155690", "Ingolstadt 04 II", "ING", "#0fe342", "#ffffff", 56],
      ["y5892_155692", "ASV Cham", "ASV", "#607ca8", "#ffffff", 49],
      ["y5892_155693", "Fortuna Regensburg", "FOR", "#08dfac", "#ffffff", 52],
      ["y5892_155694", "Weiden", "WEI", "#b543fd", "#ffffff", 49],
      ["y5892_155701", "Kornburg", "KOR", "#a05224", "#ffffff", 55],
      ["y5892_155702", "Neudrossenfeld", "NEU", "#661204", "#ffffff", 54],
      ["y5892_155703", "W\xFCrzburg", "WRZ", "#7bf5a7", "#ffffff", 50],
      ["y5892_155704", "Bayern Hof", "BAY", "#7ec81c", "#ffffff", 56],
      ["y5892_155705", "ASV Neumarkt", "ASV", "#61a57d", "#ffffff", 56],
      ["y5892_155711", "Jahn Regensburg II", "JAH", "#4c6156", "#ffffff", 53],
      ["y5892_155716", "N\xF6rdlingen", "NRD", "#c23bfe", "#ffffff", 48],
      ["y5892_155725", "Stadeln", "STA", "#7766dc", "#ffffff", 49],
      ["y5892_155726", "Gebenbach", "GEB", "#97b5ab", "#ffffff", 55],
      ["y5892_155797", "Gro\xDFbardorf", "GRO", "#df21c4", "#ffffff", 55],
      ["y5892_156058", "Don Bosco Bamberg", "DON", "#399521", "#ffffff", 52],
      ["y5892_156059", "Ammerthal", "AMM", "#5366a7", "#ffffff", 53]
    ]
  },
  {
    id: "y5893",
    name: "Oberliga Bayern S\xFCd",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5893_138433", "Schalding-Heining", "SCH", "#305733", "#ffffff", 52],
      ["y5893_138434", "1860 Rosenheim", "ROS", "#9f7eb4", "#ffffff", 48],
      ["y5893_138435", "Heimstetten", "HEI", "#a01664", "#ffffff", 54],
      ["y5893_142917", "Pipinsried", "PIP", "#d9b216", "#ffffff", 48],
      ["y5893_146318", "Hankofen-Hailing", "HAN", "#c911cd", "#ffffff", 50],
      ["y5893_155672", "Erlbach", "ERL", "#a78958", "#ffffff", 50],
      ["y5893_155700", "Kirchansch\xF6ring", "KIR", "#838b22", "#ffffff", 54],
      ["y5893_155712", "1860 Munich II", "MUN", "#50a0f7", "#ffffff", 51],
      ["y5893_155713", "Deisenhofen", "DEI", "#ee6804", "#ffffff", 48],
      ["y5893_155714", "Kottern", "KOT", "#2b94fc", "#ffffff", 55],
      ["y5893_155718", "Ismaning", "ISM", "#75e10c", "#ffffff", 52],
      ["y5893_155722", "Sportfreunde Schwaig", "SPO", "#214bcd", "#ffffff", 54],
      ["y5893_155723", "Gundelfingen", "GUN", "#61cce6", "#ffffff", 50],
      ["y5893_155727", "Geretsried", "GER", "#797b0b", "#ffffff", 56],
      ["y5893_155800", "Pfaffenhofen", "PFA", "#aa637a", "#ffffff", 50],
      ["y5893_155801", "Wasserburg", "WAS", "#ee2218", "#ffffff", 52],
      ["y5893_156060", "Landshut", "LAN", "#784880", "#ffffff", 52],
      ["y5893_156061", "Schwabm\xFCnchen", "SCH", "#dbb23e", "#ffffff", 55]
    ]
  },
  {
    id: "y5894",
    name: "Oberliga Bremen",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5894_139537", "Oberneuland", "OBE", "#f371a2", "#ffffff", 49],
      ["y5894_152267", "Hemelingen", "SVH", "#0873ad", "#ffffff", 53],
      ["y5894_155728", "Geestem\xFCnde", "GEE", "#b5bb10", "#ffffff", 49],
      ["y5894_155730", "OSC Bremerhaven", "OSC", "#fb832d", "#ffffff", 52],
      ["y5894_155731", "Brinkumer", "BRI", "#880a2c", "#ffffff", 50],
      ["y5894_155732", "Eiche Horn", "EIC", "#b3d23b", "#ffffff", 50],
      ["y5894_155733", "Blumenthaler", "BLU", "#95d657", "#ffffff", 55],
      ["y5894_155734", "Union 60 Bremen", "UNI", "#8cc562", "#ffffff", 56],
      ["y5894_155735", "Aumund-Vegesack", "AUM", "#f4bbad", "#ffffff", 50],
      ["y5894_155736", "Woltmershausen", "WOL", "#ce6483", "#ffffff", 49],
      ["y5894_155737", "BTS Neustadt", "BTS", "#a23396", "#ffffff", 54],
      ["y5894_155738", "Werder Bremen III", "WER", "#3d797e", "#ffffff", 52],
      ["y5894_155740", "Vatan Sport Bremen", "VAT", "#078a0d", "#ffffff", 53],
      ["y5894_155741", "Leher", "LEH", "#7c336d", "#ffffff", 48],
      ["y5894_156342", "Schwachhausen", "SCH", "#bd42eb", "#ffffff", 48],
      ["y5894_156343", "Grohn", "GRO", "#348cb4", "#ffffff", 51]
    ]
  },
  {
    id: "y5895",
    name: "Oberliga Hamburg",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5895_138379", "Altona 93", "ALT", "#af4b48", "#ffffff", 53],
      ["y5895_139976", "Dassendorf", "DAS", "#79c843", "#ffffff", 55],
      ["y5895_140025", "Teutonia Ottensen", "TEU", "#13202c", "#ffffff", 54],
      ["y5895_155743", "Paloma", "PAL", "#9d0050", "#ffffff", 51],
      ["y5895_155745", "Niendorf", "NIE", "#eb3e0d", "#ffffff", 52],
      ["y5895_155746", "HEBC Hamburg", "HEB", "#f2f3d5", "#ffffff", 48],
      ["y5895_155747", "Vorw\xE4rts-Wacker 04", "VOR", "#8b9ed5", "#ffffff", 53],
      ["y5895_155749", "S\xFCderelbe", "SDE", "#b7811c", "#ffffff", 53],
      ["y5895_155750", "Victoria Hamburg", "VIC", "#9a9a1e", "#ffffff", 56],
      ["y5895_155753", "Sasel", "SAS", "#cf3de4", "#ffffff", 52],
      ["y5895_155755", "Harksheide", "HAR", "#5cb811", "#ffffff", 49],
      ["y5895_155757", "Nikola Tesla Hamburg", "NIK", "#cdc8c6", "#ffffff", 48],
      ["y5895_155758", "HT16 Hamburg", "HTH", "#dea113", "#ffffff", 48],
      ["y5895_155802", "Pinneberg", "PIN", "#d0823c", "#ffffff", 54],
      ["y5895_156137", "WTSV Concordia", "WTS", "#ca2ddd", "#ffffff", 49],
      ["y5895_156295", "Eintracht Norderstedt 03 II", "EIN", "#e54a88", "#ffffff", 48]
    ]
  },
  {
    id: "y5896",
    name: "Oberliga Hessen",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5896_138418", "Bayern Alzenau", "BAY", "#8fb778", "#ffffff", 48],
      ["y5896_138419", "Gie\xDFen", "GIE", "#04887c", "#ffffff", 55],
      ["y5896_139977", "Baunatal", "BAU", "#16122e", "#ffffff", 54],
      ["y5896_140053", "Eintracht Stadtallendorf", "EIN", "#c89c63", "#ffffff", 53],
      ["y5896_155760", "T\xFCrk G\xFCc\xFC Friedberg", "TRK", "#34795e", "#ffffff", 52],
      ["y5896_155761", "Fernwald", "FER", "#6826ed", "#ffffff", 55],
      ["y5896_155762", "Rot-Wei\xDF Walldorf", "ROT", "#43f5b8", "#ffffff", 50],
      ["y5896_155763", "Darmstadt II", "DAR", "#2da2d6", "#ffffff", 55],
      ["y5896_155764", "H\xFCnfelder", "HNF", "#df1584", "#ffffff", 50],
      ["y5896_155765", "Eddersheim", "EDD", "#042622", "#ffffff", 49],
      ["y5896_155785", "Hanauer 1960", "HAN", "#b08f3e", "#ffffff", 54],
      ["y5896_155787", "Marburg", "MAR", "#f1aed9", "#ffffff", 51],
      ["y5896_155788", "Kassel", "KAS", "#73828f", "#ffffff", 53],
      ["y5896_155789", "Pohlheim", "POH", "#1466d0", "#ffffff", 55],
      ["y5896_155790", "Hummetroth", "HUM", "#cb59c7", "#ffffff", 50],
      ["y5896_156152", "Hessen Kassel II", "HES", "#f3f3a9", "#ffffff", 50],
      ["y5896_156153", "Rot-Wei\xDF Hadamar", "ROT", "#f9f647", "#ffffff", 51],
      ["y5896_156154", "Unter-Flockenbach", "UNT", "#da164b", "#ffffff", 51]
    ]
  },
  {
    id: "y5897",
    name: "Oberliga Mittelrhein",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5897_140047", "Wegberg-Beeck", "WEG", "#243ecf", "#ffffff", 50],
      ["y5897_140215", "D\xFCren", "DRE", "#b9ca26", "#ffffff", 53],
      ["y5897_149028", "Eintracht Hohkeppel", "EHO", "#18d600", "#ffffff", 50],
      ["y5897_155804", "Merten", "MER", "#304b12", "#ffffff", 52],
      ["y5897_155805", "Siegburg", "SIE", "#63f693", "#ffffff", 50],
      ["y5897_155817", "Frechen 20", "FRE", "#4cb612", "#ffffff", 52],
      ["y5897_155818", "K\xF6nigsdorf", "KNI", "#fff6ae", "#ffffff", 53],
      ["y5897_155819", "Vichttal", "VIC", "#fc6cbf", "#ffffff", 55],
      ["y5897_155820", "Porz", "POR", "#a8a906", "#ffffff", 49],
      ["y5897_155821", "Hennef 05", "HEN", "#bb851e", "#ffffff", 56],
      ["y5897_155823", "Fortuna K\xF6ln II", "FOR", "#79c0bf", "#ffffff", 49],
      ["y5897_155825", "Bornheim", "BOR", "#ca9a08", "#ffffff", 48],
      ["y5897_156570", "Borussia Lindenthal-Hohenlind", "BOR", "#233e8c", "#ffffff", 53],
      ["y5897_156571", "Chlodwig Z\xFClpich", "CHL", "#bb75c9", "#ffffff", 55],
      ["y5897_156572", "H\xFCrth", "HRT", "#00cec8", "#ffffff", 55],
      ["y5897_156996", "Neunkirchen-Seelscheid", "NEU", "#cc1259", "#ffffff", 54]
    ]
  },
  {
    id: "y5898",
    name: "Oberliga Niederrhein",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5898_137966", "Uerdingen 05", "UER", "#53f6c6", "#ffffff", 56],
      ["y5898_138363", "Fortuna D\xFCsseldorf II", "FOR", "#5197b2", "#ffffff", 49],
      ["y5898_138405", "Wuppertaler", "WUP", "#a5081e", "#ffffff", 53],
      ["y5898_147616", "Velbert", "VEL", "#c7ed1b", "#ffffff", 49],
      ["y5898_153099", "St. T\xF6nis", "STT", "#6f3e7d", "#ffffff", 50],
      ["y5898_155827", "Schonnebeck", "SCH", "#a8989d", "#ffffff", 51],
      ["y5898_155828", "Schwarz-Wei\xDF Essen", "SCH", "#b854cd", "#ffffff", 55],
      ["y5898_155849", "B\xFCderich", "BDE", "#724ca1", "#ffffff", 49],
      ["y5898_155850", "Sonsbeck", "SON", "#db9f88", "#ffffff", 51],
      ["y5898_155851", "Ratingen 04/19", "RAT", "#2fc0fe", "#ffffff", 54],
      ["y5898_155852", "Meerbusch", "MEE", "#77d994", "#ffffff", 51],
      ["y5898_155854", "Monheim", "MON", "#ed61ed", "#ffffff", 55],
      ["y5898_155859", "Sportfreunde Baumberg", "SPO", "#638004", "#ffffff", 51],
      ["y5898_155860", "Viktoria J\xFCchen-Garzweiler", "VIK", "#8a6a12", "#ffffff", 52],
      ["y5898_155861", "Holzheim", "HOL", "#f4240c", "#ffffff", 50],
      ["y5898_155862", "Blau-Wei\xDF Dingden", "BLA", "#f34a16", "#ffffff", 56],
      ["y5898_156271", "Solingen 03", "SOL", "#735acb", "#ffffff", 51],
      ["y5898_156272", "Scherpenberg", "SCH", "#605d22", "#ffffff", 50]
    ]
  },
  {
    id: "y5899",
    name: "Oberliga Niedersachsen",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y5899_138374", "Schwarz-Wei\xDF Rehden", "SCH", "#d2dda2", "#ffffff", 56],
      ["y5899_138377", "L\xFCneburger SK Hansa", "LNE", "#fd161b", "#ffffff", 49],
      ["y5899_140026", "Hildesheim", "HIL", "#f1878b", "#ffffff", 49],
      ["y5899_146272", "Blau-Wei\xDF Lohne", "BLA", "#4ead20", "#ffffff", 51],
      ["y5899_147412", "Bersenbr\xFCck", "BER", "#871146", "#ffffff", 55],
      ["y5899_147614", "Spelle-Venhaus", "SPE", "#f1028f", "#ffffff", 54],
      ["y5899_155864", "Heeslinger", "HEE", "#9f5673", "#ffffff", 50],
      ["y5899_155865", "Meppen II", "MEP", "#7d3de0", "#ffffff", 55],
      ["y5899_155867", "Wilhelmshaven", "WIL", "#fb6d70", "#ffffff", 52],
      ["y5899_155868", "Germania Egestorf/Langreder", "GER", "#029283", "#ffffff", 48],
      ["y5899_155869", "Eintracht Braunschweig II", "EIN", "#020217", "#ffffff", 52],
      ["y5899_155870", "Verden 04", "VER", "#ff4d3b", "#ffffff", 49],
      ["y5899_156226", "Vorsfelde", "VOR", "#00758f", "#ffffff", 54],
      ["y5899_156227", "Hemmingen-Westerfeld", "HEM", "#636f6a", "#ffffff", 54],
      ["y5899_156228", "Drochtersen/Assel II", "DRO", "#845692", "#ffffff", 54],
      ["y5899_156229", "Vorw\xE4rts Nordhorn", "VOR", "#6f930e", "#ffffff", 48]
    ]
  },
  {
    id: "y5225",
    name: "Isthmian League North Division",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5225_134415", "Canvey Island", "CAN", "#0cfe46", "#ffffff", 52],
      ["y5225_134442", "Grays Athletic", "GRA", "#74b60c", "#ffffff", 53],
      ["y5225_137931", "Bowers and Pitsea", "BOW", "#9fd83a", "#ffffff", 51],
      ["y5225_137936", "Brightlingsea Regent", "BRI", "#3beaa9", "#ffffff", 54],
      ["y5225_138019", "Concord Rangers", "CON", "#52d553", "#ffffff", 50],
      ["y5225_140230", "Hashtag United", "HAS", "#faff93", "#ffffff", 51],
      ["y5225_140231", "Felixstowe and Walton United", "FEL", "#58795b", "#ffffff", 52],
      ["y5225_144077", "AFC Sudbury", "AFC", "#4a7b15", "#ffffff", 48],
      ["y5225_145124", "Cambridge City", "CAM", "#eb2d15", "#ffffff", 56],
      ["y5225_145155", "Tilbury", "TIL", "#ae255d", "#ffffff", 54],
      ["y5225_145163", "Witham Town", "WIT", "#e0c2d7", "#ffffff", 56],
      ["y5225_145225", "Lowestoft Town", "LOW", "#aabd44", "#ffffff", 55],
      ["y5225_146587", "Gorleston", "GOR", "#e81857", "#ffffff", 48],
      ["y5225_146588", "Wroxham", "WRO", "#2d2d9f", "#ffffff", 48],
      ["y5225_146611", "Walthamstow", "WAL", "#4fb287", "#ffffff", 53],
      ["y5225_147571", "Redbridge", "RED", "#193562", "#ffffff", 51],
      ["y5225_148769", "Buckhurst Hill", "BUC", "#e92787", "#ffffff", 53],
      ["y5225_148813", "Fakenham Town", "FAK", "#e7ee84", "#ffffff", 53],
      ["y5225_148876", "Little Oakley", "LIT", "#ee07af", "#ffffff", 55],
      ["y5225_148897", "Mulbarton Wanderers", "MUL", "#6b12ea", "#ffffff", 48],
      ["y5225_148904", "Newmarket Town", "NEW", "#181ac3", "#ffffff", 52],
      ["y5225_148975", "Takeley", "TAK", "#11d11e", "#ffffff", 53]
    ]
  },
  {
    id: "y5226",
    name: "Isthmian League South Central Division",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5226_134797", "Binfield", "BIN", "#9189f1", "#ffffff", 48],
      ["y5226_136009", "Harrow Borough", "HAR", "#aee324", "#ffffff", 53],
      ["y5226_137930", "Bognor Regis Town", "BOG", "#269cfb", "#ffffff", 52],
      ["y5226_137952", "Kingstonian", "KIN", "#b6ffc0", "#ffffff", 54],
      ["y5226_138165", "Hayes and Yeading United", "HAY", "#85ba04", "#ffffff", 52],
      ["y5226_138236", "Hartley Wintney", "HAR", "#e785f1", "#ffffff", 52],
      ["y5226_138237", "Hendon", "HEN", "#ff70c9", "#ffffff", 51],
      ["y5226_140351", "Ascot United", "ASC", "#c105b9", "#ffffff", 56],
      ["y5226_143770", "Littlehampton Town", "LIT", "#f50e05", "#ffffff", 48],
      ["y5226_145119", "Bedfont Sports", "BED", "#b3d241", "#ffffff", 49],
      ["y5226_145161", "Westfield Surrey", "WES", "#836b76", "#ffffff", 48],
      ["y5226_145169", "Ashford Town Middlesex", "ASH", "#f820d8", "#ffffff", 48],
      ["y5226_145217", "Winchester City", "WIN", "#f99b09", "#ffffff", 50],
      ["y5226_146590", "Southall", "SOU", "#a044a1", "#ffffff", 55],
      ["y5226_147590", "Raynes Park Vale", "RAY", "#3e0711", "#ffffff", 49],
      ["y5226_148725", "AFC Portchester", "AFC", "#ee00ac", "#ffffff", 50],
      ["y5226_148727", "AFC Stoneham", "AFC", "#db5724", "#ffffff", 55],
      ["y5226_148782", "Cobham", "COB", "#90d5c6", "#ffffff", 56],
      ["y5226_148806", "Egham Town", "EGH", "#a9fcf1", "#ffffff", 51],
      ["y5226_148896", "Moneyfields", "MON", "#0e6f62", "#ffffff", 50],
      ["y5226_152216", "Jersey Bulls", "JER", "#7b2c45", "#ffffff", 51],
      ["y5226_152757", "Windsor and Eton", "WIN", "#732503", "#ffffff", 55]
    ]
  },
  {
    id: "y5228",
    name: "Southern Football League Division 1 South",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5228_138017", "Weymouth", "WEY", "#a8700b", "#ffffff", 54],
      ["y5228_138023", "Hungerford Town", "HUN", "#fdb7b6", "#ffffff", 54],
      ["y5228_138026", "Dorchester Town", "DOR", "#309c75", "#ffffff", 50],
      ["y5228_138163", "Swindon Supermarine", "SWI", "#bf7ff5", "#ffffff", 55],
      ["y5228_138240", "Tiverton Town", "TIV", "#71d062", "#ffffff", 52],
      ["y5228_145117", "Barnstaple Town", "BAR", "#a8d620", "#ffffff", 55],
      ["y5228_145122", "Bideford", "BID", "#ad77f4", "#ffffff", 54],
      ["y5228_145140", "Larkhall Athletic", "LAR", "#9a2369", "#ffffff", 53],
      ["y5228_145143", "Melksham Town", "MEL", "#cee7a8", "#ffffff", 52],
      ["y5228_145146", "Paulton Rovers", "PAU", "#71291a", "#ffffff", 54],
      ["y5228_145162", "Willand Rovers", "WIL", "#38ae35", "#ffffff", 52],
      ["y5228_145175", "Bristol Manor Farm", "BRI", "#8c7fc0", "#ffffff", 51],
      ["y5228_145206", "Slimbridge", "SLI", "#0d0cb0", "#ffffff", 54],
      ["y5228_146596", "Bishop's Cleeve", "BIS", "#4530ea", "#ffffff", 55],
      ["y5228_146597", "Exmouth Town", "EXM", "#19bda6", "#ffffff", 50],
      ["y5228_146600", "Westbury United", "WES", "#b8e82f", "#ffffff", 53],
      ["y5228_148814", "Falmouth Town", "FAL", "#d2219b", "#ffffff", 56],
      ["y5228_148841", "Hartpury University", "HAR", "#a0067a", "#ffffff", 54],
      ["y5228_148922", "Portland United", "POR", "#07abc3", "#ffffff", 55],
      ["y5228_148945", "Shaftesbury", "SHA", "#3f1dde", "#ffffff", 51],
      ["y5228_148962", "Sporting Club Inkberrow", "SPO", "#a3969b", "#ffffff", 56],
      ["y5228_149009", "Worcester Raiders", "WOR", "#d7325c", "#ffffff", 49]
    ]
  },
  {
    id: "y5227",
    name: "Isthmian League South East Division",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5227_136010", "Merstham", "MER", "#b9e9f7", "#ffffff", 48],
      ["y5227_137954", "Margate", "MAR", "#48f8d7", "#ffffff", 56],
      ["y5227_140238", "Faversham Town", "FAV", "#384c4b", "#ffffff", 48],
      ["y5227_140349", "Cray Valley Paper Mills", "CRA", "#65e426", "#ffffff", 50],
      ["y5227_143782", "Sevenoaks Town", "SEV", "#8e8ccb", "#ffffff", 55],
      ["y5227_145115", "Ashford United", "ASH", "#30a6a8", "#ffffff", 50],
      ["y5227_145133", "Hastings United", "HAS", "#b217f0", "#ffffff", 51],
      ["y5227_145134", "Herne Bay", "HER", "#617626", "#ffffff", 54],
      ["y5227_145151", "Sittingbourne", "SIT", "#ea3946", "#ffffff", 49],
      ["y5227_145152", "South Park", "SOU", "#956fb4", "#ffffff", 50],
      ["y5227_145215", "Whitstable Town", "WHI", "#d824ad", "#ffffff", 55],
      ["y5227_146594", "Sheppey United", "SHE", "#40d71a", "#ffffff", 56],
      ["y5227_147572", "Broadbridge Heath", "BRO", "#26ecf0", "#ffffff", 52],
      ["y5227_148722", "AFC Croydon Athletic", "AFC", "#ed83fa", "#ffffff", 55],
      ["y5227_148792", "Crowborough Athletic", "CRO", "#ed6f84", "#ffffff", 49],
      ["y5227_148794", "Deal Town", "DEA", "#e8def3", "#ffffff", 53],
      ["y5227_148802", "Eastbourne Town", "EAS", "#dbc1d0", "#ffffff", 50],
      ["y5227_148810", "Erith Town", "ERI", "#a961c6", "#ffffff", 53],
      ["y5227_148854", "Horley Town", "HOR", "#ffbc68", "#ffffff", 55],
      ["y5227_148915", "Peacehaven and Telscombe", "PEA", "#b82f03", "#ffffff", 53],
      ["y5227_148925", "Punjab United", "PUN", "#45c2a0", "#ffffff", 51],
      ["y5227_148967", "Steyning Town", "STE", "#19f9f2", "#ffffff", 48]
    ]
  },
  {
    id: "y5325",
    name: "Northern Premier League Division One East",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5325_134421", "Matlock Town", "MAT", "#c4052f", "#ffffff", 49],
      ["y5325_137885", "Morpeth Town", "MOR", "#0f4ade", "#ffffff", 54],
      ["y5325_138011", "Bradford Park Avenue", "BRA", "#d34d46", "#ffffff", 52],
      ["y5325_139947", "Ashington", "ASH", "#a7c824", "#ffffff", 55],
      ["y5325_140369", "Stocksbridge Park Steels", "STO", "#af0a30", "#ffffff", 54],
      ["y5325_140391", "Dunston UTS", "DUN", "#a51ed1", "#ffffff", 48],
      ["y5325_140393", "Ossett United", "OSS", "#c153fb", "#ffffff", 48],
      ["y5325_145149", "Pontefract Collieries", "PON", "#5e93c2", "#ffffff", 54],
      ["y5325_145195", "Lincoln United", "LIN", "#805ea1", "#ffffff", 50],
      ["y5325_145231", "Bridlington Town", "BRI", "#610812", "#ffffff", 48],
      ["y5325_145236", "Liversedge", "LIV", "#e51219", "#ffffff", 50],
      ["y5325_146602", "Consett", "CON", "#26d16f", "#ffffff", 56],
      ["y5325_146604", "Grimsby Borough", "GRI", "#7fa49c", "#ffffff", 56],
      ["y5325_147580", "North Ferriby", "NOR", "#5aaf8b", "#ffffff", 53],
      ["y5325_148749", "Beverley Town", "BEV", "#0696f8", "#ffffff", 50],
      ["y5325_148754", "Blyth Town", "BLY", "#d7be8a", "#ffffff", 55],
      ["y5325_148822", "Garforth Town", "GAR", "#4b32d4", "#ffffff", 50],
      ["y5325_148830", "Guisborough Town", "GUI", "#ade1bd", "#ffffff", 52],
      ["y5325_148832", "Hallam", "HAL", "#c59391", "#ffffff", 48],
      ["y5325_148845", "Heaton Stannington", "HEA", "#53de94", "#ffffff", 50],
      ["y5325_148955", "Silsden", "SIL", "#9e5046", "#ffffff", 53],
      ["y5325_148995", "West Auckland Town", "WES", "#2a872d", "#ffffff", 53]
    ]
  },
  {
    id: "y5326",
    name: "Northern Premier League Division One Midlands",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5326_134420", "Basford United", "BAS", "#14bd22", "#ffffff", 54],
      ["y5326_135973", "Barwell", "BAR", "#b61d23", "#ffffff", 48],
      ["y5326_137882", "Grantham Town", "GRA", "#753fd8", "#ffffff", 55],
      ["y5326_137884", "Mickleover", "MIC", "#4bc077", "#ffffff", 50],
      ["y5326_140382", "St Ives Town", "STI", "#c61390", "#ffffff", 56],
      ["y5326_145120", "Bedworth United", "BED", "#1274c1", "#ffffff", 55],
      ["y5326_145127", "Corby Town", "COR", "#b31079", "#ffffff", 55],
      ["y5326_145153", "Sutton Coldfield Town", "SUT", "#951372", "#ffffff", 53],
      ["y5326_145172", "Belper Town", "BEL", "#f3023b", "#ffffff", 48],
      ["y5326_145177", "Carlton Town", "CAR", "#73e610", "#ffffff", 50],
      ["y5326_145183", "Coleshill Town", "COL", "#0fbcfa", "#ffffff", 54],
      ["y5326_145219", "AFC Rushden and Diamonds", "AFC", "#fafd13", "#ffffff", 48],
      ["y5326_145239", "Shepshed Dynamo", "SHE", "#8289d7", "#ffffff", 55],
      ["y5326_145246", "Nuneaton Town", "NUN", "#633263", "#ffffff", 54],
      ["y5326_146601", "Boldmere St Michaels", "BOL", "#e559c9", "#ffffff", 48],
      ["y5326_146609", "Long Eaton United", "LON", "#7cc8ec", "#ffffff", 52],
      ["y5326_148756", "Boston Town", "BOS", "#873940", "#ffffff", 49],
      ["y5326_148758", "Bourne Town", "BOU", "#ddf9b3", "#ffffff", 49],
      ["y5326_148787", "Coventry United", "COV", "#ca0daa", "#ffffff", 53],
      ["y5326_148882", "Loughborough Students", "LOU", "#b60d30", "#ffffff", 53],
      ["y5326_148937", "Rugby Borough", "RUG", "#202841", "#ffffff", 51],
      ["y5326_148990", "Wellingborough Town", "WEL", "#c26dd3", "#ffffff", 51]
    ]
  },
  {
    id: "y5327",
    name: "Southern Football League Division 1 Central",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5327_134416", "Aylesbury United", "AYL", "#0ee05d", "#ffffff", 49],
      ["y5327_135972", "Didcot Town", "DID", "#3a72a7", "#ffffff", 49],
      ["y5327_136253", "Haringey Borough", "HAR", "#39a213", "#ffffff", 48],
      ["y5327_137955", "Potters Bar Town", "POT", "#533026", "#ffffff", 50],
      ["y5327_138027", "Beaconsfield Town", "BEA", "#e12223", "#ffffff", 51],
      ["y5327_145159", "Waltham Abbey", "WAL", "#e4ffff", "#ffffff", 49],
      ["y5327_145170", "Barton Rovers", "BAR", "#4cd2d6", "#ffffff", 48],
      ["y5327_145173", "Biggleswade", "BIG", "#e7c83d", "#ffffff", 53],
      ["y5327_145191", "Hertford Town", "HER", "#8c117d", "#ffffff", 55],
      ["y5327_145198", "Marlow", "MAR", "#3662bc", "#ffffff", 50],
      ["y5327_145210", "Thame United", "THA", "#e41336", "#ffffff", 52],
      ["y5327_145213", "Ware", "WAR", "#27d62e", "#ffffff", 49],
      ["y5327_145214", "Welwyn Garden City", "WEL", "#f90d8e", "#ffffff", 48],
      ["y5327_145221", "Biggleswade Town", "BIG", "#fc3351", "#ffffff", 49],
      ["y5327_145227", "Royston Town", "ROY", "#2631d3", "#ffffff", 49],
      ["y5327_146605", "Hadley", "HAD", "#2e2758", "#ffffff", 53],
      ["y5327_147591", "Stotfold", "STO", "#075d95", "#ffffff", 54],
      ["y5327_148819", "Flackwell Heath", "FLA", "#0cf437", "#ffffff", 49],
      ["y5327_148871", "Leverstock Green", "LEV", "#c1063a", "#ffffff", 51],
      ["y5327_148877", "London Lions", "LON", "#958f2f", "#ffffff", 49],
      ["y5327_148894", "Milton Keynes Irish", "MIL", "#84645c", "#ffffff", 54],
      ["y5327_149004", "Winslow United", "WIN", "#b3926e", "#ffffff", 52]
    ]
  },
  {
    id: "y5328",
    name: "Northern Premier League Division One West",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y5328_134411", "Witton Albion", "WIT", "#3e9ef1", "#ffffff", 54],
      ["y5328_135974", "Stalybridge Celtic", "STA", "#176da2", "#ffffff", 53],
      ["y5328_136155", "Nantwich Town", "NAN", "#11d9ce", "#ffffff", 56],
      ["y5328_137879", "Atherton Collieries", "ATH", "#8a92cd", "#ffffff", 48],
      ["y5328_137889", "Stafford Rangers", "STA", "#b57cec", "#ffffff", 48],
      ["y5328_140388", "Clitheroe", "CLI", "#c103d9", "#ffffff", 53],
      ["y5328_140392", "Mossley", "MOS", "#bba8cd", "#ffffff", 49],
      ["y5328_145144", "Newcastle Town", "NEW", "#347192", "#ffffff", 48],
      ["y5328_145178", "Chasetown", "CHA", "#46df85", "#ffffff", 53],
      ["y5328_145194", "Kidsgrove Athletic", "KID", "#12d7a2", "#ffffff", 56],
      ["y5328_145200", "Prescot Cables", "PRE", "#d82a56", "#ffffff", 49],
      ["y5328_145203", "Runcorn Linnets", "RUN", "#3666b9", "#ffffff", 53],
      ["y5328_145229", "1874 Northwich", "NOR", "#1a6053", "#ffffff", 49],
      ["y5328_145230", "Bootle", "BOO", "#3da1e4", "#ffffff", 48],
      ["y5328_146606", "Hanley Town", "HAN", "#1a3b2e", "#ffffff", 49],
      ["y5328_147593", "Vauxhall Motors", "VAU", "#a4ec7a", "#ffffff", 56],
      ["y5328_148784", "Congleton Town", "CON", "#19180c", "#ffffff", 53],
      ["y5328_148872", "Lichfield City", "LIC", "#a0e658", "#ffffff", 49],
      ["y5328_148883", "Lower Breck", "LOW", "#619eff", "#ffffff", 56],
      ["y5328_148912", "Padiham", "PAD", "#9d5216", "#ffffff", 51],
      ["y5328_148952", "Shifnal Town", "SHI", "#d7edb5", "#ffffff", 50],
      ["y5328_149011", "Wythenshawe", "WYT", "#a3917c", "#ffffff", 55]
    ]
  },
  {
    id: "y4525",
    name: "Football League First Division",
    country: "Inglaterra",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    clubs: [
      ["y4525_139924", "Wimbledon FC", "WIM", "#e8aa05", "#ffffff", 53],
      ["y4525_139931", "Accrington FC", "ACC", "#ec04c3", "#ffffff", 52],
      ["y4525_139935", "Bootle FC", "BOO", "#76c5df", "#ffffff", 53],
      ["y4525_139936", "Burton Swifts", "BUR", "#61971b", "#ffffff", 52],
      ["y4525_139937", "Middlesbrough Ironopolis FC", "MID", "#f0042a", "#ffffff", 51],
      ["y4525_139938", "Rotherham Town FC", "ROT", "#9e3c60", "#ffffff", 50],
      ["y4525_139940", "Loughborough FC", "LOU", "#4d4861", "#ffffff", 48],
      ["y4525_139941", "Glossop North End AFC", "GLO", "#1ca797", "#ffffff", 48],
      ["y4525_139942", "New Brighton Tower FC", "NEW", "#878eaf", "#ffffff", 50],
      ["y4525_139943", "Burton United FC", "BUR", "#e99982", "#ffffff", 52],
      ["y4525_139944", "Leeds City FC", "LEE", "#ec7127", "#ffffff", 55],
      ["y4525_139946", "Aberdare Athletic FC", "ABE", "#8fb34c", "#ffffff", 51],
      ["y4525_139948", "Durham City AFC", "DUR", "#6cfe45", "#ffffff", 52],
      ["y4525_139949", "Nelson FC", "NEL", "#cae6d4", "#ffffff", 49],
      ["y4525_139950", "Wigan Borough FC", "WIG", "#cd5279", "#ffffff", 48],
      ["y4525_139951", "New Brighton AFC", "NEW", "#5759dc", "#ffffff", 54],
      ["y4525_139952", "Thames AFC", "THA", "#6fd20c", "#ffffff", 50],
      ["y4525_139954", "Workington AFC", "WOR", "#90439c", "#ffffff", 50],
      ["y4525_139955", "Hereford United FC", "HER", "#fc6347", "#ffffff", 51],
      ["y4525_139956", "Scarborough FC", "SCA", "#1e6d2f", "#ffffff", 50]
    ]
  },
  {
    id: "y4676",
    name: "1 Lig",
    country: "Turquia",
    flag: "\u{1F1F9}\u{1F1F7}",
    clubs: [
      ["y4676_133801", "Bursaspor", "BUR", "#c58761", "#ffffff", 48],
      ["y4676_133806", "Sivasspor", "SIV", "#2df6e8", "#ffffff", 55],
      ["y4676_138941", "Ankara Ke\xE7i\xF6reng\xFCc\xFC", "ANK", "#306951", "#ffffff", 54],
      ["y4676_138955", "Manisa", "MAN", "#41ba87", "#ffffff", 50],
      ["y4676_138958", "Sar\u0131yer", "SAR", "#aef19a", "#ffffff", 55],
      ["y4676_138974", "Bodrum", "BOD", "#b6d4c3", "#ffffff", 50],
      ["y4676_138983", "Fatih Karag\xFCmr\xFCk", "FAT", "#ee4e1a", "#ffffff", 55],
      ["y4676_146459", "Batman Petrolspor", "BAT", "#9e8d73", "#ffffff", 52],
      ["y4676_147638", "I\u011Fd\u0131r", "IDR", "#0327f4", "#ffffff", 50],
      ["y4676_149636", "Mardin 1969", "MAR", "#6d3bd1", "#ffffff", 50],
      ["y4676_149661", "Mu\u011Flaspor", "MUL", "#c0f151", "#ffffff", 56]
    ]
  },
  {
    id: "y4334",
    name: "Ligue 1",
    country: "Fran\xE7a",
    flag: "\u{1F1EB}\u{1F1F7}",
    clubs: [
      ["y4334_133704", "Brest", "BRS", "#ed1c24", "#ffffff", 53],
      ["y4334_133707", "Marseille", "OLM", "#00a1df", "#ffffff", 50],
      ["y4334_133712", "Nice", "NIC", "#000000", "#ed1c24", 52],
      ["y4334_133713", "Lyon", "LYO", "#ffffff", "#0f23aa", 49],
      ["y4334_133715", "Lorient", "LOR", "#f58113", "#000000", 54],
      ["y4334_133719", "Rennes", "REN", "#e13327", "#000000", 49],
      ["y4334_133822", "Lens", "LNS", "#fff200", "#ec1c24", 51],
      ["y4334_133823", "Monaco", "MON", "#e51b22", "#cb9f18", 51],
      ["y4334_133848", "Le Mans", "LEM", "#0cffb7", "#ffffff", 55],
      ["y4334_134709", "Angers", "ANG", "#000000", "#ffffff", 51],
      ["y4334_134788", "Auxerre", "AUX", "#4087bf", "#ffffff", 55]
    ]
  },
  {
    id: "y4331",
    name: "Bundesliga",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y4331_133651", "Hamburg", "HAM", "#0a3f86", "#ffffff", 50],
      ["y4331_133652", "Augsburg", "AUG", "#ba3733", "#ffffff", 56],
      ["y4331_133653", "Freiburg", "FRE", "#000000", "#ffffff", 55],
      ["y4331_133654", "K\xF6ln", "KLN", "#ed1c24", "#ffffff", 50],
      ["y4331_133660", "Stuttgart", "STU", "#e32219", "#ffffff", 53],
      ["y4331_133664", "Bayern Munich", "BAY", "#dc052d", "#ffffff", 51],
      ["y4331_133665", "Mainz", "MAI", "#c3141e", "#ffffff", 56],
      ["y4331_134551", "Paderborn", "PAD", "#550a70", "#ffffff", 50],
      ["y4331_134779", "Borussia M\xF6nchengladbach", "BOR", "#000000", "#ffffff", 56],
      ["y4331_138411", "Elversberg", "ELV", "#cfc418", "#ffffff", 52]
    ]
  },
  {
    id: "y4399",
    name: "2. Bundesliga",
    country: "Alemanha",
    flag: "\u{1F1E9}\u{1F1EA}",
    clubs: [
      ["y4399_133655", "Wolfsburg", "WOL", "#09633d", "#ffffff", 56],
      ["y4399_133656", "Hannover 96", "HAN", "#764624", "#ffffff", 54],
      ["y4399_133658", "Hertha", "HER", "#004d9e", "#ffffff", 54],
      ["y4399_133659", "N\xFCrnberg", "NRN", "#5d1691", "#ffffff", 50],
      ["y4399_133839", "Bochum", "BOC", "#005ca9", "#ffffff", 56],
      ["y4399_133852", "Arminia Bielefeld", "ARM", "#c9e193", "#ffffff", 51],
      ["y4399_133853", "Energie Cottbus", "ENE", "#cbdc3a", "#ffffff", 49],
      ["y4399_134693", "Darmstadt", "DAR", "#004f9f", "#ffffff", 55],
      ["y4399_135293", "Karlsruhe", "KAR", "#5a10bd", "#ffffff", 48],
      ["y4399_135655", "Dynamo Dresden", "DYN", "#2ca832", "#ffffff", 55],
      ["y4399_136027", "Holstein Kiel", "HK", "#0f5787", "#ffffff", 56],
      ["y4399_136194", "Magdeburg", "MAG", "#115326", "#ffffff", 55],
      ["y4399_137115", "Osnabr\xFCck", "OSN", "#59b5bb", "#ffffff", 49]
    ]
  },
  {
    id: "y4778",
    name: "Italy Serie D Girone B",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4778_133819", "Piacenza", "PIA", "#8bce5e", "#ffffff", 55],
      ["y4778_134780", "ChievoVerona", "CHI", "#605190", "#ffffff", 54],
      ["y4778_137254", "Virtus Verona", "VIR", "#0a7ec1", "#ffffff", 52],
      ["y4778_140304", "Tritium", "TRI", "#84a2de", "#ffffff", 48],
      ["y4778_142935", "Brusaporto", "BRU", "#fb2968", "#ffffff", 52],
      ["y4778_142946", "Scanzorosciate", "SCA", "#40408c", "#ffffff", 55],
      ["y4778_142948", "Villa Valle", "VIL", "#7cf155", "#ffffff", 49],
      ["y4778_142950", "Virtus CiseranoBergamo", "VIR", "#a061cb", "#ffffff", 52],
      ["y4778_142954", "Caldiero Terme", "CAL", "#4ee0f7", "#ffffff", 50],
      ["y4778_142974", "Fiorenzuola", "FIO", "#b25fa4", "#ffffff", 56],
      ["y4778_143895", "Real Calepina", "REA", "#60b3d7", "#ffffff", 55],
      ["y4778_148674", "Milan Futuro", "MIL", "#31a8bc", "#ffffff", 52],
      ["y4778_149236", "Club Milano", "CLU", "#87b9a0", "#ffffff", 54],
      ["y4778_149238", "Pro Palazzolo", "PRO", "#bf10c0", "#ffffff", 53],
      ["y4778_152842", "Leon Monza e Brianza", "LEO", "#09275e", "#ffffff", 53],
      ["y4778_153108", "Rovato", "ROV", "#a51085", "#ffffff", 51],
      ["y4778_156647", "Nibbiano e Valtidone", "NIB", "#cc2dfc", "#ffffff", 56],
      ["y4778_156648", "Pavonese", "PAV", "#419b60", "#ffffff", 53]
    ]
  },
  {
    id: "y4779",
    name: "Italy Serie D Girone C",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4779_133821", "Triestina", "TRI", "#d85807", "#ffffff", 51],
      ["y4779_134655", "Bassano", "BAS", "#e40646", "#ffffff", 50],
      ["y4779_135892", "Mestre", "MES", "#14fb4b", "#ffffff", 49],
      ["y4779_140293", "Legnago Salus", "LEG", "#a74e75", "#ffffff", 48],
      ["y4779_142949", "Virtus Bolzano", "VIR", "#53f3a9", "#ffffff", 49],
      ["y4779_142951", "Campodarsego", "CAM", "#5171cd", "#ffffff", 54],
      ["y4779_142957", "Cjarlins Muzane", "CJA", "#7eb296", "#ffffff", 55],
      ["y4779_142958", "Union Clodiense Chioggia", "UNI", "#2df489", "#ffffff", 53],
      ["y4779_142960", "Este", "EST", "#65e474", "#ffffff", 52],
      ["y4779_142961", "Luparense", "LUP", "#524d20", "#ffffff", 56],
      ["y4779_149239", "Brian Lignano", "BRI", "#25543f", "#ffffff", 55],
      ["y4779_149240", "Calvi Noale", "CAL", "#4d2958", "#ffffff", 50],
      ["y4779_152843", "Obermais", "OBE", "#90c09a", "#ffffff", 55],
      ["y4779_153106", "Conegliano", "CON", "#90ca83", "#ffffff", 50],
      ["y4779_153107", "Unione La Rocca Altavilla", "UNI", "#b9f1c8", "#ffffff", 51],
      ["y4779_156649", "Lavarian Mortean Esperia", "LME", "#bca396", "#ffffff", 55],
      ["y4779_156650", "Sandon\xE0", "SAN", "#c1eb57", "#ffffff", 55],
      ["y4779_156651", "Schio", "SCH", "#3e27a2", "#ffffff", 49]
    ]
  },
  {
    id: "y4780",
    name: "Italy Serie D Girone E",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4780_133973", "Nuova Ternana 1925", "NUO", "#a4bacb", "#ffffff", 55],
      ["y4780_134672", "Prato", "PRA", "#c4eb24", "#ffffff", 51],
      ["y4780_134674", "Lucchese", "LUC", "#cf212c", "#ffffff", 52],
      ["y4780_135898", "Follonica Gavorrano", "FOL", "#8e368e", "#ffffff", 53],
      ["y4780_135951", "Siena", "SIE", "#287d66", "#ffffff", 48],
      ["y4780_142925", "Ghiviborgo", "GHI", "#f15a50", "#ffffff", 54],
      ["y4780_142930", "Seravezza Pozzi", "SER", "#e59954", "#ffffff", 50],
      ["y4780_142977", "Mezzolara", "MEZ", "#c68e7f", "#ffffff", 48],
      ["y4780_142982", "SCD Progresso", "SCD", "#125fef", "#ffffff", 51],
      ["y4780_142990", "Flaminia", "FLA", "#19a053", "#ffffff", 53],
      ["y4780_142991", "Grassina", "GRA", "#3c5e8c", "#ffffff", 51],
      ["y4780_142992", "Aquila Montevarchi", "AQU", "#f50e0a", "#ffffff", 54],
      ["y4780_142994", "San Donato Tavarnelle", "SAN", "#f0e69a", "#ffffff", 48],
      ["y4780_142996", "Scandicci", "SCA", "#ed822a", "#ffffff", 51],
      ["y4780_143904", "Sasso Marconi", "SAS", "#7c79d6", "#ffffff", 56],
      ["y4780_146941", "Tau Calcio Altopascio", "TAU", "#ca1690", "#ffffff", 50],
      ["y4780_146942", "Terranuova Traiana", "TER", "#d42c89", "#ffffff", 54],
      ["y4780_156653", "Rondinella Marzocco", "RON", "#5ac5d0", "#ffffff", 55]
    ]
  },
  {
    id: "y4782",
    name: "Italy Serie D Girone F",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4782_133971", "Lanciano", "LAN", "#8f9104", "#ffffff", 55],
      ["y4782_134663", "Teramo", "TER", "#508de0", "#ffffff", 50],
      ["y4782_134800", "L'Aquila", "LAQ", "#648276", "#ffffff", 55],
      ["y4782_135952", "Maceratese", "MAC", "#f1ede6", "#ffffff", 53],
      ["y4782_140302", "Notaresco", "NOT", "#b549d7", "#ffffff", 54],
      ["y4782_142989", "Foligno", "FOL", "#62d3e5", "#ffffff", 56],
      ["y4782_142997", "Sporting Trestina", "SPO", "#3c58db", "#ffffff", 52],
      ["y4782_143010", "Giulianova", "GIU", "#7e0932", "#ffffff", 56],
      ["y4782_143011", "Recanatese", "REC", "#48271a", "#ffffff", 51],
      ["y4782_143521", "Ancona", "ANC", "#1e40cb", "#ffffff", 51],
      ["y4782_146944", "Termoli", "TER", "#518bea", "#ffffff", 53],
      ["y4782_146945", "Vigor Senigallia", "VIG", "#28c845", "#ffffff", 52],
      ["y4782_149246", "Atletico Ascoli", "ATL", "#d2b140", "#ffffff", 51],
      ["y4782_149249", "Fossombrone", "FOS", "#b71917", "#ffffff", 56],
      ["y4782_156654", "Angelana", "ANG", "#9b0c9e", "#ffffff", 48],
      ["y4782_156655", "K-Sport Montecchio Gallo", "KSP", "#368099", "#ffffff", 53],
      ["y4782_156656", "Pietralunghese", "PIE", "#2a9019", "#ffffff", 54],
      ["y4782_156657", "Santegidiese", "SAN", "#bc25ba", "#ffffff", 51]
    ]
  },
  {
    id: "y4784",
    name: "Italy Serie D Girone H",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4784_134683", "Melfi", "MEL", "#e240ac", "#ffffff", 50],
      ["y4784_134684", "Ischia Isolaverde", "ISC", "#bb9669", "#ffffff", 51],
      ["y4784_134786", "Nocerina", "NOC", "#6bc6ef", "#ffffff", 55],
      ["y4784_135737", "Virtus Francavilla", "VIR", "#bdc1d1", "#ffffff", 51],
      ["y4784_135896", "Bisceglie", "BIS", "#da956c", "#ffffff", 52],
      ["y4784_135954", "Fidelis Andria", "FID", "#65c046", "#ffffff", 54],
      ["y4784_140295", "Turris", "TUR", "#8e182a", "#ffffff", 50],
      ["y4784_143029", "Nard\xF2", "NAR", "#39c41a", "#ffffff", 49],
      ["y4784_143034", "Brindisi", "BRI", "#a4fa0d", "#ffffff", 48],
      ["y4784_143035", "Francavilla", "FRA", "#59e706", "#ffffff", 53],
      ["y4784_143036", "Gladiator", "GLA", "#cb40ae", "#ffffff", 48],
      ["y4784_143037", "Gravina", "GRA", "#4aa1f5", "#ffffff", 48],
      ["y4784_144187", "Real Aversa", "REA", "#b0e037", "#ffffff", 51],
      ["y4784_146950", "Palmese", "PAL", "#3934b8", "#ffffff", 49],
      ["y4784_146952", "Martina", "MAR", "#99e1ec", "#ffffff", 50],
      ["y4784_149256", "Manfredonia", "MAN", "#6a1b24", "#ffffff", 50],
      ["y4784_156662", "Ebolitana", "EBO", "#47be98", "#ffffff", 53],
      ["y4784_156663", "Real Forio", "REA", "#cf0e68", "#ffffff", 48]
    ]
  },
  {
    id: "y4785",
    name: "Italy Serie D Girone I",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4785_133699", "Reggina", "REG", "#4bd407", "#ffffff", 56],
      ["y4785_134801", "Vigor Lamezia", "VIG", "#ac1893", "#ffffff", 53],
      ["y4785_135730", "Vibonese", "VIB", "#edce3d", "#ffffff", 56],
      ["y4785_135732", "Siracusa", "SIR", "#0a0c0e", "#ffffff", 48],
      ["y4785_143047", "Licata", "LIC", "#71614d", "#ffffff", 55],
      ["y4785_144191", "Trapani", "TRA", "#f7ccc1", "#ffffff", 49],
      ["y4785_147198", "CastrumFavara", "CAS", "#ecec42", "#ffffff", 53],
      ["y4785_147201", "Ragusa", "RAG", "#ea5973", "#ffffff", 56],
      ["y4785_149259", "Enna", "ENN", "#ce83b6", "#ffffff", 54],
      ["y4785_149260", "Nuova Igea Virtus", "NUO", "#b6102f", "#ffffff", 51],
      ["y4785_149261", "Nissa", "NIS", "#0545f9", "#ffffff", 52],
      ["y4785_149263", "Sambiase", "SAM", "#b5b524", "#ffffff", 50],
      ["y4785_153116", "Athletic Palermo", "ATH", "#45c70f", "#ffffff", 50],
      ["y4785_153117", "Citt\xE0 di Gela", "CIT", "#112c57", "#ffffff", 53],
      ["y4785_153118", "Milazzo", "MIL", "#22357a", "#ffffff", 48],
      ["y4785_156664", "Avola", "AVO", "#60aba2", "#ffffff", 56],
      ["y4785_156665", "Modica", "MOD", "#ccdb25", "#ffffff", 51],
      ["y4785_156666", "Digiesse PraiaTortora", "DIG", "#a9eb06", "#ffffff", 51]
    ]
  },
  {
    id: "y4783",
    name: "Italy Serie D Girone G",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4783_134679", "Paganese", "PAG", "#85220b", "#ffffff", 49],
      ["y4783_140296", "Latte Dolce", "LAT", "#861eb2", "#ffffff", 56],
      ["y4783_140298", "Gelbison", "GEL", "#73d87f", "#ffffff", 52],
      ["y4783_140299", "Trastevere", "TRA", "#804892", "#ffffff", 53],
      ["y4783_142984", "Albalonga", "ALB", "#414009", "#ffffff", 49],
      ["y4783_143018", "Budoni", "BUD", "#10c96c", "#ffffff", 49],
      ["y4783_143020", "Citt\xE0 di Anagni", "CIT", "#9e2908", "#ffffff", 55],
      ["y4783_143915", "Unipomezia", "UNI", "#e08228", "#ffffff", 50],
      ["y4783_144170", "Afragolese", "AFR", "#145079", "#ffffff", 56],
      ["y4783_146948", "Sarrabus Ogliastra", "SAR", "#c49210", "#ffffff", 54],
      ["y4783_149251", "Anzio", "ANZ", "#ac9d0e", "#ffffff", 55],
      ["y4783_149252", "Atletico Lodigiani", "ATL", "#a04274", "#ffffff", 48],
      ["y4783_149253", "Sarnese", "SAR", "#2a0beb", "#ffffff", 50],
      ["y4783_153112", "Monastir", "MON", "#359134", "#ffffff", 52],
      ["y4783_156658", "Aranova", "ARA", "#b276d4", "#ffffff", 50],
      ["y4783_156659", "Ossese", "OSS", "#59a810", "#ffffff", 48],
      ["y4783_156660", "Venafro", "VEN", "#681f09", "#ffffff", 56],
      ["y4783_156661", "Certosa Vigor Campagnano", "CER", "#ae92f4", "#ffffff", 48]
    ]
  },
  {
    id: "y4786",
    name: "Italy Serie D Girone A",
    country: "It\xE1lia",
    flag: "\u{1F1EE}\u{1F1F9}",
    clubs: [
      ["y4786_134661", "Alessandria", "ALE", "#45602a", "#ffffff", 48],
      ["y4786_137119", "Gozzano", "GOZ", "#9ed769", "#ffffff", 54],
      ["y4786_142919", "Borgosesia", "BOR", "#65758c", "#ffffff", 56],
      ["y4786_142920", "Bra", "BRA", "#9ce0fd", "#ffffff", 54],
      ["y4786_142923", "Fezzanese", "FEZ", "#4668b8", "#ffffff", 50],
      ["y4786_142927", "Ligorna", "LIG", "#0d0d32", "#ffffff", 51],
      ["y4786_142929", "Sanremese", "SAN", "#4121de", "#ffffff", 52],
      ["y4786_143887", "Asti", "AST", "#94387d", "#ffffff", 52],
      ["y4786_143889", "Derthona", "DER", "#097def", "#ffffff", 55],
      ["y4786_143890", "Imperia", "IMP", "#0392de", "#ffffff", 54],
      ["y4786_143893", "Saluzzo", "SAL", "#08fa84", "#ffffff", 48],
      ["y4786_143894", "Sestri Levante", "SES", "#eb9d09", "#ffffff", 53],
      ["y4786_146928", "Chisola", "CHI", "#81e405", "#ffffff", 53],
      ["y4786_153103", "Biellese", "BIE", "#88aa81", "#ffffff", 55],
      ["y4786_153104", "Celle Varazze", "CEL", "#9a8473", "#ffffff", 53],
      ["y4786_153105", "Valenzana Mado", "VAL", "#77aaf2", "#ffffff", 53],
      ["y4786_156645", "Lascaris", "LAS", "#73405c", "#ffffff", 56],
      ["y4786_156646", "Millesimo", "MIL", "#8d1b8d", "#ffffff", 54]
    ]
  },
  {
    id: "y5095",
    name: "Highland League",
    country: "Esc\xF3cia",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    clubs: [
      ["y5095_140312", "Brora Rangers", "BRO", "#e82790", "#ffffff", 54],
      ["y5095_142342", "Buckie Thistle", "BUC", "#736288", "#ffffff", 56],
      ["y5095_142343", "Clachnacuddin", "CLA", "#5555b9", "#ffffff", 48],
      ["y5095_142344", "Deveronvale", "DEV", "#ab5e7c", "#ffffff", 49],
      ["y5095_142345", "Formartine United", "FOR", "#139baa", "#ffffff", 49],
      ["y5095_142346", "Forres Mechanics", "FOR", "#cff026", "#ffffff", 56],
      ["y5095_142348", "Fraserburgh", "FRA", "#e3fc20", "#ffffff", 49],
      ["y5095_142349", "Huntly", "HUN", "#541b5a", "#ffffff", 49],
      ["y5095_142350", "Inverurie Loco Works", "INV", "#47d8ce", "#ffffff", 50],
      ["y5095_142351", "Keith", "KEI", "#901ab0", "#ffffff", 51],
      ["y5095_142352", "Lossiemouth", "LOS", "#e7c8b7", "#ffffff", 54],
      ["y5095_142353", "Nairn County", "NAI", "#ee251a", "#ffffff", 52],
      ["y5095_142354", "Rothes", "ROT", "#7851ea", "#ffffff", 52],
      ["y5095_142355", "Strathspey Thistle", "STR", "#64954d", "#ffffff", 53],
      ["y5095_142356", "Turriff United", "TUR", "#a2efac", "#ffffff", 49],
      ["y5095_142357", "Wick Academy", "WIC", "#624587", "#ffffff", 52],
      ["y5095_142750", "Banks o' Dee", "BAN", "#45ab3e", "#ffffff", 51],
      ["y5095_149151", "Invergordon", "INV", "#a53a95", "#ffffff", 53]
    ]
  },
  {
    id: "y5798",
    name: "III liga Group I",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["y5798_138907", "Wigry Suwa\u0142ki", "WIG", "#be2f4d", "#ffffff", 50],
      ["y5798_143921", "\u015Awit Nowy Dw\xF3r Mazowiecki", "WIT", "#f01d1c", "#ffffff", 55],
      ["y5798_153536", "\u0141KS \u0141\xF3d\u017A II", "KSD", "#4e9298", "#ffffff", 48],
      ["y5798_154242", "Warta Sieradz", "WAR", "#60b70f", "#ffffff", 55],
      ["y5798_154243", "\u0141KS \u0141om\u017Ca", "KSO", "#483282", "#ffffff", 52],
      ["y5798_154244", "Z\u0105bkovia Z\u0105bki", "ZBK", "#01ca0d", "#ffffff", 54],
      ["y5798_154246", "Wis\u0142a P\u0142ock II", "WIS", "#2b63a9", "#ffffff", 48],
      ["y5798_154248", "Troszyn", "TRO", "#cd7ced", "#ffffff", 50],
      ["y5798_154249", "Lechia Tomasz\xF3w Mazowiecki", "LEC", "#312f6b", "#ffffff", 52],
      ["y5798_154250", "Olimpia Elbl\u0105g", "OLI", "#f752ed", "#ffffff", 56],
      ["y5798_154251", "Widzew \u0141\xF3d\u017A II", "WID", "#801e4d", "#ffffff", 48],
      ["y5798_154252", "Jagiellonia Bia\u0142ystok II", "JAG", "#e7b060", "#ffffff", 50],
      ["y5798_154253", "M\u0142awianka M\u0142awa", "MAW", "#9708a6", "#ffffff", 49],
      ["y5798_156076", "Pelikan \u0141owicz", "PEL", "#06480f", "#ffffff", 50],
      ["y5798_156077", "Wesz\u0142o", "WES", "#7284db", "#ffffff", 52],
      ["y5798_156078", "Mazovia Mi\u0144sk Mazowiecki", "MAZ", "#7e77ee", "#ffffff", 49],
      ["y5798_156079", "Olimpia Zambr\xF3w", "OLI", "#59a0b8", "#ffffff", 55],
      ["y5798_156080", "Polonia Lidzbark Warmi\u0144ski", "POL", "#e1a961", "#ffffff", 50]
    ]
  },
  {
    id: "y5799",
    name: "III liga Group II",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["y5799_153535", "KKS 1925 Kalisz", "KKS", "#fac3dd", "#ffffff", 56],
      ["y5799_154273", "Polonia \u015Aroda Wielkopolska", "POL", "#6dcf32", "#ffffff", 49],
      ["y5799_154274", "Luzino", "LUZ", "#22fe40", "#ffffff", 50],
      ["y5799_154275", "Elana Toru\u0144", "ELA", "#7905ea", "#ffffff", 48],
      ["y5799_154276", "Lech Pozna\u0144 II", "LEC", "#c0161d", "#ffffff", 50],
      ["y5799_154290", "Lipno St\u0119szew", "LIP", "#ac9a48", "#ffffff", 50],
      ["y5799_154291", "Flota \u015Awinouj\u015Bcie", "FLO", "#e9d892", "#ffffff", 56],
      ["y5799_154292", "B\u0142\u0119kitni Stargard", "BKI", "#a042df", "#ffffff", 55],
      ["y5799_154293", "Wda \u015Awiecie", "WDA", "#bcf1c5", "#ffffff", 53],
      ["y5799_154294", "Note\u0107 Czarnk\xF3w", "NOT", "#be89ba", "#ffffff", 55],
      ["y5799_154295", "Kluczevia Stargard", "KLU", "#df9872", "#ffffff", 51],
      ["y5799_154298", "Unia Swarz\u0119dz", "UNI", "#aceb65", "#ffffff", 56],
      ["y5799_154299", "Victoria Wrze\u015Bnia", "VIC", "#3630c5", "#ffffff", 56],
      ["y5799_155937", "Chemik Bydgoszcz", "CHE", "#f8c2f6", "#ffffff", 49],
      ["y5799_156081", "Gedania Gda\u0144sk", "GED", "#1de7f3", "#ffffff", 51],
      ["y5799_156082", "Grom Nowy Staw", "GRO", "#1e4c59", "#ffffff", 52],
      ["y5799_156083", "Kotwica K\xF3rnik", "KOT", "#740490", "#ffffff", 48],
      ["y5799_156084", "Ba\u0142tyk Koszalin", "BAT", "#2283ee", "#ffffff", 54]
    ]
  },
  {
    id: "y5801",
    name: "III liga Group IV",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["y5801_154328", "KSZO Ostrowiec \u015Awi\u0119tokrzyski", "KSZ", "#7b5db5", "#ffffff", 53],
      ["y5801_154329", "Che\u0142mianka Che\u0142m", "CHE", "#914111", "#ffffff", 52],
      ["y5801_154330", "Wi\u015Blanie Skawina", "WIL", "#63d6d9", "#ffffff", 48],
      ["y5801_154331", "Star Starachowice", "STA", "#bea13e", "#ffffff", 56],
      ["y5801_154332", "Siarka Tarnobrzeg", "SIA", "#17c578", "#ffffff", 55],
      ["y5801_154333", "Podlasie Bia\u0142a Podlaska", "POD", "#513661", "#ffffff", 49],
      ["y5801_154334", "Pogo\u0144-Sok\xF3\u0142 Lubacz\xF3w", "POG", "#5d822a", "#ffffff", 48],
      ["y5801_154335", "Korona Kielce II", "KOR", "#6ded0d", "#ffffff", 55],
      ["y5801_154348", "Wis\u0142oka D\u0119bica", "WIS", "#257508", "#ffffff", 49],
      ["y5801_154349", "Czarni Po\u0142aniec", "CZA", "#8c2a8f", "#ffffff", 56],
      ["y5801_154350", "Wis\u0142a Krak\xF3w II", "WIS", "#565f44", "#ffffff", 55],
      ["y5801_154353", "Naprz\xF3d J\u0119drzej\xF3w", "NAP", "#d0fc9a", "#ffffff", 51],
      ["y5801_154355", "Sok\xF3\u0142 Kolbuszowa Dolna", "SOK", "#b4a0ec", "#ffffff", 52],
      ["y5801_156089", "Hetman Zamo\u015B\u0107", "HET", "#8e6bc3", "#ffffff", 48],
      ["y5801_156090", "Wieczysta Krak\xF3w II", "WIE", "#e26943", "#ffffff", 50],
      ["y5801_156091", "JKS Jaros\u0142aw", "JKS", "#d52b20", "#ffffff", 49],
      ["y5801_156092", "AKS 1947 Busko-Zdr\xF3j", "AKS", "#6092f8", "#ffffff", 56],
      ["y5801_156093", "Moravia Morawica", "MOR", "#b3d8b4", "#ffffff", 55]
    ]
  },
  {
    id: "y5800",
    name: "III liga Group III",
    country: "Pol\xF4nia",
    flag: "\u{1F1F5}\u{1F1F1}",
    clubs: [
      ["y5800_136196", "Zag\u0142\u0119bie Sosnowiec", "ZAG", "#9e6346", "#ffffff", 54],
      ["y5800_142468", "G\xF3rnik Polkowice", "GRN", "#67d084", "#ffffff", 53],
      ["y5800_142469", "Skra Cz\u0119stochowa", "SKR", "#ef788d", "#ffffff", 48],
      ["y5800_154303", "Sparta Katowice", "SPA", "#dec34e", "#ffffff", 49],
      ["y5800_154313", "Zag\u0142\u0119bie Lubin II", "ZAG", "#4cc5ea", "#ffffff", 51],
      ["y5800_154314", "Gocza\u0142kowice-Zdr\xF3j", "GOC", "#cd60d5", "#ffffff", 53],
      ["y5800_154315", "Carina Gubin", "CAR", "#dfa7e9", "#ffffff", 55],
      ["y5800_154316", "Kluczbork", "KLU", "#b1f10f", "#ffffff", 52],
      ["y5800_154317", "Warta Gorz\xF3w Wielkopolski", "WAR", "#0f7001", "#ffffff", 50],
      ["y5800_154319", "Karkonosze Jelenia G\xF3ra", "KAR", "#bd5039", "#ffffff", 48],
      ["y5800_154321", "\u015Al\u0119za Wroc\u0142aw", "LZA", "#3a152a", "#ffffff", 51],
      ["y5800_154322", "S\u0142owianin Wolib\xF3rz", "SOW", "#813343", "#ffffff", 54],
      ["y5800_154323", "Mied\u017A Legnica II", "MIE", "#929162", "#ffffff", 48],
      ["y5800_154965", "Odra Bytom Odrza\u0144ski", "ODR", "#e64f45", "#ffffff", 53],
      ["y5800_156085", "Barycz Su\u0142\xF3w", "BAR", "#ddc9b8", "#ffffff", 54],
      ["y5800_156086", "Stilon Gorz\xF3w Wielkopolski", "STI", "#42d44d", "#ffffff", 55],
      ["y5800_156087", "Stal Brzeg", "STA", "#4385e0", "#ffffff", 52],
      ["y5800_156088", "ROW 1964 Rybnik", "ROW", "#827bdb", "#ffffff", 50]
    ]
  },
  {
    id: "y5870",
    name: "3 Lig Group 3",
    country: "Turquia",
    flag: "\u{1F1F9}\u{1F1F7}",
    clubs: [
      ["y5870_134227", "Yeni Malatyaspor", "YEN", "#6260e7", "#ffffff", 50],
      ["y5870_138978", "K\u0131r\u015Fehir", "KRE", "#1f2852", "#ffffff", 56],
      ["y5870_143378", "Diyarbekirspor", "DIY", "#c5d33f", "#ffffff", 49],
      ["y5870_147641", "Yeni Mersin \u0130dmanyurdu", "YEN", "#d9b8ed", "#ffffff", 49],
      ["y5870_147642", "Karaman", "KAR", "#368c65", "#ffffff", 50],
      ["y5870_149210", "Karak\xF6pr\xFC Belediyespor", "KAR", "#9e4950", "#ffffff", 55],
      ["y5870_149638", "Silifke Belediyespor", "SIL", "#7378ee", "#ffffff", 55],
      ["y5870_149639", "A\u011Fr\u0131 1970", "AR", "#e1122e", "#ffffff", 48],
      ["y5870_149648", "Osmaniyespor", "OSM", "#2e0176", "#ffffff", 53],
      ["y5870_149649", "Erciyes 38", "ERC", "#628ce9", "#ffffff", 56],
      ["y5870_149654", "K\u0131r\u0131kkale", "KRK", "#fc59ec", "#ffffff", 53],
      ["y5870_149656", "Maz\u0131da\u011F\u0131 Fosfatspor", "MAZ", "#0adc8a", "#ffffff", 52],
      ["y5870_149658", "Yozgat Belediyesi Bozokspor", "YOZ", "#5c69b0", "#ffffff", 49],
      ["y5870_149663", "Ni\u011Fde Belediyesispor", "NID", "#7d389c", "#ffffff", 53],
      ["y5870_149669", "Bitlis 1916", "BIT", "#672fe5", "#ffffff", 53],
      ["y5870_153068", "Malatya Ye\u015Filyurtspor", "MAL", "#62763d", "#ffffff", 53],
      ["y5870_156262", "Adaletg\xFCc\xFC", "ADA", "#8650ce", "#ffffff", 51]
    ]
  }
];
var ACCESS_LEAGUES = RAW2.map((l) => ({
  id: l.id,
  name: l.name,
  country: l.country,
  flag: l.flag,
  clubs: l.clubs.map(([id, name, short, primary, secondary, strength]) => ({
    id,
    name,
    short,
    league: l.id,
    primary,
    secondary,
    strength
  }))
}));

// src/game/data/leagues-extra.ts
var RUS = [
  ["rus_zen", "Zenit", "ZEN", "#0a5cb8", "#8ec63f", 79],
  ["rus_spa", "Spartak Moscou", "SPA", "#c8102e", "#ffffff", 77],
  ["rus_csk", "CSKA Moscou", "CSK", "#1f3f95", "#c8102e", 77],
  ["rus_din", "D\xEDnamo Moscou", "DIN", "#1f4fa0", "#ffffff", 75],
  ["rus_kra", "Krasnodar", "KRA", "#0a8f3c", "#111111", 76],
  ["rus_loc", "Lokomotiv Moscou", "LOK", "#0a8f3c", "#c8102e", 75],
  ["rus_rub", "Rubin Kazan", "RUB", "#8f1f2f", "#0a8f3c", 72],
  ["rus_ros", "Rostov", "ROS", "#f5c400", "#1f4fa0", 71],
  ["rus_sam", "Krylia Sovetov", "KRY", "#1f4fa0", "#7ec8e3", 70],
  ["rus_akh", "Akhmat Grozny", "AKH", "#0a8f3c", "#ffffff", 70],
  ["rus_ura", "Ural", "URA", "#f5820a", "#111111", 69],
  ["rus_sochi", "Sochi", "SOC", "#111111", "#7ec8e3", 68]
];
var ISR = [
  ["isr_mha", "Maccabi Haifa", "MHA", "#0a8f3c", "#ffffff", 74],
  ["isr_mtl", "Maccabi Tel Aviv", "MTA", "#f5c400", "#1f4fa0", 75],
  ["isr_hbs", "Hapoel Be'er Sheva", "HBS", "#c8102e", "#ffffff", 73],
  ["isr_hte", "Hapoel Tel Aviv", "HTA", "#c8102e", "#ffffff", 70],
  ["isr_bei", "Beitar Jerusal\xE9m", "BEI", "#f5c400", "#111111", 70],
  ["isr_mne", "Maccabi Netanya", "MNE", "#f5c400", "#111111", 68],
  ["isr_bnei", "Bnei Sakhnin", "BNS", "#c8102e", "#ffffff", 66],
  ["isr_asd", "Maccabi Bnei Raina", "MBR", "#0a8f3c", "#ffffff", 65],
  ["isr_had", "Hapoel Hadera", "HAD", "#1f4fa0", "#ffffff", 65],
  ["isr_ash", "FC Ashdod", "ASH", "#c8102e", "#f5c400", 66]
];
var HUN = [
  ["hun_fer", "Ferencv\xE1ros", "FER", "#0a8f3c", "#ffffff", 74],
  ["hun_pak", "Paksi", "PAK", "#0a8f3c", "#f5c400", 68],
  ["hun_fev", "Feh\xE9rv\xE1r", "FEV", "#c8102e", "#1f4fa0", 69],
  ["hun_pus", "Pusk\xE1s Akad\xE9mia", "PUS", "#1f4fa0", "#f5c400", 70],
  ["hun_deb", "Debrecen", "DEB", "#c8102e", "#ffffff", 68],
  ["hun_uje", "\xDAjpest", "UJP", "#5b2d8e", "#ffffff", 67],
  ["hun_mtk", "MTK Budapest", "MTK", "#1f4fa0", "#ffffff", 66],
  ["hun_kis", "Kisv\xE1rda", "KIS", "#f5c400", "#111111", 65],
  ["hun_zte", "ZTE", "ZTE", "#1f4fa0", "#ffffff", 65],
  ["hun_gyo", "Gy\u0151r ETO", "ETO", "#0a8f3c", "#ffffff", 66]
];
var BUL = [
  ["bul_lud", "Ludogorets", "LUD", "#0a8f3c", "#ffffff", 73],
  ["bul_csk", "CSKA Sofia", "CSK", "#c8102e", "#111111", 70],
  ["bul_lev", "Levski Sofia", "LEV", "#1f4fa0", "#ffffff", 70],
  ["bul_lok", "Lokomotiv Plovdiv", "LOK", "#111111", "#7ec8e3", 68],
  ["bul_bot", "Botev Plovdiv", "BOT", "#f5c400", "#111111", 66],
  ["bul_ars", "Arda", "ARD", "#c8102e", "#ffffff", 65],
  ["bul_cher", "Cherno More", "CHE", "#1f4fa0", "#ffffff", 65],
  ["bul_sla", "Slavia Sofia", "SLA", "#ffffff", "#111111", 64]
];
var SVK = [
  ["svk_slo", "Slovan Bratislava", "SLO", "#7ec8e3", "#ffffff", 72],
  ["svk_spa", "Spartak Trnava", "TRN", "#c8102e", "#111111", 69],
  ["svk_zil", "M\u0160K \u017Dilina", "ZIL", "#f5c400", "#0a8f3c", 68],
  ["svk_dun", "DAC Dunajsk\xE1 Streda", "DAC", "#f5c400", "#1f4fa0", 68],
  ["svk_ruz", "Ru\u017Eomberok", "RUZ", "#c8102e", "#ffffff", 65],
  ["svk_pod", "Podbrezov\xE1", "POD", "#0a8f3c", "#ffffff", 64],
  ["svk_kos", "Ko\u0161ice", "KOS", "#f5c400", "#111111", 64],
  ["svk_mic", "Zempl\xEDn Michalovce", "MIC", "#1f4fa0", "#f5c400", 62]
];
var SVN = [
  ["svn_olim", "Olimpija Ljubljana", "OLI", "#0a8f3c", "#ffffff", 70],
  ["svn_mar", "Maribor", "MAR", "#5b2d8e", "#f5c400", 69],
  ["svn_cel", "Celje", "CEL", "#f5c400", "#1f4fa0", 69],
  ["svn_mur", "Mura", "MUR", "#111111", "#f5c400", 65],
  ["svn_bra", "Bravo", "BRA", "#0a8f3c", "#ffffff", 64],
  ["svn_kop", "Koper", "KOP", "#f5c400", "#0a8f3c", 65],
  ["svn_dom", "Dom\u017Eale", "DOM", "#f5c400", "#1f4fa0", 63],
  ["svn_rad", "Radomlje", "RAD", "#0a8f3c", "#ffffff", 62]
];
var CYP = [
  ["cyp_apo", "APOEL", "APO", "#1f4fa0", "#f5c400", 70],
  ["cyp_omo", "Omonia", "OMO", "#0a8f3c", "#ffffff", 70],
  ["cyp_apol", "Apollon Limassol", "APL", "#1f4fa0", "#ffffff", 69],
  ["cyp_ael", "AEL Limassol", "AEL", "#f5c400", "#1f4fa0", 67],
  ["cyp_ari", "Aris Limassol", "ARI", "#f5c400", "#1f4fa0", 69],
  ["cyp_pafos", "Pafos FC", "PAF", "#1f4fa0", "#f5c400", 69],
  ["cyp_anor", "Anorthosis", "ANO", "#1f4fa0", "#ffffff", 66],
  ["cyp_ek", "Ethnikos Achna", "ETH", "#0a8f3c", "#ffffff", 63]
];
var IRL = [
  ["irl_sha", "Shamrock Rovers", "SHA", "#0a8f3c", "#ffffff", 69],
  ["irl_shel", "Shelbourne", "SHE", "#c8102e", "#ffffff", 67],
  ["irl_der", "Derry City", "DER", "#c8102e", "#ffffff", 67],
  ["irl_boh", "Bohemians", "BOH", "#c8102e", "#111111", 66],
  ["irl_stp", "St Patrick's Athletic", "STP", "#c8102e", "#ffffff", 66],
  ["irl_gal", "Galway United", "GAL", "#7a1b30", "#ffffff", 63],
  ["irl_dro", "Drogheda United", "DRO", "#c8102e", "#111111", 63],
  ["irl_wat", "Waterford", "WAT", "#1f4fa0", "#ffffff", 63]
];
var FIN = [
  ["fin_hjk", "HJK Helsinki", "HJK", "#1f4fa0", "#ffffff", 69],
  ["fin_kup", "KuPS", "KUP", "#f5c400", "#111111", 68],
  ["fin_ilv", "Ilves", "ILV", "#0a8f3c", "#ffffff", 66],
  ["fin_int", "Inter Turku", "INT", "#1f4fa0", "#ffffff", 66],
  ["fin_sjk", "SJK", "SJK", "#111111", "#ffffff", 65],
  ["fin_vps", "VPS", "VPS", "#1f4fa0", "#f5c400", 63],
  ["fin_hak", "Haka", "HAK", "#1f4fa0", "#ffffff", 62],
  ["fin_ifk", "IFK Mariehamn", "IFK", "#c8102e", "#ffffff", 62]
];
var ISL = [
  ["isl_val", "Valur", "VAL", "#c8102e", "#ffffff", 64],
  ["isl_bre", "Brei\xF0ablik", "BRE", "#0a8f3c", "#ffffff", 66],
  ["isl_vik", "V\xEDkingur Reykjav\xEDk", "VIK", "#c8102e", "#111111", 65],
  ["isl_kr", "KR Reykjav\xEDk", "KR", "#111111", "#ffffff", 64],
  ["isl_fh", "FH Hafnarfj\xF6r\xF0ur", "FH", "#1f4fa0", "#ffffff", 63],
  ["isl_stj", "Stjarnan", "STJ", "#1f4fa0", "#f5c400", 62],
  ["isl_kef", "Keflav\xEDk", "KEF", "#1f4fa0", "#ffffff", 61],
  ["isl_fra", "Fram", "FRA", "#1f4fa0", "#c8102e", 60]
];
var VEN = [
  ["ven_cara", "Caracas FC", "CAR", "#c8102e", "#111111", 67],
  ["ven_tac", "Deportivo T\xE1chira", "TAC", "#f5c400", "#111111", 67],
  ["ven_lag", "Deportivo La Guaira", "LAG", "#f5820a", "#1f4fa0", 66],
  ["ven_car", "Carabobo FC", "CBO", "#1f4fa0", "#ffffff", 66],
  ["ven_zam", "Zamora FC", "ZAM", "#111111", "#f5c400", 64],
  ["ven_mon", "Monagas", "MON", "#1f4fa0", "#f5c400", 64],
  ["ven_por", "Portuguesa", "POR", "#c8102e", "#111111", 62],
  ["ven_met", "Metropolitanos", "MET", "#0a8f3c", "#ffffff", 63]
];
var CRC = [
  ["crc_sap", "Saprissa", "SAP", "#5b2d8e", "#ffffff", 69],
  ["crc_ala", "LD Alajuelense", "ALA", "#c8102e", "#111111", 69],
  ["crc_her", "Herediano", "HER", "#f5c400", "#c8102e", 68],
  ["crc_car", "Cartagin\xE9s", "CAR", "#1f4fa0", "#ffffff", 66],
  ["crc_pun", "Puntarenas FC", "PUN", "#f5820a", "#111111", 63],
  ["crc_gua", "Guanacasteca", "GUA", "#0a8f3c", "#ffffff", 62],
  ["crc_sc", "San Carlos", "SCA", "#c8102e", "#f5c400", 62],
  ["crc_per", "P\xE9rez Zeled\xF3n", "PZE", "#0a8f3c", "#ffffff", 61]
];
var IND = [
  ["ind_mob", "Mohun Bagan", "MBS", "#0a8f3c", "#7a1b30", 68],
  ["ind_beng", "Bengaluru FC", "BFC", "#1f4fa0", "#f5c400", 67],
  ["ind_mci", "Mumbai City", "MCI", "#7ec8e3", "#ffffff", 68],
  ["ind_fcg", "FC Goa", "GOA", "#f5820a", "#1f4fa0", 67],
  ["ind_ker", "Kerala Blasters", "KBF", "#f5c400", "#111111", 65],
  ["ind_eb", "East Bengal", "EBL", "#c8102e", "#f5c400", 64],
  ["ind_ohy", "Odisha FC", "ODI", "#5b2d8e", "#f5c400", 65],
  ["ind_jam", "Jamshedpur FC", "JAM", "#c8102e", "#111111", 64],
  ["ind_che", "Chennaiyin FC", "CHE", "#1f4fa0", "#f5c400", 63],
  ["ind_nor", "NorthEast United", "NEU", "#c8102e", "#111111", 62]
];
var CHN = [
  ["chn_sha", "Shanghai Port", "SHP", "#c8102e", "#111111", 73],
  ["chn_shen", "Shanghai Shenhua", "SHE", "#1f4fa0", "#ffffff", 72],
  ["chn_bei", "Beijing Guoan", "BEI", "#0a8f3c", "#ffffff", 72],
  ["chn_shan", "Shandong Taishan", "SHA", "#f5820a", "#111111", 73],
  ["chn_che", "Chengdu Rongcheng", "CHE", "#c8102e", "#f5c400", 71],
  ["chn_zhe", "Zhejiang FC", "ZHE", "#0a8f3c", "#ffffff", 70],
  ["chn_wuh", "Wuhan Three Towns", "WUH", "#c8102e", "#ffffff", 70],
  ["chn_hen", "Henan FC", "HEN", "#c8102e", "#f5c400", 68],
  ["chn_qin", "Qingdao Hainiu", "QIN", "#1f4fa0", "#ffffff", 67],
  ["chn_tia", "Tianjin Jinmen Tiger", "TIA", "#1f4fa0", "#f5c400", 68]
];
var MAS = [
  ["mas_jdt", "Johor Darul Ta'zim", "JDT", "#1f4fa0", "#f5c400", 72],
  ["mas_sel", "Selangor", "SEL", "#c8102e", "#f5c400", 67],
  ["mas_ter", "Terengganu", "TER", "#111111", "#f5c400", 66],
  ["mas_sab", "Sabah FC", "SAB", "#1f4fa0", "#ffffff", 66],
  ["mas_kdh", "Kedah Darul Aman", "KDA", "#0a8f3c", "#f5c400", 64],
  ["mas_neg", "Negeri Sembilan", "NSE", "#c8102e", "#111111", 63],
  ["mas_pen", "Penang", "PEN", "#1f4fa0", "#ffffff", 62],
  ["mas_pdrm", "PDRM", "PDR", "#1f4fa0", "#f5c400", 61]
];
var VIE = [
  ["vie_han", "Hanoi FC", "HAN", "#5b2d8e", "#ffffff", 67],
  ["vie_cak", "CAHN", "CAH", "#c8102e", "#f5c400", 67],
  ["vie_nam", "Nam \u0110\u1ECBnh", "NAM", "#f5c400", "#111111", 66],
  ["vie_bin", "Becamex B\xECnh D\u01B0\u01A1ng", "BBD", "#1f4fa0", "#ffffff", 65],
  ["vie_thanh", "Thanh H\xF3a", "THA", "#f5820a", "#111111", 64],
  ["vie_vie", "Viettel", "VTL", "#c8102e", "#111111", 65],
  ["vie_hag", "Ho\xE0ng Anh Gia Lai", "HAG", "#1f4fa0", "#f5c400", 62],
  ["vie_hcm", "TP H\u1ED3 Ch\xED Minh", "HCM", "#c8102e", "#1f4fa0", 62]
];
var ALG = [
  ["alg_cra", "CR Belouizdad", "CRB", "#c8102e", "#ffffff", 70],
  ["alg_mca", "MC Alger", "MCA", "#0a8f3c", "#c8102e", 70],
  ["alg_jsk", "JS Kabylie", "JSK", "#f5c400", "#0a8f3c", 69],
  ["alg_usm", "USM Alger", "USM", "#c8102e", "#111111", 69],
  ["alg_ess", "ES S\xE9tif", "ESS", "#111111", "#ffffff", 68],
  ["alg_cs", "CS Constantine", "CSC", "#0a8f3c", "#ffffff", 67],
  ["alg_par", "Paradou AC", "PAC", "#f5c400", "#1f4fa0", 65],
  ["alg_bel", "USM Khenchela", "USK", "#c8102e", "#f5c400", 63]
];
var TUN = [
  ["tun_est", "Esp\xE9rance de Tunis", "EST", "#c8102e", "#f5c400", 72],
  ["tun_eta", "\xC9toile du Sahel", "ESS", "#c8102e", "#f5c400", 70],
  ["tun_csa", "Club Africain", "CA", "#c8102e", "#ffffff", 69],
  ["tun_cab", "CA Bizertin", "CAB", "#f5c400", "#111111", 66],
  ["tun_ust", "US Monastir", "USM", "#1f4fa0", "#ffffff", 67],
  ["tun_sta", "Stade Tunisien", "STA", "#0a8f3c", "#c8102e", 65],
  ["tun_jsk", "JS Kairouan", "JSK", "#f5c400", "#111111", 63],
  ["tun_ols", "Olympique B\xE9ja", "OB", "#0a8f3c", "#ffffff", 62]
];
var GHA = [
  ["gha_hea", "Hearts of Oak", "HOK", "#c8102e", "#f5c400", 66],
  ["gha_kot", "Asante Kotoko", "KOT", "#c8102e", "#ffffff", 67],
  ["gha_ade", "Aduana Stars", "ADU", "#f5c400", "#0a8f3c", 65],
  ["gha_med", "Medeama", "MED", "#f5c400", "#111111", 65],
  ["gha_ber", "Berekum Chelsea", "BCH", "#1f4fa0", "#ffffff", 63],
  ["gha_bec", "Bechem United", "BEC", "#0a8f3c", "#ffffff", 63],
  ["gha_nsu", "Nsoatreman", "NSO", "#c8102e", "#111111", 62],
  ["gha_sam", "Samartex", "SAM", "#0a8f3c", "#f5c400", 62]
];
var KEN = [
  ["ken_gor", "Gor Mahia", "GOR", "#0a8f3c", "#ffffff", 65],
  ["ken_afc", "AFC Leopards", "AFC", "#1f4fa0", "#ffffff", 63],
  ["ken_tus", "Tusker FC", "TUS", "#c8102e", "#ffffff", 64],
  ["ken_ken", "Kenya Police", "KPO", "#1f4fa0", "#f5c400", 63],
  ["ken_ban", "Bandari", "BAN", "#f5820a", "#1f4fa0", 62],
  ["ken_ulinzi", "Ulinzi Stars", "ULI", "#0a8f3c", "#f5c400", 61],
  ["ken_shab", "Shabana", "SHA", "#0a8f3c", "#ffffff", 60],
  ["ken_muran", "Murang'a Seal", "MUR", "#1f4fa0", "#ffffff", 60]
];
var ANG = [
  ["ang_pet", "Petro de Luanda", "PET", "#c8102e", "#f5c400", 67],
  ["ang_pri", "Primeiro de Agosto", "1AG", "#c8102e", "#111111", 67],
  ["ang_sag", "Sagrada Esperan\xE7a", "SAG", "#f5c400", "#0a8f3c", 64],
  ["ang_int", "Interclube", "INT", "#1f4fa0", "#ffffff", 63],
  ["ang_bra", "Bravos do Maquis", "BRA", "#0a8f3c", "#f5c400", 62],
  ["ang_wil", "Wiliete", "WIL", "#1f4fa0", "#f5c400", 61],
  ["ang_kab", "Kabuscorp", "KAB", "#c8102e", "#ffffff", 61],
  ["ang_lun", "Lunda Sul", "LUN", "#f5820a", "#111111", 60]
];
var POR2 = [
  ["por2_uni", "Uni\xE3o de Leiria", "UDL", "#c8102e", "#111111", 64],
  ["por2_ave", "Desportivo de Aves", "AVE", "#f5c400", "#111111", 63],
  ["por2_lei", "Leix\xF5es", "LEI", "#c8102e", "#ffffff", 65],
  ["por2_ten", "Tondela", "TON", "#f5c400", "#1f4fa0", 66],
  ["por2_pen", "Penafiel", "PEN", "#c8102e", "#f5c400", 64],
  ["por2_mar", "Mar\xEDtimo", "MAR", "#0a8f3c", "#c8102e", 67],
  ["por2_cha", "Chaves", "CHA", "#c8102e", "#1f4fa0", 66],
  ["por2_ben", "Benfica B", "BEB", "#c8102e", "#ffffff", 65],
  ["por2_por", "FC Porto B", "POB", "#1f4fa0", "#ffffff", 65],
  ["por2_fei", "Feirense", "FEI", "#c8102e", "#f5c400", 64]
];
var NED2 = [
  ["ned2_roda", "Roda JC", "ROD", "#f5c400", "#111111", 64],
  ["ned2_den", "De Graafschap", "GRA", "#1f4fa0", "#ffffff", 64],
  ["ned2_vvv", "VVV-Venlo", "VVV", "#f5c400", "#111111", 63],
  ["ned2_cam", "Cambuur", "CAM", "#f5c400", "#1f4fa0", 66],
  ["ned2_emm", "FC Emmen", "EMM", "#c8102e", "#ffffff", 65],
  ["ned2_den2", "Den Bosch", "DBO", "#1f4fa0", "#f5c400", 62],
  ["ned2_ein", "FC Eindhoven", "EIN", "#1f4fa0", "#ffffff", 63],
  ["ned2_hel", "Helmond Sport", "HEL", "#c8102e", "#111111", 61],
  ["ned2_jong", "Jong AZ", "JAZ", "#c8102e", "#ffffff", 62],
  ["ned2_ado", "ADO Den Haag", "ADO", "#0a8f3c", "#f5c400", 65]
];
var BRA3 = [
  ["bra3_bot_pb", "Botafogo-PB", "BPB", "#c8102e", "#111111", 60],
  ["bra3_lon", "Londrina", "LON", "#1f4fa0", "#ffffff", 61],
  ["bra3_sam", "Sampaio Corr\xEAa", "SAM", "#c8102e", "#f5c400", 60],
  ["bra3_flo", "Floresta", "FLO", "#0a8f3c", "#ffffff", 58],
  ["bra3_ita", "Ituano", "ITU", "#c8102e", "#111111", 61],
  ["bra3_sao_ber", "S\xE3o Bernardo", "SBE", "#f5c400", "#111111", 60],
  ["bra3_bra", "Brusque", "BRU", "#1f4fa0", "#f5c400", 60],
  ["bra3_ypi", "Ypiranga", "YPI", "#c8102e", "#111111", 59],
  ["bra3_abc", "ABC", "ABC", "#111111", "#ffffff", 60],
  ["bra3_cax", "Caxias", "CAX", "#0a8f3c", "#f5c400", 59]
];
var ARG2 = [
  ["arg2_san", "San Mart\xEDn de Tucum\xE1n", "SMT", "#c8102e", "#ffffff", 64],
  ["arg2_gim", "Gimnasia de Mendoza", "GIM", "#1f4fa0", "#ffffff", 63],
  ["arg2_all", "All Boys", "ALB", "#111111", "#ffffff", 62],
  ["arg2_col", "Colegiales", "COL", "#f5c400", "#111111", 61],
  ["arg2_atl", "Atlanta", "ATL", "#f5c400", "#1f4fa0", 62],
  ["arg2_qui", "Quilmes", "QUI", "#7ec8e3", "#ffffff", 64],
  ["arg2_fer", "Ferro Carril Oeste", "FER", "#0a8f3c", "#ffffff", 63],
  ["arg2_alm", "Almagro", "ALM", "#1f4fa0", "#ffffff", 61],
  ["arg2_nue", "Nueva Chicago", "NCH", "#0a8f3c", "#111111", 61],
  ["arg2_dep", "Deportivo Madryn", "DMA", "#f5820a", "#111111", 62]
];
var TUR2 = [
  ["tur2_boluspor", "Boluspor", "BOL", "#c8102e", "#ffffff", 64],
  ["tur2_erz", "Erzurumspor", "ERZ", "#1f4fa0", "#ffffff", 65],
  ["tur2_sak", "Sakaryaspor", "SAK", "#0a8f3c", "#111111", 65],
  ["tur2_key", "Ke\xE7i\xF6reng\xFCc\xFC", "KEC", "#5b2d8e", "#ffffff", 63],
  ["tur2_ban", "Band\u0131rmaspor", "BAN", "#c8102e", "#ffffff", 64],
  ["tur2_ada", "Adanaspor", "ADA", "#f5820a", "#ffffff", 63],
  ["tur2_man", "Manisa FK", "MAN", "#c8102e", "#111111", 63],
  ["tur2_ama", "Amed SK", "AMD", "#0a8f3c", "#c8102e", 64],
  ["tur2_ist", "\u0130stanbulspor", "IST", "#f5c400", "#111111", 62],
  ["tur2_\xFCmr", "\xDCmraniyespor", "UMR", "#c8102e", "#111111", 62]
];
var SCO2 = [
  ["sco2_dun", "Dunfermline", "DUN", "#111111", "#ffffff", 62],
  ["sco2_ray", "Raith Rovers", "RAI", "#1f4fa0", "#ffffff", 63],
  ["sco2_par", "Partick Thistle", "PAR", "#c8102e", "#f5c400", 63],
  ["sco2_ayr", "Ayr United", "AYR", "#111111", "#ffffff", 62],
  ["sco2_air", "Airdrieonians", "AIR", "#ffffff", "#c8102e", 61],
  ["sco2_mor", "Greenock Morton", "MOR", "#1f4fa0", "#ffffff", 61],
  ["sco2_que", "Queen's Park", "QPK", "#111111", "#ffffff", 62],
  ["sco2_arb", "Arbroath", "ARB", "#7a1b30", "#ffffff", 60]
];
function build(id, name, country, flag, raw) {
  const clubs = raw.map(([cid, cname, short, primary, secondary, strength]) => ({
    id: cid,
    name: cname,
    short,
    league: id,
    primary,
    secondary,
    strength
  }));
  return { id, name, country, flag, clubs };
}
var EXTRA_LEAGUES = [
  build("rus", "Premier Liga", "R\xFAssia", "\u{1F1F7}\u{1F1FA}", RUS),
  build("isr", "Ligat ha'Al", "Israel", "\u{1F1EE}\u{1F1F1}", ISR),
  build("hun", "NB I", "Hungria", "\u{1F1ED}\u{1F1FA}", HUN),
  build("bul", "Parva Liga", "Bulg\xE1ria", "\u{1F1E7}\u{1F1EC}", BUL),
  build("svk", "Nik\xE9 Liga", "Eslov\xE1quia", "\u{1F1F8}\u{1F1F0}", SVK),
  build("svn", "PrvaLiga", "Eslov\xEAnia", "\u{1F1F8}\u{1F1EE}", SVN),
  build("cyp", "First Division", "Chipre", "\u{1F1E8}\u{1F1FE}", CYP),
  build("irl", "Premier Division", "Irlanda", "\u{1F1EE}\u{1F1EA}", IRL),
  build("fin", "Veikkausliiga", "Finl\xE2ndia", "\u{1F1EB}\u{1F1EE}", FIN),
  build("isl", "Besta deild", "Isl\xE2ndia", "\u{1F1EE}\u{1F1F8}", ISL),
  build("ven", "Liga FUTVE", "Venezuela", "\u{1F1FB}\u{1F1EA}", VEN),
  build("crc", "Primera Divisi\xF3n", "Costa Rica", "\u{1F1E8}\u{1F1F7}", CRC),
  build("ind", "Indian Super League", "\xCDndia", "\u{1F1EE}\u{1F1F3}", IND),
  build("chn", "Chinese Super League", "China", "\u{1F1E8}\u{1F1F3}", CHN),
  build("mas", "Super League", "Mal\xE1sia", "\u{1F1F2}\u{1F1FE}", MAS),
  build("vie", "V.League 1", "Vietn\xE3", "\u{1F1FB}\u{1F1F3}", VIE),
  build("alg", "Ligue 1", "Arg\xE9lia", "\u{1F1E9}\u{1F1FF}", ALG),
  build("tun", "Ligue Professionnelle 1", "Tun\xEDsia", "\u{1F1F9}\u{1F1F3}", TUN),
  build("gha", "Premier League", "Gana", "\u{1F1EC}\u{1F1ED}", GHA),
  build("ken", "Premier League", "Qu\xEAnia", "\u{1F1F0}\u{1F1EA}", KEN),
  build("ang", "Girabola", "Angola", "\u{1F1E6}\u{1F1F4}", ANG),
  build("por2", "Liga Portugal 2", "Portugal", "\u{1F1F5}\u{1F1F9}", POR2),
  build("ned2", "Eerste Divisie", "Holanda", "\u{1F1F3}\u{1F1F1}", NED2),
  build("bra3", "Brasileir\xE3o S\xE9rie C", "Brasil", "\u{1F1E7}\u{1F1F7}", BRA3),
  build("arg2", "Primera Nacional", "Argentina", "\u{1F1E6}\u{1F1F7}", ARG2),
  build("tur2", "1. Lig", "Turquia", "\u{1F1F9}\u{1F1F7}", TUR2),
  build("sco2", "Scottish Championship", "Esc\xF3cia", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", SCO2)
];

// src/game/data/leagues-world.ts
var WAL = [
  ["wal_tns", "The New Saints", "TNS", "#0a5cb8", "#ffffff", 66],
  ["wal_con", "Connah's Quay Nomads", "CQN", "#111111", "#ffffff", 63],
  ["wal_pen", "Penybont", "PEN", "#f5c400", "#111111", 61],
  ["wal_bal", "Bala Town", "BAL", "#1f4fa0", "#ffffff", 60],
  ["wal_car", "Caernarfon Town", "CAE", "#c8102e", "#f5c400", 59],
  ["wal_hav", "Haverfordwest County", "HAV", "#1f4fa0", "#ffffff", 58],
  ["wal_abe", "Aberystwyth Town", "ABE", "#0a8f3c", "#111111", 57],
  ["wal_bar", "Barry Town United", "BAR", "#f5c400", "#0a8f3c", 58],
  ["wal_flint", "Flint Town United", "FLI", "#c8102e", "#ffffff", 56],
  ["wal_bri", "Briton Ferry Llansawel", "BRI", "#0a5cb8", "#111111", 55]
];
var MLT = [
  ["mlt_hib", "Hibernians", "HIB", "#111111", "#ffffff", 62],
  ["mlt_flo", "Floriana", "FLO", "#0a8f3c", "#ffffff", 61],
  ["mlt_val", "Valletta", "VAL", "#c8102e", "#111111", 61],
  ["mlt_bir", "Birkirkara", "BIR", "#c8102e", "#f5c400", 62],
  ["mlt_ham", "\u0126amrun Spartans", "HAM", "#c8102e", "#111111", 63],
  ["mlt_gzi", "G\u017Cira United", "GZI", "#1f4fa0", "#f5c400", 60],
  ["mlt_bal", "Balzan", "BAL", "#f5820a", "#111111", 58],
  ["mlt_sli", "Sliema Wanderers", "SLI", "#1f4fa0", "#ffffff", 59],
  ["mlt_mos", "Mosta", "MOS", "#c8102e", "#1f4fa0", 57],
  ["mlt_mar", "Marsaxlokk", "MAR", "#f5c400", "#111111", 56]
];
var LVA = [
  ["lva_rfs", "RFS", "RFS", "#7a1b30", "#ffffff", 68],
  ["lva_rig", "Riga FC", "RIG", "#111111", "#f5c400", 67],
  ["lva_val", "Valmiera", "VAL", "#0a8f3c", "#ffffff", 66],
  ["lva_lie", "Liep\u0101ja", "LIE", "#c8102e", "#ffffff", 63],
  ["lva_aus", "Auda", "AUD", "#1f4fa0", "#ffffff", 62],
  ["lva_spa", "Super Nova", "SUP", "#f5c400", "#111111", 60],
  ["lva_tuk", "Tukums 2000", "TUK", "#0a8f3c", "#f5c400", 58],
  ["lva_dau", "Daugavpils", "DAU", "#c8102e", "#111111", 57]
];
var LTU = [
  ["ltu_zal", "\u017Dalgiris", "ZAL", "#0a8f3c", "#ffffff", 69],
  ["ltu_sud", "S\u016Bduva", "SUD", "#1f4fa0", "#f5c400", 65],
  ["ltu_pan", "Panev\u0117\u017Eys", "PAN", "#111111", "#f5c400", 66],
  ["ltu_kau", "Kauno \u017Dalgiris", "KAU", "#0a8f3c", "#111111", 64],
  ["ltu_heg", "Hegelmann", "HEG", "#c8102e", "#ffffff", 62],
  ["ltu_ban", "Banga", "BAN", "#1f4fa0", "#ffffff", 60],
  ["ltu_dai", "Dainava", "DAI", "#f5820a", "#111111", 59],
  ["ltu_rie", "Riteriai", "RIT", "#7a1b30", "#f5c400", 58]
];
var EST = [
  ["est_flo", "Flora", "FLO", "#0a8f3c", "#ffffff", 67],
  ["est_lev", "Levadia", "LEV", "#0a8f3c", "#111111", 66],
  ["est_pai", "Paide Linnameeskond", "PAI", "#1f4fa0", "#ffffff", 63],
  ["est_nar", "Narva Trans", "NAR", "#c8102e", "#f5c400", 60],
  ["est_kal", "Kalju", "KAL", "#111111", "#0a8f3c", 62],
  ["est_kur", "Kuressaare", "KUR", "#1f4fa0", "#f5c400", 58],
  ["est_tam", "Tammeka", "TAM", "#0a8f3c", "#ffffff", 57],
  ["est_ves", "Vaprus", "VAP", "#c8102e", "#ffffff", 57]
];
var GEO = [
  ["geo_din", "Dinamo Tbilisi", "DIN", "#1f4fa0", "#ffffff", 69],
  ["geo_tor", "Torpedo Kutaisi", "TOR", "#f5c400", "#111111", 68],
  ["geo_din_bat", "Dinamo Batumi", "DBA", "#1f4fa0", "#f5c400", 68],
  ["geo_sab", "Saburtalo", "SAB", "#0a8f3c", "#ffffff", 66],
  ["geo_iber", "Iberia 1999", "IBE", "#c8102e", "#ffffff", 65],
  ["geo_kol", "Kolkheti Poti", "KOL", "#0a8f3c", "#f5c400", 61],
  ["geo_gag", "Gagra", "GAG", "#7a1b30", "#ffffff", 60],
  ["geo_sam", "Samgurali", "SAM", "#1f4fa0", "#c8102e", 62]
];
var ARM = [
  ["arm_pyu", "Pyunik", "PYU", "#f5c400", "#111111", 67],
  ["arm_ura", "Urartu", "URA", "#1f4fa0", "#ffffff", 65],
  ["arm_ala", "Ararat-Armenia", "ARA", "#c8102e", "#f5c400", 66],
  ["arm_noa", "Noah", "NOA", "#0a8f3c", "#ffffff", 65],
  ["arm_ale", "Alashkert", "ALA", "#7a1b30", "#ffffff", 63],
  ["arm_van", "Van", "VAN", "#1f4fa0", "#f5c400", 60],
  ["arm_shi", "Shirak", "SHI", "#c8102e", "#111111", 59],
  ["arm_bkm", "BKMA Yerevan", "BKM", "#111111", "#f5c400", 58]
];
var AZE = [
  ["aze_qar", "Qaraba\u011F", "QAR", "#111111", "#ffffff", 74],
  ["aze_nef", "Neft\xE7i", "NEF", "#111111", "#f5c400", 70],
  ["aze_zir", "Zira", "ZIR", "#1f4fa0", "#ffffff", 68],
  ["aze_sab", "Sabah", "SAB", "#0a8f3c", "#ffffff", 68],
  ["aze_sum", "Sumqay\u0131t", "SUM", "#c8102e", "#111111", 65],
  ["aze_tur", "Turan Tovuz", "TUR", "#f5c400", "#1f4fa0", 64],
  ["aze_ara", "Araz-Nax\xE7\u0131van", "ARA", "#c8102e", "#f5c400", 63],
  ["aze_kap", "K\u0259p\u0259z", "KAP", "#0a8f3c", "#111111", 61]
];
var KAZ = [
  ["kaz_ast", "Astana", "AST", "#7ec8e3", "#f5c400", 71],
  ["kaz_kai", "Kairat", "KAI", "#f5c400", "#111111", 71],
  ["kaz_tob", "Tobol", "TOB", "#0a8f3c", "#ffffff", 69],
  ["kaz_ord", "Ordabasy", "ORD", "#1f4fa0", "#f5c400", 67],
  ["kaz_akt", "Aktobe", "AKT", "#c8102e", "#ffffff", 68],
  ["kaz_ata", "Atyrau", "ATY", "#1f4fa0", "#ffffff", 64],
  ["kaz_shak", "Shakhter Karagandy", "SHA", "#111111", "#f5820a", 64],
  ["kaz_tur", "Turan", "TRN", "#0a8f3c", "#f5c400", 61]
];
var UZB = [
  ["uzb_pak", "Pakhtakor", "PAK", "#1f4fa0", "#ffffff", 72],
  ["uzb_nas", "Nasaf", "NAS", "#0a8f3c", "#ffffff", 70],
  ["uzb_agmk", "AGMK", "AGM", "#f5820a", "#111111", 68],
  ["uzb_bun", "Bunyodkor", "BUN", "#7ec8e3", "#ffffff", 68],
  ["uzb_nav", "Navbahor", "NAV", "#0a8f3c", "#f5c400", 69],
  ["uzb_sog", "Sogdiana", "SOG", "#c8102e", "#ffffff", 65],
  ["uzb_and", "Andijon", "AND", "#1f4fa0", "#f5c400", 63],
  ["uzb_sur", "Surkhon", "SUR", "#f5c400", "#111111", 62]
];
var IRN = [
  ["irn_per", "Persepolis", "PER", "#c8102e", "#ffffff", 76],
  ["irn_est", "Esteghlal", "EST", "#1f4fa0", "#ffffff", 76],
  ["irn_sep", "Sepahan", "SEP", "#f5c400", "#111111", 75],
  ["irn_tra", "Tractor", "TRA", "#c8102e", "#111111", 74],
  ["irn_fou", "Foolad", "FOO", "#c8102e", "#f5c400", 72],
  ["irn_gol", "Gol Gohar", "GOL", "#0a8f3c", "#ffffff", 71],
  ["irn_mal", "Malavan", "MAL", "#1f4fa0", "#c8102e", 69],
  ["irn_zob", "Zob Ahan", "ZOB", "#0a8f3c", "#f5c400", 70]
];
var IRQ = [
  ["irq_shu", "Al-Shorta", "SHO", "#111111", "#ffffff", 72],
  ["irq_qiw", "Al-Quwa Al-Jawiya", "QAJ", "#1f4fa0", "#ffffff", 73],
  ["irq_zaw", "Al-Zawraa", "ZAW", "#f5c400", "#111111", 71],
  ["irq_tal", "Al-Talaba", "TAL", "#f5820a", "#111111", 68],
  ["irq_erb", "Erbil", "ERB", "#f5c400", "#0a8f3c", 67],
  ["irq_naf", "Naft Misan", "NAF", "#0a8f3c", "#ffffff", 65],
  ["irq_kar", "Karbalaa", "KAR", "#c8102e", "#ffffff", 66],
  ["irq_dho", "Duhok", "DUH", "#c8102e", "#f5c400", 66]
];
var JOR = [
  ["jor_wih", "Al-Wehdat", "WEH", "#0a8f3c", "#c8102e", 68],
  ["jor_fai", "Al-Faisaly", "FAI", "#1f4fa0", "#ffffff", 68],
  ["jor_hus", "Al-Hussein", "HUS", "#c8102e", "#ffffff", 65],
  ["jor_ram", "Al-Ramtha", "RAM", "#f5c400", "#111111", 63],
  ["jor_sal", "Al-Salt", "SAL", "#0a8f3c", "#ffffff", 62],
  ["jor_ahl", "Al-Ahli Amman", "AHL", "#c8102e", "#111111", 61],
  ["jor_jaz", "Al-Jazeera", "JAZ", "#1f4fa0", "#f5c400", 62],
  ["jor_shab", "Shabab Al-Ordon", "SHB", "#111111", "#f5c400", 61]
];
var KWT = [
  ["kwt_ara", "Al-Arabi", "ARA", "#0a8f3c", "#ffffff", 67],
  ["kwt_kuw", "Kuwait SC", "KUW", "#1f4fa0", "#f5c400", 70],
  ["kwt_qad", "Al-Qadsia", "QAD", "#f5c400", "#1f4fa0", 69],
  ["kwt_sal", "Al-Salmiya", "SAL", "#c8102e", "#ffffff", 65],
  ["kwt_jah", "Al-Jahra", "JAH", "#0a8f3c", "#f5c400", 62],
  ["kwt_nas", "Kazma", "KAZ", "#f5820a", "#111111", 63],
  ["kwt_fah", "Al-Fahaheel", "FAH", "#1f4fa0", "#ffffff", 61],
  ["kwt_yar", "Al-Yarmouk", "YAR", "#c8102e", "#111111", 60]
];
var OMN = [
  ["omn_sea", "Al-Seeb", "SEE", "#1f4fa0", "#ffffff", 66],
  ["omn_nah", "Al-Nahda", "NAH", "#f5820a", "#111111", 64],
  ["omn_dho", "Dhofar", "DHO", "#c8102e", "#ffffff", 65],
  ["omn_sur", "Sur", "SUR", "#0a8f3c", "#ffffff", 61],
  ["omn_sea2", "Seeb Club", "SEC", "#1f4fa0", "#f5c400", 60],
  ["omn_bah", "Bahla", "BAH", "#7a1b30", "#ffffff", 59],
  ["omn_ibr", "Ibri", "IBR", "#0a8f3c", "#f5c400", 58],
  ["omn_sohar", "Sohar", "SOH", "#c8102e", "#111111", 60]
];
var SGP = [
  ["sgp_lio", "Lion City Sailors", "LCS", "#1f4fa0", "#f5c400", 68],
  ["sgp_alb", "Albirex Niigata S", "ALB", "#7ec8e3", "#f5820a", 66],
  ["sgp_tam", "Tampines Rovers", "TAM", "#f5c400", "#111111", 65],
  ["sgp_bal", "Balestier Khalsa", "BAL", "#c8102e", "#f5c400", 60],
  ["sgp_gey", "Geylang International", "GEY", "#0a8f3c", "#ffffff", 61],
  ["sgp_hou", "Hougang United", "HOU", "#c8102e", "#111111", 62],
  ["sgp_you", "Young Lions", "YLI", "#c8102e", "#ffffff", 57],
  ["sgp_tan", "Tanjong Pagar United", "TPU", "#111111", "#f5c400", 58]
];
var HKG = [
  ["hkg_kit", "Kitchee", "KIT", "#1f4fa0", "#ffffff", 68],
  ["hkg_eas", "Eastern", "EAS", "#1f4fa0", "#c8102e", 66],
  ["hkg_lee", "Lee Man", "LEE", "#c8102e", "#111111", 65],
  ["hkg_sou", "Southern District", "SOU", "#0a8f3c", "#ffffff", 62],
  ["hkg_kow", "Kowloon City", "KOW", "#f5c400", "#111111", 59],
  ["hkg_res", "Resources Capital", "RES", "#7a1b30", "#f5c400", 61],
  ["hkg_tai", "Tai Po", "TAI", "#0a8f3c", "#f5c400", 62],
  ["hkg_hkr", "HK Rangers", "HKR", "#1f4fa0", "#f5c400", 58]
];
var PHI = [
  ["phi_kay", "Kaya FC", "KAY", "#c8102e", "#111111", 62],
  ["phi_uni", "United City", "UNC", "#1f4fa0", "#f5c400", 63],
  ["phi_sta", "Stallion Laguna", "STA", "#0a8f3c", "#ffffff", 59],
  ["phi_azk", "Azkals Development", "AZK", "#1f4fa0", "#ffffff", 57],
  ["phi_dyn", "Dynamic Herb Cebu", "CEB", "#f5820a", "#111111", 61],
  ["phi_mai", "Maharlika Manila", "MAH", "#f5c400", "#c8102e", 56],
  ["phi_men", "Mendiola", "MEN", "#7a1b30", "#ffffff", 56],
  ["phi_lok", "Loyola Meralco", "LOY", "#0a8f3c", "#f5c400", 55]
];
var NZL = [
  ["nzl_auc", "Auckland FC", "AUC", "#111111", "#7ec8e3", 70],
  ["nzl_wel", "Wellington Phoenix", "WEL", "#f5c400", "#111111", 69],
  ["nzl_aucu", "Auckland United", "AUU", "#1f4fa0", "#ffffff", 60],
  ["nzl_bir", "Birkenhead United", "BIR", "#c8102e", "#ffffff", 58],
  ["nzl_can", "Cashmere Technical", "CAS", "#0a8f3c", "#f5c400", 59],
  ["nzl_wai", "Waitakere City", "WAI", "#1f4fa0", "#f5c400", 57],
  ["nzl_chr", "Christchurch United", "CHR", "#c8102e", "#111111", 58],
  ["nzl_ham", "Hamilton Wanderers", "HAM", "#f5820a", "#111111", 56]
];
var CHI2 = [
  ["chi2_san", "Santiago Wanderers", "SWA", "#0a8f3c", "#ffffff", 68],
  ["chi2_ran", "Rangers de Talca", "RAN", "#c8102e", "#111111", 65],
  ["chi2_sanl", "San Luis", "SLU", "#f5c400", "#111111", 64],
  ["chi2_mag", "Magallanes", "MAG", "#1f4fa0", "#f5c400", 67],
  ["chi2_uni", "San Marcos de Arica", "SMA", "#0a8f3c", "#f5c400", 62],
  ["chi2_ant", "Deportes Antofagasta", "ANT", "#7ec8e3", "#ffffff", 66],
  ["chi2_tem", "Deportes Temuco", "TEM", "#0a8f3c", "#ffffff", 65],
  ["chi2_con", "Deportes Concepci\xF3n", "CON", "#7a1b30", "#f5c400", 63]
];
var URU2 = [
  ["uru2_ram", "Rampla Juniors", "RAM", "#c8102e", "#0a8f3c", 62],
  ["uru2_cen", "Central Espa\xF1ol", "CEN", "#c8102e", "#ffffff", 60],
  ["uru2_alb", "Albion", "ALB", "#7ec8e3", "#ffffff", 61],
  ["uru2_ova", "Rentistas", "REN", "#111111", "#f5c400", 63],
  ["uru2_uru", "Uruguay Montevideo", "URU", "#1f4fa0", "#ffffff", 59],
  ["uru2_ata", "Atenas", "ATE", "#c8102e", "#111111", 58],
  ["uru2_tac", "Tacuaremb\xF3", "TAC", "#0a8f3c", "#ffffff", 58],
  ["uru2_pro", "Progreso", "PRO", "#c8102e", "#f5c400", 62]
];
var COL2 = [
  ["col2_qui", "Deportes Quind\xEDo", "QUI", "#c8102e", "#f5c400", 63],
  ["col2_cuc", "C\xFAcuta Deportivo", "CUC", "#c8102e", "#111111", 65],
  ["col2_rea", "Real Cartagena", "RCA", "#0a8f3c", "#f5c400", 64],
  ["col2_orso", "Orsomarso", "ORS", "#0a8f3c", "#ffffff", 60],
  ["col2_bog", "Bogot\xE1 FC", "BOG", "#1f4fa0", "#ffffff", 59],
  ["col2_tig", "Tigres FC", "TIG", "#f5c400", "#111111", 60],
  ["col2_lla", "Llaneros", "LLA", "#0a8f3c", "#f5c400", 62],
  ["col2_bar", "Barranquilla FC", "BFC", "#c8102e", "#ffffff", 61]
];
var PAN = [
  ["pan_taur", "Tauro", "TAU", "#f5820a", "#111111", 64],
  ["pan_pla", "Plaza Amador", "PLA", "#c8102e", "#111111", 65],
  ["pan_ind", "Independiente", "IND", "#0a8f3c", "#ffffff", 63],
  ["pan_her", "Herrera", "HER", "#1f4fa0", "#f5c400", 60],
  ["pan_ari", "\xC1rabe Unido", "ARA", "#c8102e", "#f5c400", 62],
  ["pan_cai", "Sporting San Miguelito", "SSM", "#0a8f3c", "#f5c400", 61],
  ["pan_umecit", "Umecit", "UME", "#1f4fa0", "#ffffff", 59],
  ["pan_ver", "Veraguas", "VER", "#7a1b30", "#ffffff", 58]
];
var GUA = [
  ["gua_com", "Comunicaciones", "COM", "#ffffff", "#1f4fa0", 66],
  ["gua_mun", "Municipal", "MUN", "#c8102e", "#ffffff", 66],
  ["gua_ant", "Antigua GFC", "ANT", "#0a8f3c", "#ffffff", 64],
  ["gua_xel", "Xelaj\xFA MC", "XEL", "#7ec8e3", "#ffffff", 64],
  ["gua_coa", "Cob\xE1n Imperial", "COB", "#f5c400", "#111111", 62],
  ["gua_mix", "Mixco", "MIX", "#0a8f3c", "#f5c400", 61],
  ["gua_gua", "Guastatoya", "GUA", "#c8102e", "#f5c400", 62],
  ["gua_mal", "Malacateco", "MAL", "#1f4fa0", "#f5c400", 60]
];
var HON = [
  ["hon_olim", "Olimpia", "OLI", "#ffffff", "#111111", 68],
  ["hon_mot", "Motagua", "MOT", "#1f4fa0", "#ffffff", 67],
  ["hon_mar", "Marath\xF3n", "MAR", "#0a8f3c", "#ffffff", 65],
  ["hon_rea", "Real Espa\xF1a", "RES", "#c8102e", "#f5c400", 65],
  ["hon_vic", "Victoria", "VIC", "#7a1b30", "#ffffff", 61],
  ["hon_gen", "G\xE9nesis", "GEN", "#0a8f3c", "#f5c400", 60],
  ["hon_jua", "Juticalpa", "JUT", "#f5820a", "#111111", 59],
  ["hon_pot", "Potros Olancho", "OLA", "#c8102e", "#111111", 62]
];
var JAM = [
  ["jam_cav", "Cavalier", "CAV", "#f5c400", "#111111", 62],
  ["jam_mou", "Mount Pleasant", "MPL", "#0a8f3c", "#f5c400", 63],
  ["jam_ara", "Arnett Gardens", "ARN", "#0a8f3c", "#c8102e", 62],
  ["jam_por", "Portmore United", "POR", "#1f4fa0", "#f5c400", 61],
  ["jam_har", "Harbour View", "HAR", "#1f4fa0", "#ffffff", 60],
  ["jam_wat", "Waterhouse", "WAT", "#f5c400", "#1f4fa0", 61],
  ["jam_dun", "Dunbeholden", "DUN", "#c8102e", "#ffffff", 58],
  ["jam_tiv", "Tivoli Gardens", "TIV", "#0a8f3c", "#f5c400", 59]
];
var CIV = [
  ["civ_asec", "ASEC Mimosas", "ASE", "#f5c400", "#111111", 70],
  ["civ_afr", "Africa Sports", "AFR", "#c8102e", "#ffffff", 67],
  ["civ_sew", "S\xE9w\xE9 Sport", "SEW", "#0a8f3c", "#ffffff", 65],
  ["civ_stad", "Stade d'Abidjan", "STA", "#c8102e", "#f5c400", 64],
  ["civ_san", "SOL FC", "SOL", "#1f4fa0", "#ffffff", 62],
  ["civ_bou", "Bouak\xE9 FC", "BOU", "#f5820a", "#111111", 61],
  ["civ_spo", "Sporting Gagnoa", "GAG", "#0a8f3c", "#f5c400", 63],
  ["civ_man", "Mancini FC", "MAN", "#7a1b30", "#ffffff", 60]
];
var SEN = [
  ["sen_gen", "G\xE9n\xE9ration Foot", "GEN", "#0a8f3c", "#f5c400", 68],
  ["sen_jar", "Jaraaf", "JAR", "#0a8f3c", "#ffffff", 67],
  ["sen_tei", "Teungueth FC", "TEU", "#1f4fa0", "#ffffff", 68],
  ["sen_cas", "Casa Sports", "CAS", "#0a8f3c", "#c8102e", 66],
  ["sen_dio", "Diambars", "DIA", "#7ec8e3", "#ffffff", 65],
  ["sen_gui", "Gu\xE9diawaye FC", "GUE", "#f5c400", "#111111", 63],
  ["sen_dak", "AS Douanes", "DOU", "#c8102e", "#f5c400", 64],
  ["sen_pik", "Pikine", "PIK", "#1f4fa0", "#f5c400", 62]
];
var CMR = [
  ["cmr_coton", "Coton Sport", "COT", "#f5c400", "#0a8f3c", 69],
  ["cmr_uds", "UMS de Loum", "UMS", "#1f4fa0", "#ffffff", 64],
  ["cmr_can", "Canon Yaound\xE9", "CAN", "#c8102e", "#f5c400", 66],
  ["cmr_ton", "Tonnerre Yaound\xE9", "TON", "#f5c400", "#111111", 64],
  ["cmr_pwd", "PWD Bamenda", "PWD", "#0a8f3c", "#ffffff", 65],
  ["cmr_vic", "Victoria United", "VIC", "#1f4fa0", "#f5c400", 66],
  ["cmr_dyn", "Dynamo Douala", "DYN", "#c8102e", "#ffffff", 62],
  ["cmr_apejes", "Apejes", "APE", "#0a8f3c", "#f5c400", 61]
];
var COD = [
  ["cod_maz", "TP Mazembe", "MAZ", "#111111", "#ffffff", 74],
  ["cod_vit", "AS Vita Club", "VIT", "#0a8f3c", "#ffffff", 71],
  ["cod_mai", "DC Motema Pembe", "DCMP", "#1f4fa0", "#f5c400", 69],
  ["cod_lup", "Lupopo", "LUP", "#7ec8e3", "#ffffff", 68],
  ["cod_san", "Sanga Balende", "SAN", "#c8102e", "#f5c400", 65],
  ["cod_don", "Don Bosco", "DON", "#0a8f3c", "#f5c400", 66],
  ["cod_mak", "Maniema Union", "MAN", "#f5820a", "#111111", 64],
  ["cod_ren", "Renaissance du Congo", "REN", "#1f4fa0", "#ffffff", 63]
];
var ZAM = [
  ["zam_pow", "Power Dynamos", "POW", "#c8102e", "#ffffff", 66],
  ["zam_zes", "ZESCO United", "ZES", "#f5820a", "#111111", 67],
  ["zam_nka", "Nkana", "NKA", "#c8102e", "#111111", 65],
  ["zam_red", "Red Arrows", "ARR", "#c8102e", "#f5c400", 64],
  ["zam_gre", "Green Eagles", "GRE", "#0a8f3c", "#ffffff", 64],
  ["zam_for", "Forest Rangers", "FOR", "#0a8f3c", "#f5c400", 62],
  ["zam_zan", "Zanaco", "ZAN", "#0a8f3c", "#111111", 65],
  ["zam_kab", "Kabwe Warriors", "KAB", "#1f4fa0", "#ffffff", 61]
];
var BLR = [
  ["blr_bat", "BATE Borisov", "BAT", "#f5c400", "#1f4fa0", 69],
  ["blr_din", "Dinamo Minsk", "DMI", "#1f4fa0", "#ffffff", 70],
  ["blr_sha", "Shakhtyor Soligorsk", "SHA", "#c8102e", "#111111", 69],
  ["blr_ise", "Isloch", "ISL", "#0a8f3c", "#ffffff", 65],
  ["blr_neman", "Neman Grodno", "NEM", "#0a8f3c", "#f5c400", 66],
  ["blr_gom", "Gomel", "GOM", "#c8102e", "#f5c400", 64],
  ["blr_tor", "Torpedo Zhodino", "TOR", "#1f4fa0", "#f5c400", 65],
  ["blr_slavia", "Slavia Mozyr", "SLA", "#111111", "#ffffff", 63]
];
var ALB = [
  ["alb_tir", "KF Tirana", "TIR", "#1f4fa0", "#ffffff", 66],
  ["alb_par", "Partizani", "PAR", "#c8102e", "#111111", 66],
  ["alb_din", "Dinamo Tirana", "DIN", "#1f4fa0", "#c8102e", 64],
  ["alb_vll", "Vllaznia", "VLL", "#1f4fa0", "#ffffff", 65],
  ["alb_lac", "La\xE7i", "LAC", "#0a8f3c", "#ffffff", 64],
  ["alb_egn", "Egnatia", "EGN", "#f5c400", "#111111", 66],
  ["alb_ska", "Sk\xEBnderbeu", "SKE", "#c8102e", "#f5c400", 63],
  ["alb_teu", "Teuta", "TEU", "#1f4fa0", "#f5c400", 62]
];
var MKD = [
  ["mkd_shk", "Shk\xEBndija", "SHK", "#c8102e", "#111111", 67],
  ["mkd_var", "Vardar", "VAR", "#c8102e", "#111111", 64],
  ["mkd_str", "Struga", "STR", "#7ec8e3", "#ffffff", 66],
  ["mkd_ska", "Rabotnicki", "RAB", "#c8102e", "#f5c400", 63],
  ["mkd_aka", "Akademija Pandev", "AKA", "#0a8f3c", "#ffffff", 63],
  ["mkd_bre", "Bregalnica", "BRE", "#1f4fa0", "#ffffff", 60],
  ["mkd_mak", "Makedonija GP", "MGP", "#c8102e", "#f5c400", 61],
  ["mkd_sil", "Sileks", "SIL", "#f5c400", "#111111", 61]
];
var BIH = [
  ["bih_zel", "\u017Deljezni\u010Dar", "ZEL", "#1f4fa0", "#ffffff", 67],
  ["bih_sar", "Sarajevo", "SAR", "#7a1b30", "#ffffff", 68],
  ["bih_zri", "Zrinjski Mostar", "ZRI", "#c8102e", "#ffffff", 69],
  ["bih_bor", "Borac Banja Luka", "BOR", "#c8102e", "#1f4fa0", 69],
  ["bih_vel", "Vele\u017E Mostar", "VEL", "#c8102e", "#111111", 65],
  ["bih_shi", "\u0160iroki Brijeg", "SIR", "#c8102e", "#f5c400", 65],
  ["bih_tuz", "Tuzla City", "TUZ", "#1f4fa0", "#f5c400", 63],
  ["bih_slo", "Sloboda Tuzla", "SLO", "#c8102e", "#ffffff", 62]
];
var MNE = [
  ["mne_bud", "Budu\u0107nost", "BUD", "#1f4fa0", "#ffffff", 65],
  ["mne_sut", "Sutjeska", "SUT", "#1f4fa0", "#f5c400", 64],
  ["mne_dec", "De\u010Di\u0107", "DEC", "#c8102e", "#111111", 62],
  ["mne_jez", "Jezero", "JEZ", "#0a8f3c", "#ffffff", 60],
  ["mne_arse", "Arsenal Tivat", "ARS", "#c8102e", "#f5c400", 60],
  ["mne_pet", "Petrovac", "PET", "#f5c400", "#111111", 61],
  ["mne_mor", "Mornar", "MOR", "#1f4fa0", "#ffffff", 62],
  ["mne_rud", "Rudar Pljevlja", "RUD", "#111111", "#f5c400", 61]
];
function build2(id, name, country, flag, raw) {
  const clubs = raw.map(([cid, cname, short, primary, secondary, strength]) => ({
    id: cid,
    name: cname,
    short,
    league: id,
    primary,
    secondary,
    strength
  }));
  return { id, name, country, flag, clubs };
}
var WORLD_LEAGUES = [
  build2("wal", "Cymru Premier", "Pa\xEDs de Gales", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", WAL),
  build2("mlt", "Premier League Maltesa", "Malta", "\u{1F1F2}\u{1F1F9}", MLT),
  build2("lva", "Virsliga", "Let\xF4nia", "\u{1F1F1}\u{1F1FB}", LVA),
  build2("ltu", "A Lyga", "Litu\xE2nia", "\u{1F1F1}\u{1F1F9}", LTU),
  build2("est", "Meistriliiga", "Est\xF4nia", "\u{1F1EA}\u{1F1EA}", EST),
  build2("geo", "Erovnuli Liga", "Ge\xF3rgia", "\u{1F1EC}\u{1F1EA}", GEO),
  build2("arm", "Premier League Arm\xEAnia", "Arm\xEAnia", "\u{1F1E6}\u{1F1F2}", ARM),
  build2("aze", "Premyer Liqa", "Azerbaij\xE3o", "\u{1F1E6}\u{1F1FF}", AZE),
  build2("kaz", "Premier League Cazaque", "Cazaquist\xE3o", "\u{1F1F0}\u{1F1FF}", KAZ),
  build2("uzb", "Superliga", "Uzbequist\xE3o", "\u{1F1FA}\u{1F1FF}", UZB),
  build2("irn", "Persian Gulf Pro League", "Ir\xE3", "\u{1F1EE}\u{1F1F7}", IRN),
  build2("irq", "Stars League Iraquiana", "Iraque", "\u{1F1EE}\u{1F1F6}", IRQ),
  build2("jor", "Pro League Jordaniana", "Jord\xE2nia", "\u{1F1EF}\u{1F1F4}", JOR),
  build2("kwt", "Premier League Kuwaitiana", "Kuwait", "\u{1F1F0}\u{1F1FC}", KWT),
  build2("omn", "Professional League", "Om\xE3", "\u{1F1F4}\u{1F1F2}", OMN),
  build2("sgp", "Singapore Premier League", "Singapura", "\u{1F1F8}\u{1F1EC}", SGP),
  build2("hkg", "Hong Kong Premier League", "Hong Kong", "\u{1F1ED}\u{1F1F0}", HKG),
  build2("phi", "Philippines Football League", "Filipinas", "\u{1F1F5}\u{1F1ED}", PHI),
  build2("nzl", "New Zealand National League", "Nova Zel\xE2ndia", "\u{1F1F3}\u{1F1FF}", NZL),
  build2("chi2", "Primera B", "Chile", "\u{1F1E8}\u{1F1F1}", CHI2),
  build2("uru2", "Segunda Divisi\xF3n", "Uruguai", "\u{1F1FA}\u{1F1FE}", URU2),
  build2("col2", "Torneo BetPlay", "Col\xF4mbia", "\u{1F1E8}\u{1F1F4}", COL2),
  build2("pan", "Liga Paname\xF1a", "Panam\xE1", "\u{1F1F5}\u{1F1E6}", PAN),
  build2("gua", "Liga Nacional", "Guatemala", "\u{1F1EC}\u{1F1F9}", GUA),
  build2("hon", "Liga Nacional", "Honduras", "\u{1F1ED}\u{1F1F3}", HON),
  build2("jam", "Jamaica Premier League", "Jamaica", "\u{1F1EF}\u{1F1F2}", JAM),
  build2("civ", "Ligue 1 Marfinense", "Costa do Marfim", "\u{1F1E8}\u{1F1EE}", CIV),
  build2("sen", "Ligue 1 Senegalesa", "Senegal", "\u{1F1F8}\u{1F1F3}", SEN),
  build2("cmr", "Elite One", "Camar\xF5es", "\u{1F1E8}\u{1F1F2}", CMR),
  build2("cod", "Linafoot", "RD Congo", "\u{1F1E8}\u{1F1E9}", COD),
  build2("zam", "Super League Zambiana", "Z\xE2mbia", "\u{1F1FF}\u{1F1F2}", ZAM),
  build2("blr", "Vysheyshaya Liga", "Belarus", "\u{1F1E7}\u{1F1FE}", BLR),
  build2("alb", "Kategoria Superiore", "Alb\xE2nia", "\u{1F1E6}\u{1F1F1}", ALB),
  build2("mkd", "Prva Liga", "Maced\xF4nia do Norte", "\u{1F1F2}\u{1F1F0}", MKD),
  build2("bih", "Premijer Liga", "B\xF3snia e Herzegovina", "\u{1F1E7}\u{1F1E6}", BIH),
  build2("mne", "Prva CFL", "Montenegro", "\u{1F1F2}\u{1F1EA}", MNE)
];

// src/game/data/leagues-fill.ts
var LEAGUE_FILL = {
  // Europa
  rus: [
    ["rus_akr", "Akron Tolyatti", "AKR", "#1f7a3c", "#ffffff", 64],
    ["rus_bal", "Baltika Kaliningrad", "BAL", "#1f4fa0", "#ffffff", 65],
    ["rus_ore", "Orenburg", "ORE", "#0a8f3c", "#111111", 65],
    ["rus_mak", "Dinamo Makhachkala", "DMK", "#1f4fa0", "#f5c400", 63]
  ],
  isr: [
    ["isr_hha", "Hapoel Haifa", "HHA", "#c8102e", "#111111", 66],
    ["isr_mpt", "Maccabi Petah Tikva", "MPT", "#1f4fa0", "#f5c400", 64],
    ["isr_kir", "Ironi Kiryat Shmona", "KIR", "#c8102e", "#ffffff", 63],
    ["isr_hje", "Hapoel Jerusal\xE9m", "HJE", "#c8102e", "#111111", 62]
  ],
  hun: [
    ["hun_dio", "Di\xF3sgy\u0151r", "DVT", "#c8102e", "#111111", 63],
    ["hun_nyi", "Ny\xEDregyh\xE1za", "NYI", "#f5c400", "#1f4fa0", 61]
  ],
  bul: [
    ["bul_lso", "Lokomotiv Sofia", "LSO", "#c8102e", "#111111", 62],
    ["bul_ber", "Beroe", "BER", "#0a8f3c", "#ffffff", 61],
    ["bul_bvr", "Botev Vratsa", "BVR", "#1f4fa0", "#ffffff", 60],
    ["bul_spv", "Spartak Varna", "SPV", "#1f4fa0", "#f5c400", 60],
    ["bul_sep", "Septemvri Sofia", "SEP", "#0a8f3c", "#111111", 58],
    ["bul_heb", "Hebar", "HEB", "#c8102e", "#f5c400", 58],
    ["bul_mon", "Montana", "MON", "#1f7a3c", "#ffffff", 57],
    ["bul_dob", "Dobrudzha", "DOB", "#1f4fa0", "#111111", 57]
  ],
  svk: [
    ["svk_tre", "AS Tren\u010D\xEDn", "TRE", "#c8102e", "#111111", 63],
    ["svk_kom", "KFC Kom\xE1rno", "KOM", "#f5c400", "#1f4fa0", 60],
    ["svk_zla", "Zlat\xE9 Moravce", "ZLA", "#0a8f3c", "#ffffff", 59],
    ["svk_dbb", "Dukla Bansk\xE1 Bystrica", "DBB", "#c8102e", "#f5c400", 59]
  ],
  svn: [
    ["svn_pri", "Primorje", "PRI", "#1f4fa0", "#f5c400", 58],
    ["svn_naf", "Nafta 1903", "NAF", "#111111", "#f5c400", 57]
  ],
  cyp: [
    ["cyp_aek", "AEK Larnaca", "AEK", "#f5c400", "#1f4fa0", 68],
    ["cyp_enp", "Enosis Neon Paralimni", "ENP", "#1f4fa0", "#ffffff", 62],
    ["cyp_kar", "Karmiotissa", "KAR", "#0a8f3c", "#ffffff", 60],
    ["cyp_akr", "Akritas Chlorakas", "AKR", "#c8102e", "#111111", 59],
    ["cyp_dox", "Doxa Katokopias", "DOX", "#1f4fa0", "#c8102e", 59],
    ["cyp_oly", "Olympiakos Nicosia", "OLY", "#0a8f3c", "#111111", 58]
  ],
  irl: [
    ["irl_sli", "Sligo Rovers", "SLI", "#c8102e", "#ffffff", 60],
    ["irl_cor", "Cork City", "COR", "#0a8f3c", "#ffffff", 59]
  ],
  fin: [
    ["fin_lah", "FC Lahti", "LAH", "#0a8f3c", "#ffffff", 60],
    ["fin_oul", "AC Oulu", "OUL", "#1f4fa0", "#ffffff", 59],
    ["fin_gni", "IF Gnistan", "GNI", "#f5c400", "#111111", 58],
    ["fin_ktp", "KTP Kotka", "KTP", "#c8102e", "#ffffff", 58]
  ],
  isl: [
    ["isl_ka", "KA Akureyri", "KAA", "#c8102e", "#ffffff", 59],
    ["isl_ia", "\xCDA Akranes", "IAA", "#f5c400", "#111111", 58],
    ["isl_ibv", "\xCDBV Vestmannaeyjar", "IBV", "#111111", "#f5c400", 58],
    ["isl_ves", "Vestri", "VES", "#1f4fa0", "#ffffff", 56]
  ],
  blr: [
    ["blr_dne", "Dnepr Mogilev", "DNE", "#1f4fa0", "#ffffff", 59],
    ["blr_vit", "Vitebsk", "VIT", "#0a8f3c", "#ffffff", 58],
    ["blr_slu", "Slutsk", "SLU", "#c8102e", "#111111", 57],
    ["blr_min", "Minsk", "MIN", "#1f4fa0", "#f5c400", 58],
    ["blr_mol", "Molodechno", "MOL", "#0a8f3c", "#111111", 55],
    ["blr_ars", "Arsenal Dzerzhinsk", "ARS", "#c8102e", "#ffffff", 55],
    ["blr_ene", "Energetik-BGU", "ENE", "#f5c400", "#1f4fa0", 56],
    ["blr_vol", "Volna Pinsk", "VOL", "#1f4fa0", "#111111", 54]
  ],
  alb: [
    ["alb_kuk", "Kuk\xEBsi", "KUK", "#1f4fa0", "#ffffff", 60],
    ["alb_byl", "Bylis", "BYL", "#0a8f3c", "#ffffff", 58]
  ],
  mkd: [
    ["mkd_tik", "Tikvesh", "TIK", "#c8102e", "#f5c400", 56],
    ["mkd_gos", "Gostivar", "GOS", "#1f4fa0", "#ffffff", 56],
    ["mkd_vos", "Voska Sport", "VOS", "#0a8f3c", "#111111", 55],
    ["mkd_bor", "Borec", "BOR", "#c8102e", "#111111", 55]
  ],
  bih: [
    ["bih_pos", "Posu\u0161je", "POS", "#1f4fa0", "#ffffff", 58],
    ["bih_igm", "Igman Konjic", "IGM", "#0a8f3c", "#ffffff", 57],
    ["bih_rad", "Radnik Bijeljina", "RAD", "#c8102e", "#111111", 57],
    ["bih_slod", "Sloga Doboj", "SLD", "#1f4fa0", "#f5c400", 56]
  ],
  mne: [
    ["mne_tit", "OFK Titograd", "TIT", "#1f4fa0", "#ffffff", 57],
    ["mne_jed", "Jedinstvo Bijelo Polje", "JED", "#c8102e", "#111111", 55]
  ],
  wal: [
    ["wal_cme", "Cardiff Met", "CME", "#111111", "#f5c400", 55],
    ["wal_col", "Colwyn Bay", "COL", "#1f4fa0", "#ffffff", 55]
  ],
  mlt: [
    ["mlt_sir", "Sirens", "SIR", "#1f4fa0", "#f5c400", 56],
    ["mlt_nax", "Naxxar Lions", "NAX", "#f5c400", "#111111", 55],
    ["mlt_zab", "\u017Babbar St Patrick", "ZAB", "#0a8f3c", "#ffffff", 54],
    ["mlt_slu", "Santa Lu\u010Bija", "SLU", "#c8102e", "#ffffff", 54]
  ],
  lva: [
    ["lva_met", "Metta", "MET", "#1f4fa0", "#f5c400", 56],
    ["lva_jel", "Jelgava", "JEL", "#0a8f3c", "#ffffff", 55]
  ],
  ltu: [
    ["ltu_tra", "TransINVEST", "TRA", "#1f4fa0", "#ffffff", 57],
    ["ltu_sia", "FA \u0160iauliai", "SIA", "#0a8f3c", "#f5c400", 56]
  ],
  est: [
    ["est_leg", "Legion Tallinn", "LEG", "#c8102e", "#111111", 55],
    ["est_har", "Harju Laagri", "HAR", "#1f4fa0", "#ffffff", 54]
  ],
  geo: [
    ["geo_dil", "Dila Gori", "DIL", "#1f4fa0", "#ffffff", 60],
    ["geo_spa", "Spaeri", "SPA", "#0a8f3c", "#111111", 57]
  ],
  arm: [
    ["arm_wes", "West Armenia", "WES", "#c8102e", "#f5c400", 57],
    ["arm_ara", "Ararat Yerevan", "ARY", "#c8102e", "#ffffff", 58]
  ],
  aze: [
    ["aze_sabl", "Sabail", "SAB", "#1f4fa0", "#ffffff", 59],
    ["aze_sam", "\u015Eamax\u0131", "SAM", "#0a8f3c", "#f5c400", 57]
  ],
  // Américas
  ven: [
    ["ven_apc", "Academia Puerto Cabello", "APC", "#1f4fa0", "#f5c400", 64],
    ["ven_est", "Estudiantes de M\xE9rida", "EST", "#c8102e", "#111111", 63],
    ["ven_ray", "Rayo Zuliano", "RAY", "#c8102e", "#f5c400", 62],
    ["ven_ang", "Angostura", "ANG", "#0a8f3c", "#ffffff", 60],
    ["ven_ucv", "Universidad Central", "UCV", "#1f4fa0", "#ffffff", 60],
    ["ven_her", "Hermanos Colmen\xE1rez", "HER", "#f5820a", "#111111", 59]
  ],
  crc: [
    ["crc_spo", "Sporting FC", "SPO", "#f5c400", "#111111", 63],
    ["crc_lib", "Municipal Liberia", "LIB", "#f5820a", "#111111", 62],
    ["crc_san", "Santos de Gu\xE1piles", "SAN", "#0a8f3c", "#ffffff", 62],
    ["crc_gre", "Municipal Grecia", "GRE", "#1f4fa0", "#ffffff", 60]
  ],
  pan: [
    ["pan_caii", "CAI", "CAI", "#c8102e", "#111111", 60],
    ["pan_sfc", "San Francisco FC", "SFC", "#0a8f3c", "#ffffff", 60]
  ],
  gua: [
    ["gua_ach", "Achuapa", "ACH", "#0a8f3c", "#ffffff", 59],
    ["gua_mar", "Marquense", "MAR", "#1f4fa0", "#ffffff", 58],
    ["gua_aur", "Aurora FC", "AUR", "#f5c400", "#111111", 58],
    ["gua_izt", "Deportivo Iztapa", "IZT", "#c8102e", "#f5c400", 56]
  ],
  hon: [
    ["hon_pla", "Platense", "PLA", "#1f4fa0", "#ffffff", 59],
    ["hon_cho", "Choloma", "CHO", "#0a8f3c", "#111111", 57]
  ],
  jam: [
    ["jam_mol", "Molynes United", "MOL", "#1f4fa0", "#f5c400", 55],
    ["jam_ver", "Vere United", "VER", "#0a8f3c", "#ffffff", 55],
    ["jam_cha", "Chapelton Maroons", "CHA", "#7a1b30", "#f5c400", 54],
    ["jam_mbu", "Montego Bay United", "MBU", "#c8102e", "#111111", 56]
  ],
  chi2: [
    ["chi2_cop", "Deportes Copiap\xF3", "COP", "#7a1b30", "#ffffff", 64],
    ["chi2_lse", "Deportes La Serena", "LSE", "#c8102e", "#f5c400", 64],
    ["chi2_smo", "Santiago Morning", "SMO", "#111111", "#ffffff", 62],
    ["chi2_cur", "Curic\xF3 Unido", "CUR", "#f5c400", "#111111", 63],
    ["chi2_uco", "Universidad de Concepci\xF3n", "UCO", "#f5c400", "#1f4fa0", 62],
    ["chi2_rec", "Recoleta", "REC", "#1f4fa0", "#ffffff", 60],
    ["chi2_sau", "San Antonio Unido", "SAU", "#0a8f3c", "#ffffff", 59],
    ["chi2_iqu", "Deportes Iquique", "IQU", "#c8102e", "#111111", 65]
  ],
  uru2: [
    ["uru2_vil", "Villa Espa\xF1ola", "VIL", "#0a8f3c", "#ffffff", 58],
    ["uru2_juv", "Juventud de Las Piedras", "JUV", "#1f4fa0", "#ffffff", 59],
    ["uru2_sud", "Sud Am\xE9rica", "SUD", "#c8102e", "#111111", 58],
    ["uru2_cer", "Cerro", "CER", "#1f4fa0", "#c8102e", 60],
    ["uru2_mir", "Miramar Misiones", "MIR", "#f5c400", "#111111", 57],
    ["uru2_luz", "La Luz", "LUZ", "#0a8f3c", "#f5c400", 57]
  ],
  col2: [
    ["col2_atf", "Atl\xE9tico FC", "ATF", "#1f4fa0", "#ffffff", 59],
    ["col2_rsa", "Real Santander", "RSA", "#f5c400", "#111111", 58],
    ["col2_boc", "Boca Juniors de Cali", "BOC", "#1f4fa0", "#f5c400", 58],
    ["col2_inp", "Internacional de Palmira", "INP", "#c8102e", "#ffffff", 57],
    ["col2_pat", "Patriotas Boyac\xE1", "PAT", "#c8102e", "#f5c400", 60],
    ["col2_leo", "Leones FC", "LEO", "#f5820a", "#111111", 59],
    ["col2_hui", "Atl\xE9tico Huila", "HUI", "#0a8f3c", "#ffffff", 60],
    ["col2_val", "Valledupar FC", "VAL", "#1f4fa0", "#c8102e", 57]
  ],
  arg2: [
    ["arg2_mor", "Deportivo Mor\xF3n", "MOR", "#c8102e", "#111111", 65],
    ["arg2_erc", "Estudiantes de R\xEDo Cuarto", "ERC", "#1f4fa0", "#ffffff", 64],
    ["arg2_cha", "Chacarita Juniors", "CHA", "#c8102e", "#111111", 65],
    ["arg2_def", "Defensores de Belgrano", "DEF", "#c8102e", "#1f4fa0", 64],
    ["arg2_tem", "Temperley", "TEM", "#1f4fa0", "#ffffff", 63],
    ["arg2_almb", "Almirante Brown", "ALB", "#f5c400", "#111111", 63],
    ["arg2_cfe", "Chaco For Ever", "CFE", "#111111", "#ffffff", 62],
    ["arg2_agr", "Agropecuario", "AGR", "#0a8f3c", "#ffffff", 63],
    ["arg2_gju", "Gimnasia de Jujuy", "GJU", "#c8102e", "#ffffff", 63],
    ["arg2_alv", "Alvarado", "ALV", "#1f4fa0", "#f5c400", 62]
  ],
  bra3: [
    ["bra3_vol", "Volta Redonda", "VOL", "#f5c400", "#111111", 68],
    ["bra3_nau", "N\xE1utico", "NAU", "#c8102e", "#ffffff", 70],
    ["bra3_csa", "CSA", "CSA", "#1f4fa0", "#ffffff", 69],
    ["bra3_con", "Confian\xE7a", "CON", "#1f4fa0", "#ffffff", 67],
    ["bra3_sjo", "S\xE3o Jos\xE9-RS", "SJO", "#0a8f3c", "#ffffff", 66],
    ["bra3_ath", "Athletic Club", "ATH", "#111111", "#f5c400", 68],
    ["bra3_fig", "Figueirense", "FIG", "#111111", "#ffffff", 69],
    ["bra3_fer", "Ferrovi\xE1ria", "FER", "#c8102e", "#ffffff", 68],
    ["bra3_ana", "An\xE1polis", "ANA", "#1f4fa0", "#ffffff", 66],
    ["bra3_tom", "Tombense", "TOM", "#0a8f3c", "#f5c400", 67]
  ],
  // Europa - segundas divisões
  por2: [
    ["por2_avi", "Acad\xE9mico de Viseu", "AVI", "#c8102e", "#111111", 68],
    ["por2_tor", "Torreense", "TOR", "#0a8f3c", "#ffffff", 68],
    ["por2_pfe", "Pa\xE7os de Ferreira", "PAC", "#f5c400", "#111111", 70],
    ["por2_viz", "Vizela", "VIZ", "#1f4fa0", "#ffffff", 70],
    ["por2_alv", "Alverca", "ALV", "#c8102e", "#ffffff", 69],
    ["por2_ptm", "Portimonense", "PTM", "#111111", "#c8102e", 70],
    ["por2_maf", "Mafra", "MAF", "#0a8f3c", "#ffffff", 67],
    ["por2_oli", "Oliveirense", "OLI", "#1f4fa0", "#f5c400", 67]
  ],
  ned2: [
    ["ned2_dor", "FC Dordrecht", "DOR", "#0a8f3c", "#ffffff", 68],
    ["ned2_top", "TOP Oss", "TOP", "#c8102e", "#111111", 66],
    ["ned2_mvv", "MVV Maastricht", "MVV", "#c8102e", "#ffffff", 67],
    ["ned2_jaj", "Jong Ajax", "JAJ", "#c8102e", "#ffffff", 69],
    ["ned2_jps", "Jong PSV", "JPS", "#c8102e", "#ffffff", 69],
    ["ned2_jut", "Jong FC Utrecht", "JUT", "#c8102e", "#111111", 67],
    ["ned2_alm", "Almere City", "ALM", "#c8102e", "#111111", 70],
    ["ned2_vit", "Vitesse", "VIT", "#f5c400", "#111111", 71],
    ["ned2_tel", "Telstar", "TEL", "#f5c400", "#111111", 67],
    ["ned2_wil", "Willem II", "WIL", "#c8102e", "#1f4fa0", 71]
  ],
  tur2: [
    ["tur2_san", "\u015Eanl\u0131urfaspor", "SAN", "#0a8f3c", "#f5c400", 67],
    ["tur2_cor", "\xC7orum FK", "COR", "#c8102e", "#111111", 68],
    ["tur2_pen", "Pendikspor", "PEN", "#1f4fa0", "#ffffff", 68],
    ["tur2_igd", "I\u011Fd\u0131r FK", "IGD", "#0a8f3c", "#ffffff", 67],
    ["tur2_koc", "Kocaelispor", "KOC", "#0a8f3c", "#111111", 70],
    ["tur2_ser", "Serikspor", "SER", "#c8102e", "#ffffff", 66],
    ["tur2_ese", "Esenler Erokspor", "ESE", "#f5820a", "#111111", 67],
    ["tur2_van", "Vanspor", "VAN", "#c8102e", "#f5c400", 66]
  ],
  sco2: [
    ["sco2_fal", "Falkirk", "FAL", "#1f4fa0", "#ffffff", 68],
    ["sco2_liv", "Livingston", "LIV", "#f5c400", "#111111", 69]
  ],
  // Ásia
  ind: [
    ["ind_pun", "Punjab FC", "PUN", "#c8102e", "#f5c400", 64],
    ["ind_hyd", "Hyderabad FC", "HYD", "#f5c400", "#111111", 63]
  ],
  chn: [
    ["chn_shp", "Shenzhen Peng City", "SPC", "#c8102e", "#111111", 68],
    ["chn_cha", "Changchun Yatai", "CCY", "#1f4fa0", "#ffffff", 68],
    ["chn_mei", "Meizhou Hakka", "MEI", "#f5c400", "#111111", 67],
    ["chn_dal", "Dalian Yingbo", "DAL", "#1f4fa0", "#f5c400", 67],
    ["chn_yun", "Yunnan Yukun", "YUN", "#0a8f3c", "#ffffff", 67],
    ["chn_qwc", "Qingdao West Coast", "QWC", "#1f4fa0", "#ffffff", 66]
  ],
  mas: [
    ["mas_klc", "Kuala Lumpur City", "KLC", "#c8102e", "#111111", 65],
    ["mas_per", "Perak", "PER", "#f5c400", "#111111", 62],
    ["mas_kel", "Kelantan Darul Naim", "KDN", "#c8102e", "#f5c400", 61],
    ["mas_pah", "Sri Pahang", "PAH", "#f5c400", "#111111", 63]
  ],
  vie: [
    ["vie_slna", "S\xF4ng Lam Ngh\u1EC7 An", "SLNA", "#f5c400", "#111111", 62],
    ["vie_hai", "H\u1EA3i Ph\xF2ng", "HAI", "#c8102e", "#ffffff", 64],
    ["vie_qna", "Qu\u1EA3ng Nam", "QNA", "#0a8f3c", "#ffffff", 61],
    ["vie_bdi", "B\xECnh \u0110\u1ECBnh", "BDI", "#c8102e", "#f5c400", 63],
    ["vie_dan", "SHB \u0110\xE0 N\u1EB5ng", "DAN", "#f5820a", "#111111", 62],
    ["vie_hat", "H\u1ED3ng L\u0129nh H\xE0 T\u0129nh", "HAT", "#1f4fa0", "#ffffff", 61]
  ],
  kaz: [
    ["kaz_yel", "Yelimay", "YEL", "#1f4fa0", "#f5c400", 60],
    ["kaz_zhe", "Zhenis", "ZHE", "#0a8f3c", "#ffffff", 60],
    ["kaz_kyz", "Kyzylzhar", "KYZ", "#c8102e", "#ffffff", 62],
    ["kaz_aks", "Aksu", "AKS", "#1f4fa0", "#ffffff", 59],
    ["kaz_kais", "Kaisar", "KAI", "#0a8f3c", "#f5c400", 61],
    ["kaz_okz", "Okzhetpes", "OKZ", "#1f4fa0", "#111111", 59]
  ],
  uzb: [
    ["uzb_qiz", "Qizilqum", "QIZ", "#1f4fa0", "#ffffff", 60],
    ["uzb_nef", "Neftchi Fergana", "NEF", "#0a8f3c", "#ffffff", 63],
    ["uzb_met", "Metallurg Bekabad", "MET", "#c8102e", "#111111", 60],
    ["uzb_oly", "Olympic Tashkent", "OLY", "#1f4fa0", "#f5c400", 61],
    ["uzb_din", "Dinamo Samarqand", "DIN", "#1f4fa0", "#ffffff", 61],
    ["uzb_lok", "Lokomotiv Tashkent", "LOK", "#0a8f3c", "#ffffff", 64]
  ],
  irn: [
    ["irn_mes", "Mes Rafsanjan", "MES", "#f5820a", "#111111", 64],
    ["irn_nas", "Nassaji Mazandaran", "NAS", "#c8102e", "#ffffff", 64],
    ["irn_hav", "Havadar", "HAV", "#1f4fa0", "#ffffff", 62],
    ["irn_alu", "Aluminium Arak", "ALU", "#1f4fa0", "#f5c400", 63],
    ["irn_pay", "Paykan", "PAY", "#c8102e", "#111111", 62],
    ["irn_sha", "Shams Azar", "SHA", "#0a8f3c", "#ffffff", 62],
    ["irn_cha", "Chadormalu", "CHA", "#f5c400", "#111111", 62],
    ["irn_khe", "Kheybar", "KHE", "#1f4fa0", "#ffffff", 61]
  ],
  irq: [
    ["irq_karkh", "Al-Karkh", "KAR", "#1f4fa0", "#ffffff", 62],
    ["irq_nba", "Naft Al-Basra", "NBA", "#0a8f3c", "#ffffff", 62],
    ["irq_naj", "Al-Najaf", "NAJ", "#1f4fa0", "#f5c400", 62],
    ["irq_min", "Al-Minaa", "MIN", "#c8102e", "#ffffff", 63],
    ["irq_zak", "Zakho", "ZAK", "#f5c400", "#111111", 61],
    ["irq_kah", "Al-Kahrabaa", "KAH", "#f5820a", "#111111", 61],
    ["irq_new", "Newroz", "NEW", "#0a8f3c", "#f5c400", 61],
    ["irq_hud", "Al-Hudood", "HUD", "#1f4fa0", "#111111", 60]
  ],
  jor: [
    ["jor_tha", "That Ras", "THA", "#0a8f3c", "#ffffff", 57],
    ["jor_sah", "Sahab", "SAH", "#1f4fa0", "#ffffff", 58],
    ["jor_sar", "Al-Sareeh", "SAR", "#c8102e", "#111111", 57],
    ["jor_mog", "Moghayer Al-Sarhan", "MOG", "#f5c400", "#111111", 56]
  ],
  kwt: [
    ["kwt_nasr", "Al-Nasr", "NAS", "#1f4fa0", "#ffffff", 58],
    ["kwt_kha", "Khaitan", "KHA", "#0a8f3c", "#ffffff", 57]
  ],
  omn: [
    ["omn_suw", "Al-Suwaiq", "SUW", "#c8102e", "#ffffff", 60],
    ["omn_oma", "Oman Club", "OMA", "#1f4fa0", "#ffffff", 59],
    ["omn_sah", "Saham", "SAH", "#0a8f3c", "#ffffff", 58],
    ["omn_rus", "Al-Rustaq", "RUS", "#f5c400", "#111111", 57],
    ["omn_itt", "Al-Ittihad Salalah", "ITT", "#1f4fa0", "#f5c400", 58],
    ["omn_shb", "Al-Shabab Oman", "SHB", "#c8102e", "#111111", 57]
  ],
  hkg: [
    ["hkg_nor", "North District", "NOR", "#1f4fa0", "#ffffff", 55],
    ["hkg_ssp", "Sham Shui Po", "SSP", "#0a8f3c", "#ffffff", 55]
  ],
  nzl: [
    ["nzl_wsp", "Western Springs", "WSP", "#0a8f3c", "#ffffff", 56],
    ["nzl_mel", "Melville United", "MEL", "#1f4fa0", "#f5c400", 55]
  ],
  // África
  alg: [
    ["alg_mco", "MC Oran", "MCO", "#c8102e", "#ffffff", 64],
    ["alg_aso", "ASO Chlef", "ASO", "#c8102e", "#f5c400", 63],
    ["alg_jss", "JS Saoura", "JSS", "#0a8f3c", "#ffffff", 64],
    ["alg_ncm", "NC Magra", "NCM", "#1f4fa0", "#ffffff", 61],
    ["alg_usb", "US Biskra", "USB", "#0a8f3c", "#f5c400", 61],
    ["alg_oak", "Olympique Akbou", "OAK", "#1f4fa0", "#f5c400", 62],
    ["alg_esm", "ES Mostaganem", "ESM", "#c8102e", "#111111", 61],
    ["alg_bay", "MC El Bayadh", "BAY", "#f5c400", "#111111", 60]
  ],
  tun: [
    ["tun_css", "CS Sfaxien", "CSS", "#111111", "#ffffff", 68],
    ["tun_met", "ES M\xE9tlaoui", "MET", "#0a8f3c", "#ffffff", 62],
    ["tun_gab", "AS Gab\xE8s", "GAB", "#1f4fa0", "#ffffff", 61],
    ["tun_sol", "AS Soliman", "SOL", "#f5c400", "#111111", 61],
    ["tun_ben", "US Ben Guerdane", "BEN", "#0a8f3c", "#f5c400", 63],
    ["tun_gaf", "EGS Gafsa", "GAF", "#c8102e", "#ffffff", 61]
  ],
  gha: [
    ["gha_gre", "Great Olympics", "GRE", "#1f4fa0", "#ffffff", 60],
    ["gha_kar", "Karela United", "KAR", "#f5820a", "#111111", 59],
    ["gha_leg", "Legon Cities", "LEG", "#1f4fa0", "#f5c400", 58],
    ["gha_dre", "Dreams FC", "DRE", "#f5c400", "#111111", 61],
    ["gha_bib", "Bibiani Gold Stars", "BIB", "#f5c400", "#0a8f3c", 60],
    ["gha_lio", "Heart of Lions", "LIO", "#c8102e", "#f5c400", 58],
    ["gha_bas", "Basake Holy Stars", "BAS", "#0a8f3c", "#ffffff", 57],
    ["gha_vis", "Vision FC", "VIS", "#1f4fa0", "#ffffff", 57]
  ],
  ken: [
    ["ken_kar", "Kariobangi Sharks", "KAR", "#1f4fa0", "#ffffff", 58],
    ["ken_sof", "Sofapaka", "SOF", "#0a8f3c", "#ffffff", 58],
    ["ken_pos", "Posta Rangers", "POS", "#f5c400", "#111111", 57],
    ["ken_kcb", "KCB", "KCB", "#0a8f3c", "#f5c400", 58],
    ["ken_ncs", "Nairobi City Stars", "NCS", "#1f4fa0", "#f5c400", 57],
    ["ken_mat", "Mathare United", "MAT", "#0a8f3c", "#ffffff", 57],
    ["ken_kak", "Kakamega Homeboyz", "KAK", "#f5820a", "#111111", 58],
    ["ken_tal", "Talanta", "TAL", "#c8102e", "#ffffff", 56]
  ],
  ang: [
    ["ang_hui", "Desportivo da Hu\xEDla", "HUI", "#1f4fa0", "#ffffff", 60],
    ["ang_lib", "Recreativo do Libolo", "LIB", "#0a8f3c", "#ffffff", 61],
    ["ang_alo", "Acad\xE9mica do Lobito", "ALO", "#c8102e", "#111111", 59],
    ["ang_asa", "ASA", "ASA", "#f5c400", "#111111", 59],
    ["ang_pro", "Progresso Sambizanga", "PRO", "#1f4fa0", "#f5c400", 58],
    ["ang_cab", "Sporting de Cabinda", "CAB", "#0a8f3c", "#f5c400", 58],
    ["ang_bxc", "Baixa de Cassanje", "BXC", "#c8102e", "#ffffff", 57],
    ["ang_mai", "1\xBA de Maio", "MAI", "#c8102e", "#f5c400", 57]
  ],
  civ: [
    ["civ_rac", "Racing Club d'Abidjan", "RAC", "#1f4fa0", "#ffffff", 60],
    ["civ_afa", "AFAD Dj\xE9kanou", "AFA", "#0a8f3c", "#ffffff", 59],
    ["civ_spe", "FC San P\xE9dro", "SPE", "#1f4fa0", "#f5c400", 61],
    ["civ_iva", "Ivoire Acad\xE9mie", "IVA", "#f5820a", "#111111", 58],
    ["civ_bas", "USC Bassam", "BAS", "#c8102e", "#ffffff", 58],
    ["civ_lys", "LYS Sassandra", "LYS", "#0a8f3c", "#f5c400", 58]
  ],
  sen: [
    ["sen_gor", "US Gor\xE9e", "GOR", "#1f4fa0", "#f5c400", 59],
    ["sen_lin", "ASC Lingu\xE8re", "LIN", "#0a8f3c", "#ffffff", 58],
    ["sen_dsc", "Dakar Sacr\xE9-Coeur", "DSC", "#c8102e", "#ffffff", 60],
    ["sen_son", "Sonacos", "SON", "#f5c400", "#111111", 58],
    ["sen_wal", "Wally Daan", "WAL", "#1f4fa0", "#ffffff", 57],
    ["sen_hlm", "HLM Dakar", "HLM", "#0a8f3c", "#f5c400", 57]
  ],
  cmr: [
    ["cmr_fau", "Fauve Azur", "FAU", "#1f4fa0", "#ffffff", 58],
    ["cmr_bam", "Bamboutos", "BAM", "#0a8f3c", "#ffffff", 58],
    ["cmr_for", "Fortuna Mfou", "FOR", "#f5c400", "#111111", 57],
    ["cmr_str", "Stade Renard", "STR", "#c8102e", "#ffffff", 58],
    ["cmr_avi", "Avion Academy", "AVI", "#1f4fa0", "#f5c400", 56],
    ["cmr_col", "Colombe Sportive", "COL", "#0a8f3c", "#f5c400", 57],
    ["cmr_ast", "Astres de Douala", "AST", "#f5820a", "#111111", 57],
    ["cmr_rac", "Racing Bafoussam", "RAC", "#c8102e", "#111111", 57]
  ],
  cod: [
    ["cod_dau", "Dauphins Noirs", "DAU", "#1f4fa0", "#ffffff", 59],
    ["cod_ble", "Blessing FC", "BLE", "#0a8f3c", "#ffffff", 57],
    ["cod_baz", "JS Groupe Bazano", "BAZ", "#c8102e", "#111111", 58],
    ["cod_pan", "US Panda", "PAN", "#f5c400", "#111111", 58],
    ["cod_buk", "OC Bukavu Dawa", "BUK", "#1f4fa0", "#f5c400", 57],
    ["cod_ran", "AC Rangers", "RAN", "#0a8f3c", "#f5c400", 57],
    ["cod_aig", "Aigles du Congo", "AIG", "#c8102e", "#ffffff", 57],
    ["cod_maki", "CS Makiso", "MAK", "#1f4fa0", "#111111", 56]
  ],
  zam: [
    ["zam_nkw", "Nkwazi", "NKW", "#1f4fa0", "#ffffff", 57],
    ["zam_nap", "Napsa Stars", "NAP", "#0a8f3c", "#ffffff", 58],
    ["zam_muf", "Mufulira Wanderers", "MUF", "#c8102e", "#ffffff", 58],
    ["zam_lum", "Lumwana Radiants", "LUM", "#f5c400", "#111111", 56],
    ["zam_pri", "Prison Leopards", "PRI", "#0a8f3c", "#f5c400", 57],
    ["zam_tri", "Trident FC", "TRI", "#1f4fa0", "#f5c400", 56],
    ["zam_kon", "Konkola Blades", "KON", "#1f4fa0", "#111111", 57],
    ["zam_kan", "Kansanshi Dynamos", "KAN", "#f5820a", "#111111", 56]
  ]
};
function applyLeagueFill(leagueId, clubs) {
  const extra = LEAGUE_FILL[leagueId];
  if (!extra) return clubs;
  const seen = new Set(clubs.map((c) => c.id));
  const added = extra.filter(([id]) => !seen.has(id)).map(([id, name, short, primary, secondary, strength]) => ({
    id,
    name,
    short,
    league: leagueId,
    primary,
    secondary,
    strength
  }));
  return [...clubs, ...added];
}

// src/game/data/league-memberships.generated.ts
var S0 = "2026";
var S1 = "2026-2027";
var S2 = "2027";
var S3 = "2025-2026";
var S4 = "2022";
var LEAGUE_MEMBERSHIPS = { "bra": ["sdb:4351", S0, "ath||134297;mgo||134299;bah||134293;bot||134285;bra_134736|Bragantino;cha||134464;cor||134284;cor_pr||134298;cru||134294;fla||134287;flu||134296;gre||134288;int||134281;mir||141181;pal||134465;rem||137818;san||134286;sao||134291;vas||134282;vit||134280"], "bra2": ["sdb:4404", S0, "bra2_134742|Am\xE9rica Mineiro;ath_ba||147142;ath_go||134737;avai||134738;bra2_bot||136830;cea||134744;crb||135680;cri||134292;x5762_136831;for||136186;gao||134295;juv||135887;bra3_lon||135664;bra2_nau||134289;nov||141182;x5766_136829;bra2_134290|Ponte Preta;bra3_sao_ber||145389;spt||136250;vnv||134734"], "eng": ["sdb:4328", S1, "ars||133604;avl||133601;bou||134301;bre||134355;eng_133619|Brighton And Hove Albion;che||133610;cov||133625;cry||133632;eve||133615;ful||133600;hul||133617;ips||133622;lee||133635;liv||133602;mci||133613;mun||133612;new||134777;nfo||133720;sun||133603;tot||133616"], "eng2": ["sdb:4329", S1, "eng2_133597|Birmingham City;eng2_blb||133598;eng2_133606|Bolton Wanderers;bri||133621;bur||133623;eng2_car||133637;eng2_133851|Charlton Athletic;der||133627;eng2_135900|Lincoln City;mid||133628;mil||133634;nor||133608;por||133629;pre||133809;qpr||133605;shu||133811;sou||134778;stk||133609;swa||133614;wat||133624;eng2_133611|West Bromwich Albion;whu||133636;eng2_133599|Wolverhampton Wanderers;eng2_134775|Wrexham"], "esp": ["sdb:4335", S1, "ath_b||133727;atm||133729;bar||133739;esp_133937|Celta Vigo;alv||134221;esp_133816|Deportivo De A Coru\xF1a;elc||134384;esp_e||133734;get||133731;lev||133732;esp2_mlg||133736;osa||133730;esp_133726|Racing De Santander;ray||133728;bet||133722;rma||133738;rso||133724;sev||133735;val||133725;vil_e||133740"], "ita": ["sdb:4332", S1, "ita_133667|AC Milan;ata||134782;bol||134781;cag||134783;com||134243;fio||133674;ita2_fro||133818;gen||133675;int_i||133681;juv_i||133676;laz||133668;lec||133678;ita_134270|Monza;nap||133670;par||135728;rom||133682;sas||133701;tor||133687;udi||133679;ita2_ven||134234"], "ger": ["sdb:4331", S1, "y4331_133652;b04||133666;y4331_133664;bvb||133650;y4331_134779;sge||133814;y4331_138411;y4331_133653;y4331_133651;tsg||133657;y4331_133654;y4331_133665;y4331_134551;rbl||134695;ger2_sch||133661;y4331_133660;fcu||134690;wer||133662"], "fra": ["sdb:4334", S1, "y4334_134709;y4334_134788;y4334_133704;laz_f||133862;y4334_133848;y4334_133822;lil||133711;y4334_133715;y4334_133713;y4334_133707;y4334_133823;y4334_133712;par_f||135465;psg||133714;y4334_133719;str||133882;tou||133703;fra2_troy||134789"], "por": ["sdb:4344", S1, "por2_avi||138856;ala||143704;arv||134387;ben||134108;por_134098|Braga;cas||138864;por_134106|Estoril Praia;por_140008|Estrela Amadora;fam||136854;gil||134113;mar_p||134023;mor||134112;por_134109|Nacional De Madeira;por_134114|Porto;riv||134107;san_p||136192;spo||135708;vit_g||134115"], "ned": ["sdb:4337", S1, "ned2_ado||133769;aja||133772;az||133767;ned2_cam||134303;exc||133757;fey||133758;for_n||134264;gae||134304;ned_133762|Groningen;hee||133759;nec||133760;pec||133936;psv||133768;skc||133866;tel||138004;ned_133774|Twente;ned_133764|Utrecht;ned2_wil||133827"], "bel": ["sdb:4338", S1, "and||133776;bel_134245|Antwerp;bel_133941|Beveren;cer||133782;cha_b||133826;clb||133789;bel_133779|Genk;bel_133781|Gent;bel_133783|Kortrijk;bel_138143|Lommel;bel_133787|Mechelen;bel_133775|Oud Heverlee Leuven;bel_148488|Raal La Louvi\xE8re;stt||135461;std||133778;usg||138141;wes||133790;zul||133786"], "tur": ["sdb:4339", S1, "ala_t||135676;tur_138959|Amed;bes||133794;tur_138951|\xC7orum;tur2_erz||134272;eyu||138977;fen||133807;gal||133804;tur_138092|Gaziantep;gen_t||133798;goz||135891;tur_134589|\u0130stanbul Ba\u015Fak\u015Fehir;kas||133834;kocae||133870;kon||133835;riz||133885;sam||133797;tra||133796"], "sco": ["sdb:4330", S1, "abe||133638;cel_s||133647;sco_133942|Dundee;dun||133644;fal||133838;hea||133643;hib||133646;kil||133645;mot||133640;ran||133642;stj||133639;stm||133649"], "arg": ["sdb:4406", S0, "arg_135150|Aldosivi;arg_j||135151;arg_135681|Atl\xE9tico Tucum\xE1n;ban||135154;arg_137771|Barracas Central;bel||135155;boc||135156;arg_137603|Central C\xF3rdoba De Santiago Del Estero;def||135159;arg_137782|Deportivo Riestra;arg_135160|Estudiantes De La Plata;arg2_erc||137773;arg_135161|Gimnasia Y Esgrima De La Plata;arg_137778|Gimnasia Y Esgrima De Mendoza;hur||135163;ind||135164;arg_137777|Independiente Rivadavia;arg_137786|Instituto;lan||135165;new_a||135166;arg_137775|Platense;rac||135170;riv_a||135171;ros||135172;san_a||135173;arg_135175|Sarmiento;arg_136674|Talleres De C\xF3rdoba;tig||135177;arg_135178|Uni\xF3n;vel||135179"], "mex": ["sdb:4350", S1, "mex_134193|Am\xE9rica;mex_134203|Atlante;atl_m||134195;mex_136856|Atl\xE9tico De San Luis;mex_134206|Cd Guadalajara;cru_m||134196;mex_136855|Ju\xE1rez;lea||134207;mty||134198;nec_m||135662;pac||134191;pue||134199;pum||134201;que||134194;san_m||134192;tig_m||134197;tij||134202;tol||134204"], "usa": ["sdb:4346", S1, "atl_u||135851;aus||140079;usa_mtl||134150;usa_cha||140078;usa_chi||134154;usa_col||134794;col||134152;usa_dcu||134145;cin||136688;dal||134146;hou||134144;mia||137699;lag||134153;laf||136050;min||135852;nsh||137700;usa_ner||134159;nyc||134630;rbny||134156;orl||135292;phi||134142;por_u||134155;usa_rsl||134158;usa_sdi||150261;usa_sjo||134157;sea||134149;skc_u||134143;usa_147062|St. Louis City SC;usa_tor||134148;usa_van||134147"], "sau": ["sdb:4668", S1, "sau_137855|Abha;ahl||137721;sau_152917|Al Diriyah;eti||136017;sau_136021|Al Faisaly;fat||136011;fay||136014;ham||136200;hil||136013;itt||136018;kha||139080;kho||149112;nas||136022;qad||136015;riy||147445;shb||136020;taa||136012;sau_150637|Neom"], "jpn": ["sdb:4633", S2, "avs_j||139882;cer_j||137703;oka||139884;fct||137704;gam||137705;jpn_139886|Jef United Chiba;kas_j||137707;kas_k||137708;kaw||137709;kyo||139888;mac||139889;jpn_139891|Mito Hollyhock;nag||137710;san_j||137713;shi||137714;jpn_tky||139901;urw||137716;jpn_139899|V Varen Nagasaki;vis||137717;yok||137719"], "esp2": ["sdb:4400", S1, "esp2_alb||134232;esp2_alm||133817;esp2_bur||138161;esp2_cad||134222;esp2_cas||138286;esp2_137826|Celta Fortuna;esp2_144243|Ceuta;esp2_cor||134627;esp2_eib||134626;esp2_144246|Eldense;esp2_138280|FC Andorra;gir||134700;esp2_gra||133721;esp2_134259|Las Palmas;esp2_leg||134701;mlg||133733;esp2_ovi||135455;esp2_138160|Real Sociedad B;esp2_val||133841;esp2_134704|Sabadell;esp2_133723|Sporting De Gij\xF3n;esp2_ten||133840"], "ita2": ["sdb:4394", S1, "ita2_134212|Arezzo;ita2_133686|Ascoli;ita2_133858|Avellino;ita2_134688|Benevento;ita2_car||134666;ita2_cat||134223;ita2_ces||133669;ita2_cre||134224;ita2_133695|Empoli;ver||134784;ita2_jus||133696;ita2_man||133845;ita2_mod||133700;ita2_135950|Padova;ita2_pal||138166;ita2_pis||133859;ita2_sam||133683;ita2_sud||134654;ita2_137255|Vicenza;ita2_134633|Virtus Entella"], "ger2": ["sdb:4399", S1, "y4399_133852;y4399_133839;y4399_134693;y4399_135655;ger2_bra||134302;y4399_133853;ger2_gre||134099;y4399_133656;hdh||134696;y4399_133658;y4399_136027;ger2_kai||133663;y4399_135293;y4399_136194;y4399_133659;y4399_137115;stp||133813;y4399_133655"], "fra2": ["sdb:4401", S1, "fra2_ann||139928;fra2_133849|Boulogne;fra2_134713|Clermont Foot;fra2_133718|Dijon;fra2_dun||138821;fra2_gre||133847;fra2_gui||134244;fra2_lav||134708;fra2_133883|Metz;mtp||133709;fra2_133710|Nancy Lorraine;fra2_133861|Nantes;fra2_138309|Pau;fra2_lor||135467;fra2_rod||137652;fra2_sai||133717;fra2_133708|Sochaux;fra2_133934|Stade De Reims"], "gre": ["sdb:4336", S1, "gre_133753|Aek Athens;gre_ari||133742;gre_ast||133752;gre_ate||133744;gre_144154|Iraklis 1908;gre_134275|Kalamata;gre_kif||144147;gre_lev||133755;gre_133743|Ofi;gre_oly||133754;gre_pao||133746;gre_133751|Panetolikos;gre_paok||133749;gre_vol||136853"], "sui": ["sdb:4675", S1, "sui_133957|Basel;sui_134391|Grasshoppers;sui_138990|Lausanne Sport;sui_136037|Lugano;sui_134123|Luzern;sui_ser||133991;sui_135947|Sion;sui_stg||134406;sui_134394|Thun;sui_ver||134320;sui_ybb||134001;sui_134396|Z\xFCrich"], "aut": ["sdb:4621", S1, "aut_139425|Austria Lustenau;aut_134390|Austria Vienna;aut_139415|Grazer Ak;aut_lask||137261;aut_134021|Rapid Vienna;aut_rbs||133970;aut_137742|Scr Altach;aut_sturm||137743;aut_ried||133993;aut_137805|TSV Hartberg;aut_wac||137252;aut_tir||137807"], "den": ["sdb:4340", S1, "den_133895|AC Horsens;den_ags||133899;den_bru||133893;den_133898|FC Copenhagen;den_mid||133891;den_nor||133890;den_lyn||133900;den_133889|Odense Bk;den_133938|Randers FC;den_133892|Silkeborg If;den_son||133897;den_vib||134307"], "nor": ["sdb:4358", S0, "nor_133998|Aalesund;nor_bod||135497;nor_bra2b||134571;nor_fre||134749;nor_134753|Hamarkameratene;nor_135723|Kfum Kameratene Oslo;nor_kri||134754;nor_lil||134569;nor_mol||133958;nor_ros||133990;nor_sand||135715;nor_sar||134566;nor_134568|Start;nor_tro||133997;nor_val||134574;nor_vik||134570"], "swe": ["sdb:4347", S0, "swe_aik||134011;swe_bro||134170;swe_deg||134728;swe_dju||134162;swe_elf||133984;swe_gais||134725;swe_hac||134160;swe_hal||134167;swe_ham||134731;swe_ifk||134161;swe_134002|Kalmar;swe_134166|Malm\xF6;swe_mjo||134164;swe_135668|\xD6rgryte;swe_sir||134724;swe_136832|V\xE4ster\xE5s"], "pol": ["sdb:4422", S1, "pol_cra||135294;pol_142467|Gks Katowice;pol_gor||135296;pol_135297|Jagiellonia Bia\u0142ystok;pol_kor||135298;pol_lech||134010;pol_133992|Legia Warsaw;pol_mot||147435;pol_pia||135300;pol_pog||135302;pol_138916|Radomiak Radom;pol_137670|Rak\xF3w Cz\u0119stochowa;pol_sla||133952;pol_wid||134489;pol_152462|Wieczysta Krak\xF3w;pol_wis||135303;pol_135659|Wis\u0142a P\u0142ock;pol_zag||135496"], "ukr": ["sdb:4354", S1, "ukr_146855|Bukovyna Chernivtsi;ukr_134392|Chornomorets Odesa;ukr_dyn||133944;ukr_146857|Epitsentr Kamianets Podilsky;ukr_134426|Karpaty Lviv;ukr_134122|Kharkiv;ukr_kol||136858;ukr_142826|Kryvbas Kryvyi Rih;ukr_149227|Kudrivka;ukr_147624|Livyi Bereh Kyiv;ukr_lnz||146860;ukr_138447|Obolon Kyiv;ukr_140180|Polissya Zhytomyr;ukr_sha||134126;ukr_ver||135911;ukr_zor||134422"], "chi": ["sdb:4627", S0, "chi_aud||137722;chi_cob||137723;chi_col||137724;chi_coq||137725;chi2_con||148528;chi2_lse||139473;chi_lim||148082;chi_137729|Everton De Vi\xF1a Del Mar;chi_hua||137730;chi_ibe||140549;chi_ohi||137731;chi_pal||137732;chi_cal||137734;chi_ucat||137735;chi_uch||137736;chi2_uco||137737"], "col": ["sdb:4497", S1, "col_137605|Alianza De Valledupar;col_ame||137604;col_137606|Atl\xE9tico Bucaramanga;col_137615|Atl\xE9tico Junior;col_atn||137607;col_137622|Boyac\xE1 Chic\xF3;col2_cuc||137608;col_ton||137609;col_dep||137610;col_pas||137611;col_pere||137623;col_141065|Fortaleza FC;col_dim||137613;col_137621|Independiente Santa Fe;col_137616|Internacional De Bogot\xE1;col_137614|Jaguares De C\xF3rdoba;col2_lla||141067;col_mil||137617;col_137618|Once Caldas;col_137620|Rionegro \xC1guilas"], "uru": ["sdb:4432", S0, "uru2_alb||141805;uru_boston||136051;uru2_cen||141806;uru_cerr||135363;uru_cer||138817;uru_dan||135365;uru_def||135366;uru_138816|Deportivo Maldonado;uru_135368|Juventud Las Piedras;uru_136052|Liverpool Montevideo;uru_138818|Montevideo City Torque;uru_135377|Montevideo Wanderers;uru_135364|Nacional Montevideo;uru_pen||135369;uru_pro||138815;uru_rac||135370"], "aus": ["sdb:4356", S1, "aus_adl||134472;aus_auk||149411;aus_bri||134476;aus_134479|Central Coast Mariners;aus_mac||138063;aus_mcy||134634;aus_mvc||134477;aus_new||134474;aus_per||134481;aus_syd||134473;aus_wel||134475;aus_134480|Western Sydney Wanderers"], "kor": ["sdb:4689", S0, "kor_139783|Bucheon FC 1995;kor_139785|Daejeon Hana Citizen;kor_139786|FC Anyang;kor_seo||138115;kor_gan||138108;kor_gim||138113;kor_gwa||138109;kor_inc||138110;kor_jeju||139078;kor_138111|Jeonbuk Hyundai Motors;kor_poh||138112;kor_uls||138117"], "egy": ["sdb:4829", S1, "egy_156496|Abou Qir Fertilizers;egy_ahl||138995;egy_139839|Al Ittihad Alexandria;egy_mas||139844;egy_139837|Al Mokawloon Al Arab;egy_156495|Asyut Petroleum;egy_cer||140795;egy_gou||139845;egy_156494|El Qanah;egy_ent||139841;egy_140794|Ghazl El Mahalla;egy_mod||144160;egy_140796|National Bank Of Egypt;egy_149410|Petrojet;egy_139838|Pyramids;egy_smo||139840;egy_tal||139848;egy_139850|Wadi Degla;egy_zam||138997;egy_139852|Zed"], "hrv": ["sdb:4629", S1, "hrv_din||133961;hrv_haj||134019;hrv_137794|Hnk Gorica;hrv_ist||137797;hrv_lok||137795;hrv_osi||134041;hrv_rij||134399;hrv_rud||141086;hrv_133989|Slaven Belupo Koprivnica;hrv_var||137798"], "srb": ["sdb:4671", S1, "srb_czv||133987;srb_cuk||134617;srb_141832|Imt Novi Beograd;srb_137867|Ma\u010Dva \u0160abac;srb_mla||137860;srb_nov||140069;srb_140232|Ofk Beograd;srb_133960|Partizan Belgrade;srb_141776|Radni\u010Dki 1923;srb_rad||137858;srb_137864|Radnik Surdulica;srb_voj||134022;srb_141839|\u017Delezni\u010Dar Pan\u010Devo;srb_zem||143870"], "cze": ["sdb:4631", S1, "cze_141110|Artis Brno;cze_ban||136684;cze_boh||136681;cze_hra||141109;cze_jab||134395;cze_mlb||134000;cze_pce||140093;cze_sig||136677;cze_sla||136036;cze_slo||136685;cze_lib||133954;cze_spa||134007;cze_tep||136680;cze_plz||134015;cze_140094|Zbrojovka Brno;cze_137810|Zl\xEDn"], "rou": ["sdb:4691", S1, "rou_138932|Arge\u0219 Pite\u0219ti;rou_bot||138191;rou_cfr||133955;rou_147629|Corvinul Hunedoara;rou_138930|Cs\xEDkszereda Miercurea Ciuc;rou_din||134121;rou_far||138926;rou_fcs||134005;rou_otl||135929;rou_134398|Petrolul Ploie\u0219ti;rou_rap||134017;rou_sep||138192;rou_138198|Universitatea Cluj;rou_ucv||138188;rou_uta||138924;rou_138197|Voluntari"], "per": ["sdb:4688", S0, "per_144717|Adt;per_140803|Alianza Atl\xE9tico;per_ali||138311;per_gri||138313;per_150363|Cajamarca;per_cie||138319;per_com||141812;per_138320|Cusco;per_147636|Deportivo Garcilaso;per_149507|Deportivo Moquegua;per_149506|Juan Pablo Ii College;per_141813|Los Chankas;per_138323|Melgar;per_boy||138324;per_gar||138325;per_cri||138326;per_138330|Universidad T\xE9cnica De Cajamarca;per_uni||138329"], "ecu": ["sdb:4686", S0, "ecu_auc||138219;ecu_bsc||138159;ecu_del||138220;ecu_cue||138221;ecu_eme||138223;ecu_gua||138224;ecu_idv||138225;ecu_ldu||138227;ecu_148158|Leones;ecu_145837|Libertad FC;ecu_mac||138228;ecu_140792|Manta;ecu_msr||138229;ecu_ore||138231;ecu_tec||138232;ecu_138233|Universidad Cat\xF3lica Del Ecuador"], "par": ["sdb:4687", S0, "par_140614|2 De Mayo;par_ccp||138290;par_138293|Club Guaran\xED;par_138294|Club Libertad;par_138295|Club Nacional;par_138296|Club Olimpia;par_147065|Recoleta;par_rub||140625;par_ame||140626;par_luq||138300;par_138298|Sportivo San Lorenzo;par_tri||140628"], "bol": ["sdb:4685", S0, "bol_146957|Abb;bol_oru||138209;bol_aur||138199;bol_blo||138203;bol_bol||138200;bol_gua||138201;bol_148051|Gv San Jos\xE9;bol_140718|Independiente Petrolero;bol_nac||138208;bol_ori||138210;bol_146967|Real Oruro;bol_138212|Real Potos\xED;bol_tom||140725;bol_saj||148052;bol_str||138206;bol_144997|Universitario De Vinto"], "nga": ["sdb:4827", S1, "nga_abw||139908;nga_152961|Barau;nga_ben||147118;nga_147119|Doma United;nga_eny||139746;nga_149049|Ikorodu City;nga_156644|Inter Lagos;nga_ken||139751;nga_139915|Katsina United;nga_152962|Kun Khalifat;nga_kwg||139921;nga_139907|Nasarawa United;nga_144672|Niger Tornadoes;nga_pla||139910;nga_156671|Ranchers Bees;nga_139911|Rangers International;nga_riv||139914;nga_sho||144674;nga_148153|Sporting Lagos;nga_139919|Warri Wolves"], "rsa": ["sdb:4802", S1, "rsa_ama||139475;rsa_chp||139477;rsa_152822|Durban City;rsa_139488|Golden Arrows;rsa_chi||139474;rsa_156305|Kruger United;rsa_sun||134491;rsa_151525|Marumo Gallants;rsa_156306|Milford;rsa_pir||139483;rsa_pol||139487;rsa_ric||146756;rsa_sek||143480;rsa_139479|Siwelele;rsa_stl||139482;rsa_tsg||140404"], "mar": ["sdb:4520", S1, "mar_153100|Amal Tiznit;mar_136417|Codm De Mekn\xE8s;mar_137426|Difa\xE2 Hassani El Jadidi;mar_136403|Far Rabat;mar_fus||136410;mar_has||136409;mar_136414|Ir Tanger;mar_136407|Kawkab Marrakech;mar_136405|Maghreb Fez;mar_136408|Moghreb T\xE9touan;mar_raj||136404;mar_137428|Rca Zemamra;mar_ber||137425;mar_140801|Union Touarga Sport;mar_138846|Widad Temara;mar_wyd||136402"], "qat": ["sdb:4663", S1, "qat_138049|Al Ahli Doha;qat_ara||135946;qat_duh||137679;qat_gha||138029;qat_ray||138050;qat_sad||137648;qat_138035|Al Sailiya;qat_138030|Al Shahaniya;qat_sha2||141174;qat_wak||137994;qat_155255|Lusail;qat_qsc||137995"], "uae": ["sdb:4678", S1, "uae_ajm||137838;uae_ain||137832;uae_137834|Al Dhafra;uae_jaz||137830;uae_nas||137831;uae_wah||137836;uae_was||137835;uae_ban||137839;uae_hrt||137841;uae_kal||137837;uae_kho||137842;uae_137828|Shabab Al Ahli Dubai;uae_shj||137829;uae_156157|United FC Dubai"], "tha": ["sdb:4743", S1, "tha_139239|Ayutthaya United;tha_bkk||139222;tha_bgp||139227;tha_bur||139208;tha_139019|Chiangrai United;tha_chb||139209;tha_143534|Lamphun Warrior;tha_152723|Pattani;tha_139221|Port;tha_pra||139210;tha_152721|Rasisalai United;tha_rac||139217;tha_139232|Rayong;tha_149121|Sisaket United;tha_suk||139211;tha_uth||139235"], "idn": ["sdb:4790", S1, "idn_are||139352;idn_bali||139353;idn_139350|Bhayangkara Presisi Lampung;idn_bor||139354;idn_146512|Dewa United Banten;idn_156672|Garudayaksa;idn_156673|Isenmulang Kalteng;idn_150104|Java United;idn_mad||139347;idn_pby||139348;idn_pers||139356;idn_perj||139357;idn_152569|Persijap Jepara;idn_persik||139349;idn_139359|Persita Tangerang;idn_152568|Psim Yogyakarta;idn_psm||139361;idn_pss||139362"], "can": ["sdb:4820", S0, "can_ott||139461;can_139462|Cavalry;can_139321|Forge;can_hfx||139463;can_139466|Inter Toronto;can_139464|Pacific;can_154611|Supra Du Qu\xE9bec;can_van||147076"], "rus": ["sdb:4355", S1, "rus_akh||134434;rus_akr||140083;rus_bal||138146;rus_134120|Cska Moscow;rus_143113|Dynamo Makhachkala;rus_133985|Dynamo Moscow;rus_138149|Fakel Voronezh;rus_kra||134433;rus_134432|Krylia Sovetov Samara;rus_134440|Lokomotiv Moscow;rus_ore||135661;rus_143118|Rodina Moscow;rus_ros||134438;rus_rub||134127;rus_134097|Spartak Moscow;rus_134125|Zenit Saint Petersburg"], "isr": ["sdb:4644", S1, "isr_bei||135992;isr_bnei||135994;isr_hbs||134799;isr_hha||135995;isr_133950|Hapoel Ironi Kiryat Shmona;isr_hje||141235;isr_141238|Hapoel Petah Tikva;isr_134796|Hapoel Ramat Gan;isr_hte||134124;isr_146401|Ironi Tiberias;isr_mha||134400;isr_mne||134087;isr_mpt||135998;isr_mtl||134315"], "hun": ["sdb:4690", S1, "hun_134070|Budapest Honv\xE9d;hun_deb||133945;hun_fer||134620;hun_134314|Gy\u0151ri Eto;hun_kis||138184;hun_mtk||134028;hun_nyi||141223;hun_138185|Paks;hun_pus||138182;hun_uje||138183;hun_141231|Vasas;hun_138186|Zalaegerszeg"], "bul": ["sdb:4626", S1, "bul_137916|Arda Kardzhali;bul_bot||134343;bul_bvr||137920;bul_cher||137915;bul_140107|Cska 1948;bul_csk||134088;bul_137918|Dunav Ruse;bul_lev||134085;bul_lok||134092;bul_lso||140769;bul_133981|Ludogorets Razgrad;bul_sep||140036;bul_sla||137914;bul_spv||142832"], "svk": ["sdb:4672", S1, "svk_137869|Dac 1904 Dunajsk\xE1 Streda;svk_dbb||146399;svk_146626|Kom\xE1rno;svk_kos||134603;svk_ruz||137871;svk_146400|Skalica;svk_slo||134090;svk_spa||134004;svk_134353|Tren\u010D\xEDn;svk_143920|\u017Deleziarne Podbrezov\xE1;svk_mic||137874;svk_133975|\u017Dilina"], "svn": ["sdb:4692", S1, "svn_138213|Aluminij;svn_bra||138217;svn_146615|Brinje Grosuplje;svn_cel||134318;svn_kop||134604;svn_mar||133948;svn_mur||138214;svn_146621|Nafta;svn_olim||134033;svn_rad||142322"], "cyp": ["sdb:4630", S1, "cyp_aek||136251;cyp_ael||137922;cyp_133994|Anorthosis Famagusta;cyp_133999|Apoel Nicosia;cyp_apol||134407;cyp_ari||141094;cyp_kar||140064;cyp_141098|Krasava Ypsonas;cyp_137926|Nea Salamis Famagusta;cyp_oly||137927;cyp_143789|Omonia 29m;cyp_141101|Omonia Aradippou;cyp_133986|Omonia Nicosia;cyp_137928|Pafos"], "irl": ["sdb:4643", S0, "irl_boh||134043;irl_der||134354;irl_dro||134331;irl_134618|Dundalk;irl_gal||139307;irl_sha||133978;irl_shel||138033;irl_sli||134093;irl_stp||134792;irl_wat||138034"], "fin": ["sdb:4636", S0, "fin_oul||140517;fin_141149|Gnistan;fin_hjk||133953;fin_ifk||134337;fin_ilv||136687;fin_int||134086;fin_140374|Jaro;fin_kup||134018;fin_136686|Lahti;fin_135673|Sjk Seinajoki;fin_134328|Tps;fin_vps||137878"], "isl": ["sdb:4642", S0, "isl_bre||134347;isl_134081|Fh Hafnarfjordur;isl_140780|Fram Reykjav\xEDk;isl_ia||137972;isl_ibv||136128;isl_ka||137970;isl_kef||140781;isl_kr||133968;isl_stj||134621;isl_val||137973;isl_vik||137974;isl_134044|\xDE\xF3r Akureyri"], "ven": ["sdb:4513", S1, "ven_apc||137643;ven_150578|Anzo\xE1tegui;ven_137630|Carabobo;ven_137631|Caracas;ven_lag||137644;ven_147082|Deportivo Rayo Zuliano;ven_tac||137634;ven_est||137636;ven_met||137639;ven_mon||137641;ven_137642|Portuguesa FC;ven_137645|Trujillanos;ven_ucv||141313;ven_zam||137646"], "crc": ["sdb:4815", S1, "crc_139703|Alajuelense;crc_car||139705;crc_139011|Deportivo Saprissa;crc_156436|Escorpiones De Bel\xE9n;crc_her||139105;crc_155931|Inter De San Carlos;crc_per||139707;crc_146464|Puntarenas;crc_sc||139010;crc_140122|Sporting San Jos\xE9"], "ind": ["sdb:4791", S1, "ind_139367|Bengaluru;ind_139372|Chennaiyin;ind_139435|Churchill Brothers;ind_eb||139439;ind_139371|Goa;ind_149412|Inter Kashi;ind_ker||139365;ind_139432|Mohun Bagan Super Giant;ind_mci||139373;ind_nor||139368;ind_139370|Odisha;ind_139436|Punjab;ind_139374|SC Delhi"], "chn": ["sdb:4359", S0, "chn_bei||134635;chn_che||139748;chn_149340|Chongqing Tonglianglong;chn_dal||149341;chn_hen||134637;chn_139747|Liaoning Tieren;chn_qin||145000;chn_qwc||145001;chn_shan||134648;chn_sha||134640;chn_shen||134644;chn_shp||141326;chn_tia||134646;chn_wuh||141328;chn_yun||149342;chn_134647|Zhejiang Professional"], "mas": ["sdb:4792", S1, "mas_139395|Dpmm;mas_152476|Imigresen;mas_jdt||139018;mas_156307|Kelantan Red Warrior;mas_klc||139324;mas_139346|Kuching City;mas_150506|Melaka;mas_neg||139342;mas_pen||139343;mas_139453|Sabah;mas_sel||139334;mas_ter||139325"], "vie": ["sdb:4803", S1, "vie_153180|B\u1EAFc Ninh;vie_142843|C\xF4ng An H\xE0 N\u1ED9i;vie_139502|C\xF4ng An H\u1ED3 Ch\xED Minh City;vie_139500|\u0110\xE0 N\u1EB5ng;vie_139496|H\xE0 N\u1ED9i;vie_hai||139503;vie_hag||139495;vie_hat||139504;vie_nam||139498;vie_142840|Ninh B\xECnh;vie_slna||139492;vie_thanh||139490;vie_139501|Th\u1EC3 C\xF4ng Viettel;vie_142835|Tr\u01B0\u1EDDng T\u01B0\u01A1i \u0110\u1ED3ng Nai"], "alg": ["sdb:4753", S1, "alg_aso||139276;alg_cra||139278;alg_156491|Cr T\xE9mouchent;alg_cs||139282;alg_147483|Es Ben Aknoun;alg_ess||139104;alg_156490|Js El Biar;alg_jsk||139092;alg_jss||139320;alg_146558|Khenchela;alg_152714|Mb Rouissat;alg_mca||139283;alg_mco||139279;alg_oak||149025;alg_usb||139272;alg_usm||139096"], "tun": ["sdb:4828", S1, "tun_147677|As Marsa;tun_cab||139863;tun_csa||139862;tun_139865|Cs Hammam Lif;tun_css||139866;tun_met||139867;tun_144134|Es Zarzis;tun_est||137650;tun_eta||138999;tun_144135|Hammam Sousse;tun_152591|Js El Omrane;tun_ols||140430;tun_156381|Sakiet Edda\xEFer;tun_sta||139869;tun_ben||139870;tun_ust||139871"], "gha": ["sdb:4974", S1, "gha_ade||141190;gha_kot||137741;gha_141191|Ashanti Gold;gha_bas||149204;gha_bec||141192;gha_ber||141193;gha_bib||144133;gha_156310|Debibi United;gha_dre||141194;gha_lio||147674;gha_hea||141199;gha_kar||141201;gha_med||141205;gha_156311|Port City FC;gha_sam||146903;gha_153203|Swedru All Blacks;gha_149203|Vision;gha_149202|Young Apostles"], "ken": ["sdb:4745", S1, "ken_156710|3k FC;ken_afc||139256;ken_146876|Aps Bomet;ken_ban||139248;ken_gor||139253;ken_kak||139255;ken_kcb||139250;ken_ken||144127;ken_149284|Mara Sugar;ken_mat||139247;ken_156711|Migori Youth;ken_156712|Mombasa United;ken_muran||147552;ken_153217|Nairobi United;ken_pos||139252;ken_shab||147553;ken_139254|Tusker;ken_ulinzi||139246"], "ang": ["sdb:5229", S1, "ang_alo||145300;ang_139099|Atl\xE9tico Petr\xF3leos;ang_bra||142432;ang_145303|Desportivo Hu\xEDla;ang_156680|FC Luanda;ang_int||143546;ang_kab||145304;ang_lun||145301;ang_pri||139097;ang_153310|Primeiro De Maio;ang_145306|Recreativo Da Ca\xE1la;ang_lib||145307;ang_sag||142433;ang_149370|S\xE3o Salvador;ang_wil||145310"], "por2": ["sdb:4662", S1, "por2_134118|Acad\xE9mica De Coimbra;por2_149021|Amarante;ave||147479;por2_ben||138860;por2_cha||135674;por2_138853|Farense;por2_fei||135675;por2_143710|Felgueiras;por2_lei||138858;por2_143711|Lusit\xE2nia Lourosa;por2_pen||134587;por2_ptm||136031;por2_138861|Porto B;por2_143719|Sporting Cp B;por2_ten||135502;por2_tor||143720;por2_uni||140355;por2_viz||140097"], "ned2": ["sdb:4641", S1, "ned2_alm||137996;ned2_den||133771;ned2_den2||134236;ned2_134550|Dordrecht;ned2_ein||137997;ned2_emm||136191;ned2_hel||137998;ned2_133766|Heracles Almelo;ned2_jaj||137999;ned2_jong||138000;ned2_jps||138001;ned2_138002|Jong Utrecht;ned2_mvv||138003;nac_n||133773;ned2_133765|Rkc Waalwijk;ned2_roda||133761;ned2_top||138005;ned2_vit||133770;vol_n||133867;ned2_vvv||136030"], "bra3": ["sdb:4625", S0, "ama||145394;bra3_ana||145388;bra3_148201|Barra;bra3_bot_pb||137813;bra3_bra||139155;bra3_cax||142265;bra3_con||138056;bra3_fer||142270;bra3_fig||134462;bra3_flo||141180;bra3_135886|Guarani;bra3_142245|Inter De Limeira;x5773_142254;bra3_ita||140108;bra3_147314|Maranh\xE3o;x5766_147148;pay||135671;bra3_134735|Santa Cruz;bra3_vol||138060;bra3_ypi||138057"], "arg2": ["https://www.afa.com.ar/agenda/posts/primera-nacional-fixture-para-la-temporada-2026", S0, "y4616a_137783;arg2_midland;arg2_atl||137776;arg2_qui||135169;y4616a_144738;arg2_col||143095;arg2_san||136197;y4616a_135682;y4616a_135153;arg2_alm||137787;arg2_agr||137769;y4616a_141013;y4616a_141015;arg2_tem||135176;y4616a_141012;arg2_nue||135167;arg2_cha||135899;y4616a_135174", "Primera Nacional \xB7 Zona B"], "tur2": ["sdb:4676", S1, "y4676_138941;ant||133799;tur2_ban||138970;y4676_146459;y4676_138974;tur2_boluspor||138939;y4676_133801;tur2_ese||146461;y4676_138983;y4676_147638;tur2_ist||134238;kay||133802;y4676_138955;y4676_149636;y4676_149661;tur2_pen||138957;y4676_138958;y4676_133806;tur2_\xFCmr||138935;tur2_van||138969"], "sco2": ["sdb:4395", S1, "sco2_arb||134251;sco2_ayr||134135;sco2_133648|Dunfermline Athletic;sco2_mor||134132;sco2_133641|Inverness Caledonian Thistle;sco2_liv||134133;sco2_par||134134;sco2_que||138105;sco2_ray||134793;sco2_134467|Stenhousemuir"], "wal": ["sdb:4472", S1, "wal_135902|Airbus Uk Broughton;wal_142529|Ammanford;wal_bar||136782;wal_bri||142383;wal_car||136783;wal_142384|Cambrian United;wal_136784|Cardiff Metropolitan University;wal_col||142385;wal_con||136786;wal_flint||140056;wal_hav||140057;wal_142391|Holywell Town;wal_136787|Llandudno;wal_pen||137486;wal_tns||134312;wal_142403|Trefelin Bgc"], "mlt": ["sdb:4653", S1, "mlt_bal||138135;mlt_bir||134035;mlt_155388|Bir\u017Cebbu\u0121a St. Peters;mlt_flo||134039;mlt_gzi||138134;mlt_ham||138133;mlt_hib||138132;mlt_mar||146569;mlt_mos||138131;mlt_sli||134795;mlt_val||134791;mlt_zab||148677"], "lva": ["sdb:4650", S0, "lva_145004|Auda Kekava;lva_dau||134049;lva_148160|Grobi\u0146as;lva_jel||147202;lva_lie||136122;lva_150146|Ogre United;lva_rfs||137985;lva_rig||137984;lva_spa||145005;lva_137987|Tukums"], "ltu": ["sdb:4651", S0, "ltu_137989|Banga Garg\u017Edai;ltu_137990|D\u017Eiugas Tel\u0161iai;ltu_heg||141007;ltu_kau||137992;ltu_pan||137993;ltu_rie||137991;ltu_145677|\u0160iauliai;ltu_sud||134048;ltu_148159|Transinvest Vilnius;ltu_134095|\u017Dalgiris Vilnius"], "est": ["sdb:4634", S0, "est_133967|Flora Tallinn;est_har||145273;est_kur||139044;est_134046|Levadia Tallinn;est_nar||134027;est_134060|N\xF5mme Kalju;est_141136|N\xF5mme United;est_pai||137975;est_137980|P\xE4rnu Vaprus;est_137976|Tartu Tammeka"], "geo": ["sdb:4638", S0, "geo_dil||133995;geo_din_bat||138043;geo_din||134385;geo_gag||141186;geo_iber||138046;geo_150495|Meshakhte Tkibuli;geo_134056|Rustavi;geo_140523|Samgurali Tskhaltubo;geo_spa||144994;geo_tor||134042"], "arm": ["sdb:4619", S1, "arm_ale||135672;arm_ara||137893;arm_ala||137892;arm_140688|Bkma;arm_137898|Gandzasar;arm_noa||137895;arm_137896|Pyunik Yerevan;arm_152593|Sardarapat;arm_137894|Shirak Gyumri;arm_147563|Syunik;arm_ura||137897;arm_van||140092"], "aze": ["sdb:4693", S1, "aze_ara||146883;aze_146881|\u0130mi\u015Fli;aze_kap||140696;aze_138337|Neft\xE7i Pfk;aze_qar||135702;aze_138335|Q\u0259b\u0259l\u0259;aze_138341|Sabah Baku;aze_sam||138336;aze_150689|\u015E\u0259fa;aze_sum||138339;aze_tur||140704;aze_138340|Zir\u0259"], "kaz": ["sdb:4649", S0, "kaz_akt||140520;kaz_144012|Altai \xD6skemen;kaz_ast||134342;kaz_ata||140521;kaz_138037|Caspiy Aktau;kaz_148411|Elimai Semey;kaz_134348|Irtysh Pavlodar;kaz_148412|Je\u0144is;kaz_134052|Jetysu Taldykorgan;kaz_134602|Kairat Almaty;kaz_138038|Kaisar Kyzylorda;kaz_138039|Kyzylzhar Petropavl;kaz_138040|Okzhetpes Kokshetau;kaz_134077|Ordabasy Shymkent;kaz_tob||138042;kaz_150755|Ulytau"], "uzb": ["sdb:4794", S0, "uzb_agmk||139379;uzb_and||139376;uzb_bun||139386;uzb_139380|Buxoro;uzb_din||139377;uzb_139384|Kokand 1912;uzb_lok||139387;uzb_139426|Mashal Mubarek;uzb_nas||139378;uzb_139383|Navbahor Namangan;uzb_nef||145007;uzb_pak||139020;uzb_139375|Qizilqum Zarafshon;uzb_139385|Sogdiana Jizzakh;uzb_139381|Surkhon Termez;uzb_150846|Xorazm Urganch"], "irn": ["sdb:4742", S1, "irn_alu||139172;irn_149162|Chadormalou Ardakan;irn_est||139012;irn_139184|Esteghlal Khuzestan;irn_139173|Fajr Sepasi Shiraz;irn_139165|Foolad Khuzestan;irn_139157|Gol Gohar Sirjan;irn_141318|Kheybar Khorramabad;irn_mal||139183;irn_144140|Mes Shahr E Babak;irn_nas||139158;irn_pay||139164;irn_per||139013;irn_139166|Sanat Naft;irn_sep||139014;irn_144143|Shams Azar Qazvin;irn_tra||139162;irn_zob||139159"], "irq": ["sdb:5056", S1, "irq_153177|Al Gharraf;irq_156678|Al Jolan;irq_kah||141843;irq_karkh||141844;irq_149361|Al Karma;irq_min||141845;irq_153176|Al Mosul;irq_141846|Al Naft;irq_qiw||141296;irq_shu||139016;irq_tal||141851;irq_zaw||140375;irq_149362|Diyala;irq_dho||147067;irq_erb||141853;irq_156679|Ghaz Al Shamal;irq_147068|Karbala;irq_141856|Naft Maysan;irq_new||143884;irq_zak||141857"], "jor": ["sdb:5055", S1, "jor_156692|Al Arabi Irbid;jor_142129|Al Baqaa;jor_139529|Al Faisaly Amman;jor_142130|Al Hussein Irbid;jor_139507|Al Jazeera Club;jor_ram||142132;jor_sal||141302;jor_wih||141297;jor_156693|Dougra;jor_shab||142136"], "kwt": ["sdb:4823", S1, "kwt_139876|Al Arabi SC;kwt_fah||140435;kwt_jah||140432;kwt_139877|Al Nasr SC;kwt_sal||139874;kwt_139873|Al Shabab Al Ahmadi;kwt_139878|Al Tadhamon;kwt_nas||139875;kwt_kuw||139510;kwt_139523|Qadsia"], "omn": ["sdb:5250", S1, "omn_145455|Al Musannah;omn_nah||145457;omn_141306|Al Nasr Salalah;omn_sea||141307;omn_149206|Al Shabab Seeb;omn_bah||145459;omn_dho||139526;omn_156922|Fanja;omn_ibr||149208;omn_oma||145462;omn_sah||145463;omn_152596|Samail;omn_sohar||145464;omn_sur||139527"], "sgp": ["sdb:4795", S1, "sgp_bal||139389;sgp_gey||139390;sgp_hou||139392;sgp_139391|Jurong;sgp_lio||139394;sgp_tam||139393;sgp_tan||139430;sgp_you||139388"], "hkg": ["sdb:4825", S1, "hkg_152989|Eastern District;hkg_139855|Eastern SC;hkg_144136|Hong Kong FC;hkg_139860|Hong Kong Rangers;hkg_kit||139515;hkg_kow||149229;hkg_lee||139858;hkg_nor||148166;hkg_156380|Shatin;hkg_sou||139854;hkg_tai||139516"], "phi": ["sdb:5708", S2, "phi_153527|Aguilas\u2013umak;phi_156942|Azkals Development Team;phi_147788|Cebu;phi_139520|Kaya\u2013iloilo;phi_153529|Maharlika;phi_152130|Manila Digger;phi_153531|Philippine Army;phi_sta||147789;phi_153532|Tuloy;phi_153533|Valenzuela Pb\u2013mendiola"], "nzl": ["sdb:5504", S1, "nzl_139100|Auckland City;nzl_151647|Auckland FC Reserves;nzl_aucu||150602;nzl_bir||149437;nzl_can||149441;nzl_139455|Eastern Suburbs;nzl_150618|Ferrymead Bays;nzl_150610|Miramar Rangers;nzl_149440|Wellington Olympic;nzl_139460|Wellington Phoenix Reserves;nzl_wsp||149442"], "chi2": ["sdb:4899", S0, "chi2_137739|Cobreloa;chi2_cur||137726;chi2_ant||137727;chi2_cop||140555;chi2_iqu||137728;chi2_140544|Deportes Puerto Montt;chi2_145089|Deportes Recoleta;chi2_140545|Deportes Santa Cruz;chi2_tem||140546;chi2_mag||140548;chi2_ran||140550;chi2_140551|San Luis De Quillota;chi2_uni||140552;chi2_san||137738;chi_uni||137733;chi2_140554|Uni\xF3n San Felipe"], "uru2": ["sdb:5072", S0, "uru2_ata||135362;uru2_141374|Cerrito;uru2_148162|Col\xF3n FC;uru2_135367|F\xE9nix;uru2_153853|Hurac\xE1n De Paso De La Arena;uru2_luz||145845;uru2_mir||145844;uru2_147196|Oriental De La Paz;uru2_152726|Paysand\xFA FC;uru_pla||136053;uru2_ova||135372;uru2_135373|River Plate Montevideo;uru2_tac||135376;uru2_uru||141808"], "col2": ["sdb:4951", S0, "col2_141059|Atl\xE9tico Cali;col2_141060|Barranquilla;col2_boc||141061;col2_141062|Bogot\xE1;col2_qui||141064;col_env||137612;col2_154525|Independiente Yumbo;col2_inp||141063;col2_141066|Itag\xFC\xED Leones;col2_orso||141068;col2_pat||137619;col2_rea||141069;col2_149050|Real Cundinamarca;col2_rsa||141070;col2_tig||141071;col2_139042|Uni\xF3n Magdalena"], "pan": ["sdb:4819", S0, "pan_139733|Alianza;pan_139736|Cd Universitario;pan_139738|Deportivo \xC1rabe Unido;pan_her||145085;pan_139108|Independiente De La Chorrera;pan_pla||139737;pan_sfc||139109;pan_cai||139739;pan_taur||139107;pan_umecit||147060;pan_154406|Uni\xF3n Cocl\xE9;pan_145086|Veraguas United"], "gua": ["sdb:4817", S1, "gua_139113|Antigua;gua_aur||152499;gua_coa||139723;gua_com||139006;gua_gua||139112;gua_mal||139725;gua_mar||148482;gua_mix||139727;gua_mun||139726;gua_155983|San Pedro Sacatep\xE9quez;gua_155982|Suchitep\xE9quez;gua_139730|Xelaj\xFA"], "hon": ["sdb:4818", S1, "hon_156273|Atl\xE9tico Independiente;hon_139008|Cd Olimpia;hon_cho||152546;hon_156274|Estrella Roja De Danl\xED;hon_147542|G\xE9nesis Polic\xEDa Nacional;hon_jua||149030;hon_139701|Lobos Upnfm;hon_mar||139106;hon_mot||139007;hon_146533|Olancho;hon_139697|Platense Puerto Cort\xE9s;hon_rea||139699"], "jam": ["sdb:5075", S1, "jam_ara||141863;jam_cav||141864;jam_dun||141865;jam_141866|Humble Lions;jam_mol||141867;jam_mbu||144757;jam_mou||141868;jam_147205|Phoenix Chapelton Maroons;jam_por||139009;jam_149293|Racing United;jam_tiv||141869;jam_153076|Treasure Beach;jam_157214|Tru Juice;jam_wat||139116"], "civ": ["sdb:5241", S1, "civ_157328|Adiak\xE9;civ_afa||145378;civ_asec||139744;civ_145380|Bouak\xE9;civ_152899|Es Agboville;civ_spe||142431;civ_152897|Isca;civ_145382|Korhogo;civ_152895|Mouna;civ_139743|Soa;civ_145384|Sol;civ_stad||146972;civ_145386|Stella Club Dadjam\xE9;civ_152900|Tchologo;civ_157329|Yamoussoukro;civ_152896|Zoman"], "sen": ["sdb:4754", S1, "sen_149365|Ajel Rufisque;sen_139294|Casa Sport;sen_140124|Dakar Sacr\xE9 C\u0153ur;sen_dio||139291;sen_157027|Essamaye;sen_gen||139286;sen_139295|Gor\xE9e;sen_144163|Gu\xE9diawaye;sen_hlm||149366;sen_jar||139287;sen_144162|La Lingu\xE8re;sen_149363|Ouakam;sen_pik||139292;sen_139288|Stade De Mbour;sen_139285|Teungueth;sen_wal||149368"], "cod": ["sdb:4955", S3, "cod_ran||141053;cod_153675|Anges Verts;cod_141045|Blessing Lualaba;cod_148177|Bukavu Dawa;cod_148178|C\xE9leste;cod_dau||141046;cod_141052|Dcmp Imana;cod_don||141047;cod_148179|Etoile De Kivu;cod_148180|FC Mk Etanch\xE9it\xE9;cod_154007|FC Renaissance Du Congo;cod_141048|Groupe Bazano;cod_141049|Les Aigles Du Congo;cod_141050|Lubumbashi Sport;cod_153670|Malole;cod_mak||141051;cod_153674|Manika;cod_153678|Martin P\xEAcheur;cod_153677|New Jak;cod_153671|New Soger;cod_141055|Oc Renaissance Du Congo;cod_141056|Saint \xC9loi Lupopo;cod_154008|Saint Luc;cod_san||141057;cod_141058|Simba Kolwezi;cod_153673|Tanganyika;cod_maz||138139;cod_153672|Tshikas;cod_153669|Tshinkunku;cod_148182|Us Panda B52;cod_139093|Vita Club"], "zam": ["sdb:5211", S1, "zam_156782|Chirundu United;zam_144727|Green Buffaloes;zam_gre||139755;zam_kab||143547;zam_kan||144733;zam_kon||144732;zam_146531|Maestro United Zambia;zam_156783|Makeni All Stars;zam_muf||147554;zam_147555|Mutondo Stars;zam_nap||142434;zam_146532|Nchanga Rangers;zam_nka||140647;zam_nkw||144729;zam_pow||144730;zam_red||143548;zam_156781|Roan United;zam_147556|Trident;zam_zan||143537;zam_zes||139098"], "blr": ["sdb:4622", S0, "blr_ars||139691;blr_141320|Baranovichi;blr_bat||133946;blr_137900|Belshina Bobruisk;blr_din||137902;blr_dne||139043;blr_137901|Dynamo Brest;blr_gom||134020;blr_137905|Isloch Minsk Raion;blr_142515|Maxline Vitebsk;blr_min||134393;blr_134094|Naftan Novopolotsk;blr_neman||134608;blr_slavia||137907;blr_137910|Torpedo Belaz Zhodino;blr_vit||137911"], "alb": ["sdb:4617", S1, "alb_140666|Dinamo City;alb_egn||140667;alb_147403|Elbasani;alb_lac||134349;alb_137799|Partizani Tirana;alb_133977|Sk\xEBnderbeu Kor\xE7\xEB;alb_134055|Teuta Durr\xEBs;alb_134037|Tirana;alb_137800|Vllaznia Shkod\xEBr;alb_140678|Vora"], "mkd": ["sdb:4652", S1, "mkd_152724|Arsimi;mkd_152725|Bashkimi;mkd_143483|Bregalnica \u0160tip;mkd_shk||134024;mkd_155729|Shk\xEBndija Hara\xE7in\xEB;mkd_sil||138073;mkd_143482|Skopje;mkd_str||138074;mkd_tik||143484;mkd_var||133979"], "bih": ["sdb:4624", S1, "bih_bor||137938;bih_147518|Bsk Banja Luka;bih_137944|\u010Celik Zenica;bih_134013|Fk Sarajevo;bih_rad||137940;bih_shi||134096;bih_slod||140761;bih_vel||137941;bih_137934|\u017Deljezni\u010Dar Sarajevo;bih_zri||134341"], "mne": ["sdb:4656", S1, "mne_arse||146385;mne_147438|Bokelj;mne_133983|Budu\u0107nost Podgorica;mne_dec||140118;mne_jez||140095;mne_147480|Mladost Donja Gorica;mne_mor||142321;mne_147440|Otrant Olympic;mne_pet||138078;mne_sut||134310"], "x4635": ["sdb:4635", S0, "x4635_140518;x4635_138053;x4635_133965;x4635_140519;x4635_134068;x4635_134336;x4635_138051;x4635_134065;x4635_138054;x4635_134026"], "x4618": ["sdb:4618", S1, "x4618_137790;x4618_137793;x4618_154392;x4618_146455;x4618_140684;x4618_134346;x4618_137792;x4618_137791;x4618_140126;x4618_154390"], "x4958": ["sdb:4958", S0, "x4958_141132;x4958_147100;x4958_141134;x4958_141133;x4958_139052;x4958_151524;x4958_154668;x4958_137978;x4958_141139;x4958_145272"], "x5676": ["sdb:5676", S0, "x5676_152583;x5676_142253;x5676_144967;x5676_150120;x5676_144958;x5676_154106;x5676_147153;x5676_152585"], "x5678": ["sdb:5678", S0, "x5678_152599;x5678_152600;x5678_154107;x5678_150127;x5678_152602;x5678_154162;x5678_144963;x5678_142300"], "x5685": ["sdb:5685", S0, "x5685_154127;x5685_154126;x5685_139997;x5685_150114;x5685_144960;x5685_142251;x5685_152610;x5685_142565;x5685_152612;x5685_152611"], "x5684": ["sdb:5684", S0, "x5684_142278;x5684_134293|Bahia;x5684_142268;x5684_150113;x5684_154109;x5684_137816;x5684_150122;x5684_142252;x5684_152607;x5684_134280|Vit\xF3ria"], "x5686": ["sdb:5686", S0, "x5686_152616;x5686_152615;x5686_154128;x5686_150125;x5686_144968;x5686_142286;x5686_142293;x5686_148214;x5686_152617;x5686_147154"], "x5762": ["sdb:5762", S0, "x5762_154481;x5762_136831;x5762_134748;x5762_148209;x5762_142299;x5762_144964;x5762_152636;x5762_152637;x5762_142267;x5762_154480"], "x5765": ["sdb:5765", S0, "x5765_154521;x5765_137813|Botafogo Pb;x5765_142256;x5765_154520;x5765_152648;x5765_147316;x5765_152649;x5765_152647;x5765_142274;x5765_137819"], "x5764": ["sdb:5764", S0, "x5764_147141;x5764_154483;x5764_152678;x5764_148202;x5764_152644;x5764_142297;x5764_135671|Paysandu;x5764_137818|Remo;x5764_152645;x5764_150129;x5764_154484;x5764_144975"], "x5766": ["sdb:5766", S0, "x5766_152653;x5766_134297|Athletico Paranaense;x5766_144970;x5766_142243;x5766_134298|Coritiba;x5766_142283;x5766_154527;x5766_154526;x5766_135664|Londrina;x5766_147148;x5766_136829;x5766_147312"], "x5769": ["sdb:5769", S0, "x5769_141179;x5769_152659;x5769_154532;x5769_144976;x5769_152661;x5769_147150;x5769_152660;x5769_154533"], "x5773": ["sdb:5773", S0, "x5773_152676;x5773_154129;x5773_138056|Confian\xE7a;x5773_154130;x5773_152679;x5773_147146;x5773_152677;x5773_142254;x5773_144965;x5773_142261"], "x5772": ["sdb:5772", S0, "x5772_152674;x5772_152671;x5772_142292;x5772_152672;x5772_145390;x5772_152675;x5772_152673;x5772_154531;x5772_142250"], "x5774": ["sdb:5774", S0, "x5774_142281;x5774_154537;x5774_154538;x5774_152686;x5774_144972;x5774_150128;x5774_152682;x5774_152685;x5774_147149;x5774_152683"], "x5775": ["sdb:5775", S0, "x5775_152688;x5775_152690;x5775_148203;x5775_154539;x5775_152689;x5775_142259;x5775_142276;x5775_150126"], "x4396": ["sdb:4396", S1, "x4396_134241;x4396_133630;x4396_133618;x4396_134189;x4396_136033;x4396_134376;x4396_134586;x4396_133620;x4396_133932;lei||133626;x4396_134367;eng2_lut||133888;x4396_134381;x4396_134371;x4396_134373;eng2_oxf||134361;x4396_133631;eng2_ply||133836;x4396_133633;eng2_shw||133837;x4396_134378;x4396_134258;x4396_133607;x4396_134382"], "x4397": ["sdb:4397", S1, "x4397_134368;x4397_134402;x4397_134358;x4397_134362;x4397_134366;x4397_133874;x4397_134363;x4397_134218;x4397_134365;x4397_134374;x4397_134230;x4397_134250;x4397_134357;x4397_134370;x4397_134185;x4397_134375;x4397_134364;x4397_134231;x4397_135958;x4397_134377;x4397_134379;x4397_134267;x4397_134240;x4397_134383"], "x5086": ["sdb:5086", S1, "x5086_138250;x5086_135456;x5086_137764;x5086_137760;x5086_142543;x5086_135888;x5086_147597;x5086_150519;x5086_134702;x5086_137761;esp2_mir||134698;x5086_134697;x5086_137822;x5086_137827;x5086_144214;x5086_138243;x5086_137591;x5086_150250;x5086_137758;x5086_137745"], "x5087": ["sdb:5087", S1, "x5087_138162;x5087_144212;x5087_150365;x5087_144988;x5087_144210;x5087_140490;x5087_137824;x5087_138244;x5087_149456;x5087_144219;x5087_142535;x5087_142538;x5087_137804;x5087_140528;x5087_137746;x5087_144221;x5087_137845;x5087_137753"], "x4398": ["sdb:4398", S1, "x4398_143032;ita2_bar||133688;x4398_134686;x4398_140300;x4398_134680;x4398_133671;x4398_137258;ita2_cos||134253;x4398_133693;x4398_134682;x4398_143046;x4398_152840;x4398_135956;x4398_137451;x4398_137257;ita2_sas||133846;x4398_134687;x4398_149264;x4398_143030;x4398_143039"], "x4645": ["sdb:4645", S1, "x4645_142934;x4645_143897;x4645_142938;x4645_149242;x4645_142972;x4645_142973;x4645_142976;x4645_149233;x4645_134657;x4645_134260;x4645_134675;x4645_134658;x4645_140292;x4645_146937;x4645_156652;x4645_153110;x4645_143888;x4645_146931"], "x4639": ["sdb:4639", S1, "x4639_134210;x4639_133877;ger2_dus||133935;x4639_138402;ger2_ros||133876;x4639_138375;x4639_138365;x4639_134694;x4639_136026;x4639_137963;ger2_mst||137965;x4639_138400;x4639_138410;x4639_137958;x4639_140052;x4639_138399;x4639_137961;x4639_137962;x4639_137111;x4639_135656"], "x4637": ["sdb:4637", S1, "fra2_ame||135658;x4637_142640;fra2_bas||133933;x4637_135466;x4637_134787;x4637_140033;x4637_138459;x4637_142604;x4637_138458;x4637_134712;x4637_146312;x4637_135890;x4637_138067;x4637_147875;x4637_133706;x4637_137672;x4637_144769;x4637_138823"], "x5203": ["sdb:5203", S1, "x5203_143583;x5203_143582;x5203_146758;x5203_148672;x5203_143580;x5203_149044;x5203_143579;x5203_143581;x5203_143575;x5203_156150;x5203_149045;x5203_156151"], "x5216": ["sdb:5216", S1, "x5216_147546;x5216_143708;x5216_143709;x5216_144723;x5216_150018;x5216_150021;por2_maf||138854;x5216_149998;por2_oli||138859;x5216_146666;por2_pfe||134111;x5216_144724;x5216_143718;x5216_138855;x5216_142466;x5216_143721;x5216_138857;x5216_147544;x5216_143722;x5216_153019"], "x5745": ["sdb:5745", S1, "x5745_143707;x5745_149982;x5745_149983;x5745_153009;x5745_153710;x5745_150985;x5745_150092;x5745_143712;x5745_149986;x5745_156364;x5745_149988;x5745_149989;x5745_153016;x5745_150095"], "x5215": ["sdb:5215", S0, "x5215_147063;x5215_143094;x5215_135152;x5215_137780;x5215_142501;x5215_143089;x5215_143092;x5215_142497;x5215_143097;x5215_142495;x5215_149542;x5215_143086;x5215_144740;x5215_140806;x5215_142505;x5215_142492;x5215_149540;x5215_150259;x5215_142478;x5215_143090;x5215_137785;x5215_142503"], "x4623": ["sdb:4623", S1, "beer||138142;x4623_140110;den||133863;x4623_133825;x4623_147429;x4623_146375;x4623_152466;x4623_140109;x4623_133785;x4623_147430;x4623_143872;x4623_146374;x4623_140081;x4623_154878;x4623_138140"], "x4669": ["sdb:4669", S1, "sco2_air||137821;x4669_134252;x4669_138100;x4669_134466;x4669_141804;x4669_133812;x4669_137823;x4669_134632;x4669_134305;ros_c||133940"], "x4670": ["sdb:4670", S1, "x4670_138099;x4670_134137;x4670_134130;x4670_138101;x4670_138102;x4670_134468;x4670_140311;x4670_138104;x4670_134220;x4670_142339"], "x5868": ["sdb:5868", S1, "x5868_149643;x5868_138976;x5868_149665;x5868_149646;x5868_146460;x5868_149641;x5868_153067;x5868_156259;x5868_153065;x5868_149642;x5868_153064;x5868_149640;x5868_149635;x5868_143381;x5868_149622;x5868_149626;x5868_149682;x5868_138956"], "x5869": ["sdb:5869", S1, "x5869_156260;x5869_149630;x5869_134254;x5869_149621;x5869_134590;x5869_156261;x5869_143377;x5869_149633;x5869_153070;x5869_149634;x5869_133793;x5869_138965;x5869_149662;x5869_146012;x5869_149212;x5869_149627;x5869_149664;x5869_138979"], "x4654": ["sdb:4654", S1, "x4654_146383;x4654_138825;x4654_146384;x4654_134190;x4654_139994;x4654_138902;x4654_156155;x4654_135739;x4654_138897;x4654_134622;x4654_138898;x4654_156156;x4654_140345;x4654_140344;x4654_140346;x4654_138900"], "x5206": ["sdb:5206", S1, "x5206_143068;x5206_156328;x5206_143073;x5206_143074;x5206_143076;x5206_143075;x5206_143069;x5206_143077;x5206_143079;x5206_143080;x5206_143081;x5206_143082;x5206_143070;x5206_143071;x5206_143083;x5206_143084;x5206_143072;x5206_143085"], "x4824": ["sdb:4824", S1, "nii||139881;x4824_140509;x4824_141249;x4824_141245;x4824_137706;x4824_144685;jpn_jub||139887;x4824_141251;x4824_139892;x4824_137711;x4824_139893;x4824_137712;shonan||137715;x4824_141254;x4824_150222;x4824_139898;x4824_141255;x4824_137718;x4824_139900;x4824_137720"], "x4967": ["sdb:4967", S1, "x4967_139883;x4967_139904;x4967_147070;x4967_139895;x4967_141246;x4967_141247;x4967_139885;x4967_139903;x4967_141250;x4967_150223;x4967_139890;x4967_141252;x4967_147069;x4967_150625;x4967_139894;x4967_141253;x4967_140510;x4967_139897;x4967_139896;x4967_139902"], "x5481": ["sdb:5481", S0, "x5481_149468;x5481_149463;x5481_149465;x5481_148529;x5481_148532;x5481_148530;x5481_148531;x5481_155066;x5481_148533;x5481_148534;x5481_148535;x5481_149474;chi2_smo||140553;x5481_148537"], "x4957": ["sdb:4957", S0, "x4957_151314;x4957_140793;x4957_154969|Atl\xE9tico FC;x4957_152286;x4957_141121;x4957_152289;ecu_nac||138222;x4957_141123;x4957_141126;x4957_138226;x4957_149503;x4957_147318"], "x5073": ["sdb:5073", S0, "x5073_138316;x5073_149505;x5073_138312;x5073_138314;x5073_150362;x5073_138317;x5073_147332;x5073_138315;x5073_138321;x5073_155111;x5073_139427;x5073_141816;x5073_155110;x5073_139428;x5073_155112;x5073_138328;x5073_138327"], "x4640": ["sdb:4640", S1, "x4640_135709;x4640_144144;x4640_138095;x4640_149283;gre_ath||134228;x4640_153174;x4640_153175;x4640_153173;x4640_134629;x4640_144156;x4640_133747;gre_pan||133832;x4640_133872;x4640_144157;x4640_155053;x4640_144149"], "x4796": ["sdb:4796", S1, "x4796_134008;x4796_146511;aut_blw||139412;x4796_139416;x4796_140368;x4796_139414;x4796_146473;x4796_139413;x4796_140290;x4796_146509;x4796_134607;x4796_139417;x4796_146373;x4796_147514;x4796_139423;x4796_139418"], "x4713": ["sdb:4713", S1, "sui_aar||138985;x4713_146549;x4713_138991;x4713_137868;x4713_146551;x4713_138986;x4713_146553;x4713_138988;sui_win||138984;x4713_141840"], "x5319": ["sdb:5319", S1, "x5319_156095;x5319_146542;x5319_146543;sui_bel||140612;x5319_146544;x5319_146545;x5319_146546;x5319_146547;x5319_146548;x5319_148679;x5319_152463;x5319_147488;x5319_146550;x5319_147489;x5319_138989;x5319_146555;x5319_146554;x5319_146556"], "x4632": ["sdb:4632", S1, "x4632_141779;x4632_138450;x4632_141780;x4632_138453;x4632_141781;x4632_141783;x4632_139045;x4632_138454;x4632_138452;x4632_138455;x4632_138456;x4632_143407"], "x5202": ["sdb:5202", S1, "x5202_143498;x5202_156163;x5202_143491;x5202_156164;x5202_143492;x5202_143495;x5202_143494;x5202_156162;x5202_143496;x5202_146468"], "x4403": ["sdb:4403", S0, "x4403_136118;x4403_134483;x4403_133951;x4403_134722;x4403_134719;x4403_135855;x4403_134165;x4403_138270;x4403_134482;x4403_134171;x4403_134732;x4403_138260;x4403_134729;x4403_147057;x4403_134730;swe_var||134726"], "x5209": ["sdb:5209", S0, "x5209_143519;x5209_143509;x5209_144984;x5209_143512;x5209_143513;x5209_143520;x5209_143515;x5209_150703;x5209_147705;x5209_143510;x5209_143511;x5209_147706;x5209_143518;x5209_143517"], "x4457": ["sdb:4457", S0, "x4457_135718;x4457_134750;x4457_147882;nor_hau||134572;x4457_134755;x4457_135724;x4457_140041;x4457_147094;nor_odd||134573;x4457_134759;x4457_135722;x4457_134565;x4457_134563;x4457_134054;x4457_134760;nor_str||134564"], "x5208": ["sdb:5208", S0, "x5208_154680;x5208_154681;x5208_144944;x5208_154682;x5208_154683;x5208_143499;x5208_143506;x5208_154684;x5208_144943;x5208_143507;x5208_143504;x5208_143500"], "x4666": ["sdb:4666", S1, "x4666_134553;x4666_143102;x4666_141797;x4666_143111;x4666_138154;x4666_138153;x4666_138155;x4666_138156;x4666_135909;rus_sochi||136859;x4666_146520;x4666_138158;x4666_134554;x4666_134556;x4666_134439;x4666_140085;x4666_143124;x4666_136255"], "x5217": ["sdb:5217", S0, "x5217_149496;x5217_147447;x5217_155225;x5217_143106;x5217_149499;x5217_155210;x5217_149497;x5217_155224;x5217_149498;x5217_153430;x5217_149495;x5217_147448;x5217_134431;x5217_155226;x5217_143100;x5217_155223"], "x4677": ["sdb:4677", S1, "x4677_138438;x4677_146858;x4677_146859;x4677_138443;x4677_156161;x4677_156158;x4677_156159;x4677_142825;x4677_140179;ukr_ole||135483;x4677_156160;x4677_146861;x4677_152563;x4677_138448;x4677_149226;x4677_147626"], "x4628": ["sdb:4628", S0, "chn_cha||134639;x4628_149555;x4628_146691;x4628_149553;x4628_149550;x4628_139003;chn_mei||139000;x4628_141325;x4628_139004;x4628_146357;x4628_139002;x4628_149549;x4628_144999;x4628_141327;x4628_146693;x4628_146694"], "x5310": ["sdb:5310", S0, "x5310_141322;x5310_150187;x5310_150601;x5310_155115;x5310_155116;x5310_146699;x5310_150598;x5310_150599;x5310_150597;x5310_149548;x5310_146688;x5310_141323;x5310_149554;x5310_146698;x5310_146690;x5310_149551;x5310_149552;x5310_150190;x5310_149556;x5310_150596;x5310_146700;x5310_146695;x5310_150600;x5310_155114"], "x4620": ["sdb:4620", S0, "x4620_134599;x4620_155250;x4620_134593;x4620_155251;x4620_134798;x4620_155252;x4620_134594;x4620_134595;x4620_145083;x4620_150512;x4620_134598"], "x5010": ["sdb:5010", S0, "x5010_141675;x5010_150205;x5010_141676;x5010_141677;x5010_144722;x5010_141678;x5010_154897;x5010_141681;x5010_141682;x5010_141679;x5010_141683;x5010_141684"], "x4661": ["sdb:4661", S1, "x4661_135660;x4661_135495;x4661_138910;x4661_135299;x4661_137112;x4661_136190;x4661_138912;x4661_135301;x4661_152461;x4661_148483;x4661_152460;x4661_140531;x4661_138913;x4661_134016;x4661_138905;x4661_146387;x4661_153542;x4661_138906"], "x5709": ["sdb:5709", S1, "x5709_154327;x5709_138908;x5709_138917;x5709_135295;x5709_153534;x5709_154302;x5709_154240;x5709_138909;x5709_153537;x5709_153538;x5709_140096;x5709_136028;x5709_153540;x5709_153539;x5709_143922;x5709_153541;x5709_134612;x5709_140167"], "x4954": ["sdb:4954", S1, "x4954_155478;x4954_148503;x4954_136682;x4954_147434;cze_kar||136679;x4954_155433;x4954_137809;x4954_136678;x4954_141111;x4954_146409;x4954_141113;x4954_141114;x4954_141115;x4954_141117;x4954_141118;x4954_141119"], "x5878": ["sdb:5878", S1, "x5878_155463;x5878_155468;x5878_156011;x5878_155436;x5878_155437;x5878_137808;x5878_155432;x5878_155469;x5878_155466;x5878_155435;x5878_155439;x5878_156013;x5878_155470;x5878_155471;x5878_141795;x5878_155434"], "x4952": ["sdb:4952", S1, "x4952_141073;hrv_cib||141074;x4952_141075;x4952_141076;x4952_141077;x4952_141078;x4952_152518;x4952_155952;x4952_152519;x4952_141081;x4952_155953;x4952_141083;x4952_141084;x4952_155951;x4952_141087;x4952_146467"], "x5910": ["sdb:5910", S1, "x5910_155985;x5910_155986;x5910_155987;x5910_140105;x5910_155988;x5910_146377;x5910_144015;x5910_155990;x5910_155991;x5910_141088;x5910_155992;x5910_155993;x5910_155994;x5910_155995"], "x4965": ["sdb:4965", S1, "x4965_141215;x4965_147620;x4965_141218;hun_dio||134611;hun_fev||134003;x4965_141221;x4965_152526;x4965_141222;x4965_142854;x4965_146466;x4965_138181;x4965_155337;x4965_141226;x4965_141227;x4965_141228;x4965_142853"], "x4665": ["sdb:4665", S1, "x4665_143179;x4665_149580;x4665_152632;x4665_149582;x4665_154554;x4665_138195;x4665_138921;x4665_152475;x4665_143176;x4665_146566;x4665_152474;x4665_152631;x4665_138931;x4665_149581;x4665_152630;x4665_138194;x4665_154596;x4665_154641;x4665_138920;x4665_140129;x4665_154615;x4665_138927;x4665_140131"], "x5821": ["sdb:5821", S1, "x5821_154563;x5821_140127;x5821_156886;x5821_147628;x5821_154559;x5821_154565;x5821_154564;x5821_154560;x5821_156887;x5821_154567;x5821_154562;x5821_154555"], "x4913": ["sdb:4913", S1, "bul_ber||134351;x4913_147433;x4913_148492;x4913_140765;x4913_137917;x4913_148491;x4913_140766;x4913_140768;x4913_140770;x4913_142830;bul_mon||140035;x4913_148490;x4913_140773;x4913_156096;x4913_146406;x4913_140776;x4913_152573;x4913_140778"], "x5074": ["sdb:5074", S1, "x5074_155943;x5074_134079;x5074_152530;x5074_141831;x5074_137863;x5074_147655;x5074_141834;x5074_140067;x5074_155942;x5074_137861;x5074_147657;srb_spk||137859;x5074_155944;srb_tsc||137856;srb_voz||137857;x5074_146379"], "x4657": ["sdb:4657", S1, "x4657_138850;x4657_138851;mar_scc||136418;x4657_138845;x4657_138843;x4657_138849;x4657_136406;mar_mco||136416;mar_ocs||137427;x4657_138841;x4657_136411;x4657_140802;x4657_153102;x4657_143784;x4657_138840;x4657_149360"], "x4741": ["sdb:4741", S1, "x4741_149382;x4741_149383;x4741_152971;x4741_156885;irn_hav||141317;x4741_149384;x4741_139171;irn_mes||139181;x4741_149386;x4741_149380;x4741_139161;x4741_139176;x4741_139156;x4741_139160;x4741_146878;x4741_152972"], "x4797": ["sdb:4797", S3, "x4797_139431;x4797_151727;x4797_148043;x4797_151728;x4797_139433;x4797_139807|Mohammedan;x4797_149413;x4797_144706;x4797_139440;x4797_149414;x4797_144707"], "x4821": ["sdb:4821", S3, "x4821_139813;x4821_149415;x4821_155258;x4821_155259;x4821_139434;x4821_148045;x4821_148046;x4821_140356;x4821_148047"], "x5214": ["sdb:5214", S2, "x5214_149374;x5214_139491;x5214_142842;x5214_142836;x5214_156676;x5214_142833;x5214_156677;x5214_142838;x5214_142839;x5214_153181;x5214_140658;x5214_156675;x5214_153179;x5214_153178"], "x4789": ["sdb:4789", S4, "x4789_140800;x4789_139345;x4789_139328;x4789_139326;x4789_139339;x4789_140114;x4789_139340;x4789_139344"], "x4966": ["sdb:4966", S1, "x4966_135991;x4966_134009;x4966_141233;x4966_136025;x4966_135996;x4966_141236;x4966_152496;x4966_135997;x4966_141240;x4966_152495;x4966_141242;x4966_141243;x4966_141801;x4966_145953;x4966_146402;x4966_155950"], "x5314": ["sdb:5314", S1, "x5314_152528;x5314_156009;x5314_147486;x5314_146625;x5314_134029;x5314_146306;x5314_137870;x5314_146628;x5314_146631;x5314_146633;x5314_156008;x5314_141802;x5314_146635;x5314_137873;x5314_146627;x5314_149032"], "x5313": ["sdb:5313", S1, "x5313_146612;x5313_146613;x5313_146614;x5313_151201;x5313_147443;x5313_151293;x5313_146619;x5313_146616;x5313_151188;x5313_143604;x5313_146620;svn_pri||146622;x5313_138218;x5313_148596;x5313_138216;x5313_138215"], "x4963": ["sdb:4963", S0, "x4963_150691;x4963_148385;x4963_134053;x4963_137877;x4963_149014;x4963_149015;x4963_149016;x4963_134606;x4963_147086;x4963_144686;x4963_148386;x4963_150696"], "x5474": ["sdb:5474", S0, "x5474_141148;fin_hak||139982;x5474_145257;x5474_141150;x5474_147085;x5474_141151;x5474_140516;x5474_141152;x5474_141154;x5474_145259"], "x4906": ["sdb:4906", S0, "x4906_147885;x4906_140779;x4906_137968;x4906_137969;x4906_139968;x4906_137971;x4906_150524;x4906_147883;x4906_140783;x4906_147055;isl_ves||140785;x4906_140787"], "x5885": ["sdb:5885", S0, "x5885_147884;x5885_139969;x5885_155578;x5885_155582;x5885_155577;x5885_155580;x5885_155581;x5885_155579;x5885_155583;x5885_140784;x5885_140786;x5885_144759"], "x4757": ["sdb:4757", S0, "x4757_139303;x4757_139306;x4757_139302;irl_cor||138031;x4757_138032;x4757_147296;x4757_139309;x4757_141165;x4757_139319;x4757_139304"], "x5659": ["sdb:5659", S0, "x5659_152513;x5659_137628;x5659_154940;x5659_152512;x5659_154941;x5659_152514;x5659_152536;x5659_137633;x5659_151955;x5659_152537;x5659_151956;x5659_137640;x5659_152538;x5659_152516;x5659_152535;x5659_138813;x5659_154942"], "x4590": ["sdb:4590", S1, "x4590_135977;x4590_134401;x4590_135959;x4590_136000;x4590_135968;x4590_137701;x4590_134360;x4590_135963;x4590_135901;x4590_134765;x4590_134486;x4590_137534;x4590_134372;x4590_137950;x4590_134448;x4590_133810;x4590_136002;x4590_134209;x4590_136003;x4590_140380;x4590_135975;x4590_135999;x4590_137956;x4590_134300"], "x4695": ["sdb:4695", S1, "x4695_139975;x4695_142323;x4695_138373;x4695_147612;x4695_138372;x4695_138355;x4695_138356;x4695_138381;x4695_138378;x4695_146314;x4695_138370;x4695_138376;x4695_140024;x4695_152574;x4695_138357;x4695_140216;x4695_138371;x4695_138353"], "x4746": ["sdb:4746", S1, "x4746_138409;x4746_146315;x4746_152578;x4746_138404;x4746_138361;x4746_138360;x4746_147415;x4746_155848;x4746_138359;x4746_147615;x4746_138398;x4746_138401;x4746_138362;x4746_138403;x4746_152577;x4746_139260;x4746_155857;x4746_140049"], "x5320": ["sdb:5320", S1, "x5320_147562;x5320_138820;x5320_137651;x5320_142599;x5320_134718;x5320_147876;x5320_147565;x5320_138827;x5320_142605;x5320_142576;x5320_154093;x5320_142590;x5320_152580;x5320_146356;x5320_146347;x5320_146352", "National 1 \xB7 Grupo A"], "y5340": ["sdb:5340", S1, "y5340_134785;y5340_143905;y5340_137256;y5340_143906;ita2_cit||133692;y5340_142971;y5340_143901;y5340_142940;y5340_134651;y5340_137120;y5340_137116;y5340_134652;y5340_133673;y5340_149237;y5340_137118;y5340_133972;y5340_134653;y5340_143532;y5340_133860;y5340_152839"], "y5339": ["sdb:5339", S1, "y5339_147679;y5339_143005;y5339_134671;y5339_138167;y5339_133698;y5339_142983;y5339_134404;y5339_133694;y5339_143023;y5339_134233;y5339_133685;y5339_137117;y5339_140303;y5339_133880;ita2_reg||137121;y5339_135736;ita2_spe||133879;y5339_134656;y5339_142931;y5339_137253"], "y5088": ["sdb:5088", S1, "y5088_144249;y5088_134699;y5088_138306;y5088_144237;y5088_137820;y5088_137446;y5088_144229;y5088_134211;y5088_133815;esp2_hue||135454;y5088_137748;y5088_146798;y5088_136249;y5088_137763;y5088_134485;y5088_133878;esp2_zar||133737;y5088_144942;y5088_142536;y5088_134488"], "y5089": ["sdb:5089", S1, "y5089_146791;y5089_147599;y5089_134487;y5089_150476;y5089_137747;y5089_138279;y5089_149216;y5089_146800;y5089_144226;y5089_138281;y5089_138246;y5089_144220;y5089_150225;y5089_140495;y5089_142539;y5089_138245;y5089_144227;y5089_146803"], "y5090": ["sdb:5090", S1, "y5090_140497;y5090_137843;y5090_150098;y5090_150336;y5090_150429;y5090_149458;y5090_144986;y5090_144244;y5090_138284;y5090_140502;y5090_146799;y5090_137755;y5090_137844;y5090_140505;y5090_150297;y5090_135679;y5090_138282;y5090_137749"], "y5091": ["sdb:5091", S1, "y5091_147603;y5091_150400;y5091_138303;y5091_137750;y5091_140503;y5091_142540;y5091_138304;y5091_147605;y5091_137849;y5091_140501;y5091_137754;y5091_150387;y5091_150399;y5091_133855;y5091_135678;y5091_137756;y5091_149459;y5091_133842"], "y5092": ["sdb:5092", S1, "y5092_150349;y5092_150019;y5092_153127;y5092_146792;y5092_150367;y5092_144250;y5092_144987;y5092_137848;y5092_142537;y5092_146797|Guadalajara;y5092_140504;y5092_133856;y5092_149455;y5092_149462;y5092_138247;y5092_138249;y5092_137757;y5092_138305"], "y5747": ["sdb:5747", S1, "y5747_153725;y5747_150004;y5747_144669;y5747_153036;y5747_153022;y5747_150007;y5747_153017;y5747_153040;y5747_156366;y5747_150008;y5747_143713;y5747_150005;y5747_150010;y5747_150976"], "y5279a": ["sdb:5279", S0, "y5279a_138865;y5279b_147304;y5279b_148111;y5279a_143566;y5279b_148112;y5279b_145855;y5279b_145857;y5279b_154528;y5279b_147305;y5279b_145858;y5279b_145859;y5279b_147306;y5279a_142162;y5279b_147307;y5279b_145860;y5279a_142163;y5279b_145861;y5279a_138868;y5279a_142164;y5279a_145852;y5279a_138894;y5279a_138879;y5279a_138890;y5279b_145862;y5279a_138869;y5279b_145856;y5279a_138866;y5279a_142156;y5279a_138887;y5279a_145854", "MLS Next Pro"], "y4822": ["sdb:4822", S0, "kor_ase||139782;kor_bus||138106;kor_cheo||147077;y4822_147078;y4822_139784;kor_dae||138107;y4822_152158;y4822_144995;y4822_139079;y4822_150531;y4822_139787;y4822_152161;kor_seon||138114;y4822_139788;kor_suw||139789;y4822_138116;y4822_154522"], "y4910": ["sdb:4910", S0, "y4910_156798;y4910_156793;y4910_156790;y4910_153061;y4910_149588;y4910_140712;y4910_156797;y4910_140714;y4910_153376;y4910_156791;y4910_153162;y4910_156792;y4910_153057;y4910_156794;y4910_140721;y4910_153056;y4910_156796;y4910_153058;y4910_146969;y4910_144996;y4910_149587;y4910_156795;y4910_146961"], "y5538": ["sdb:5538", S1, "y5538_150246;y5538_156499;y5538_144211;y5538_150247;y5538_153120;y5538_152233;y5538_150255;y5538_153119;y5538_150251;y5538_149134;y5538_156500;y5538_155954;y5538_156501;y5538_147598;y5538_150226;y5538_150252;y5538_150253;y5538_150254"], "y5539": ["sdb:5539", S1, "y5539_156502;y5539_149512;y5539_150260;y5539_150262;y5539_144213;y5539_150263;y5539_150264;y5539_140491;y5539_152467;y5539_150265;y5539_137833;y5539_140492;y5539_152234;y5539_150270;y5539_150267;y5539_150272;y5539_152236;y5539_137803"], "y5540": ["sdb:5540", S1, "y5540_150273;y5540_150274;y5540_150284;y5540_150275;y5540_150276;y5540_144228;y5540_137759;y5540_150278;y5540_140493;y5540_156497;y5540_150279;y5540_150280;y5540_149527;y5540_156071;y5540_150282;y5540_144222;y5540_156072;y5540_150283"], "y5541": ["sdb:5541", S1, "y5541_156073;y5541_150313;y5541_149513;y5541_146793;y5541_150304;y5541_150288;y5541_150305;y5541_150290;y5541_156503;y5541_150307;y5541_137850;y5541_150309;y5541_144223;y5541_156504;y5541_150310;y5541_150315;y5541_156074;y5541_150311"], "y5542": ["sdb:5542", S1, "y5542_150324;y5542_150316;y5542_150291;y5542_144231;y5542_138285;y5542_150317;y5542_150318;y5542_140499;y5542_156505;y5542_150319;y5542_142554;y5542_150320;y5542_156498;y5542_150321;y5542_156506;y5542_150322;y5542_153125|Vilanova;y5542_150323"], "y5543": ["sdb:5543", S1, "y5543_156507;y5543_150335;y5543_138276;y5543_146802;y5543_140498;y5543_142559;y5543_150342;y5543_156508;y5543_149510;y5543_152468;y5543_150337;y5543_150340;y5543_150090;y5543_147602;y5543_156509;y5543_150341;y5543_150343;y5543_150134"], "y5544": ["sdb:5544", S1, "y5544_150358;y5544_149461;y5544_137751;y5544_150352;y5544_137846;y5544_144215;y5544_150344;y5544_144216;y5544_149523;y5544_152469;y5544_156510;y5544_150293;y5544_156511;y5544_153129;y5544_153130;y5544_150354;y5544_150356;y5544_144217"], "y5545": ["sdb:5545", S1, "y5545_150364;y5545_147596;y5545_150366;y5545_150374;y5545_144224;y5545_156512;y5545_142556;y5545_144218;y5545_137851;y5545_150516;y5545_150369;y5545_150294;y5545_150371;y5545_156513;y5545_150372;y5545_156514;y5545_153131;y5545_150373"], "y5546": ["sdb:5546", S1, "y5546_152471;y5546_144940;y5546_150378;y5546_156515;y5546_150379;y5546_144247;y5546_150381;y5546_156516;y5546_153132;y5546_150380;y5546_150383;y5546_150384;y5546_150385;y5546_137847;y5546_150388;y5546_138308;y5546_150390;y5546_149525"], "y5547": ["sdb:5547", S1, "y5547_150401;y5547_150393;y5547_138302;y5547_150295;y5547_149516;y5547_150395;y5547_150036;y5547_153134;y5547_156518;y5547_138288;y5547_150020;y5547_156519;y5547_156517;y5547_144238;y5547_150101;y5547_142563;y5547_146804;y5547_144239"], "y5548": ["sdb:5548", S1, "y5548_150402;y5548_144230;y5548_156520;y5548_150403;y5548_142547;y5548_150405;y5548_144232;y5548_142541;y5548_152477;y5548_150407;y5548_150408;y5548_150409;y5548_150414;y5548_150416;y5548_150410;y5548_150415;y5548_150412;y5548_156521"], "y5549": ["sdb:5549", S1, "y5549_156522;y5549_155113;y5549_150424;y5549_153480;y5549_149511;y5549_152479;y5549_150425;y5549_140508;y5549_144235;y5549_144240;y5549_149522;y5549_150422;y5549_150421;y5549_144241;y5549_153482;y5549_149460;y5549_150423;y5549_156523"], "y5550": ["sdb:5550", S1, "y5550_150298;y5550_150427;y5550_156525;y5550_142542;y5550_153137;y5550_150435;y5550_156526;y5550_146794;y5550_157242;y5550_150430;y5550_153366;y5550_152481;y5550_150436;y5550_152482;y5550_156528;y5550_150437;y5550_150296;y5550_150434"], "y5551": ["sdb:5551", S1, "y5551_150439;y5551_150440;y5551_153139;y5551_150442;y5551_149518;y5551_156540;y5551_150443;y5551_150444;y5551_147610;y5551_144242;y5551_150445;y5551_156541;y5551_150449;y5551_156542;y5551_150450;y5551_150448;y5551_140507;y5551_156543"], "y5552": ["sdb:5552", S1, "y5552_142544;y5552_153140;y5552_152484;y5552_150451;y5552_150452;y5552_150453;y5552_142549;y5552_146795;y5552_149508;y5552_156544;y5552_156545;y5552_150455;y5552_138248;y5552_140494;y5552_150456;y5552_150038;y5552_150457;y5552_147600"], "y5553": ["sdb:5553", S1, "y5553_150470;y5553_146790;y5553_149457;y5553_150461;y5553_150462;y5553_138242;y5553_156546;y5553_150463;y5553_156547;y5553_150464;y5553_137744;y5553_150465;y5553_150466;y5553_152486;y5553_150468;y5553_153142;y5553_142545;y5553_150472"], "y5554": ["sdb:5554", S1, "y5554_150473;y5554_150482;y5554_150133;y5554_150474;y5554_150475;y5554_144233;y5554_150477;y5554_149509;y5554_146801;y5554_138278;y5554_142551;y5554_150478;y5554_144234;y5554_152489;y5554_156548;y5554_150483;y5554_152490;y5554_150480"], "y5555": ["sdb:5555", S1, "y5555_156549;y5555_153161;y5555_150487;y5555_147609;y5555_152491;y5555_147608;y5555_142552;y5555_150491;y5555_142546;y5555_152492;y5555_140506;y5555_150488;y5555_144251;y5555_156550;y5555_156551;y5555_150489;y5555_138287;y5555_138307"], "y4747": ["sdb:4747", S1, "y4747_134689;y4747_138415;y4747_146317;y4747_147617;y4747_140009;y4747_138366;y4747_134692;y4747_140054;y4747_138413;y4747_155892;y4747_138417;y4747_138364;y4747_155609;y4747_134691;y4747_146316;y4747_138412;y4747_140088;y4747_138414"], "y4748": ["sdb:4748", S1, "y4748_134242;y4748_146319;y4748_138429;y4748_138369;y4748_137964;y4748_138425;y4748_138428;y4748_138427;y4748_142916;y4748_138368;y4748_138430;y4748_155715;y4748_138436;y4748_138367;y4748_140556;y4748_138424;y4748_134268;y4748_146320;y4748_138432"], "y4749": ["sdb:4749", S1, "y4749_138383;y4749_138396;y4749_138384;y4749_152575;y4749_137960;y4749_138392;y4749_137957;y4749_134445;y4749_142325;y4749_137959;y4749_138358;y4749_138382;y4749_140046;y4749_152576;y4749_138393;y4749_152266;y4749_140012;y4749_137967"], "y5321": ["sdb:5321", S1, "y5321_146322;y5321_137671;y5321_138819;y5321_152579;y5321_142629;y5321_137673;y5321_153861;y5321_142568;y5321_146335;y5321_141333;y5321_142613;y5321_142587;y5321_137675;y5321_154069;y5321_149127;y5321_141332", "National 1 \xB7 Grupo B"], "y5322": ["sdb:5322", S1, "y5322_142570;y5322_146325;y5322_141330;y5322_134710;y5322_146330;y5322_146328;y5322_149686;y5322_146333;y5322_134235;y5322_140000;y5322_138822;y5322_134715;y5322_141331;y5322_142623;y5322_138457;y5322_154095", "National 1 \xB7 Grupo C"], "y4681": ["sdb:4681", S1, "y4681_136153;y4681_145171;y4681_135966;y4681_137881;y4681_134706;y4681_136149;y4681_137480;y4681_146607;y4681_145234;y4681_140378;y4681_136144;y4681_138015;y4681_146305;y4681_140385;y4681_138238;y4681_134369;y4681_136147;y4681_137886;y4681_137887;y4681_137888;y4681_134770;y4681_145207;y4681_136007;y4681_140200"], "y4682": ["sdb:4682", S1, "y4682_145168;y4682_136148;y4682_135967;y4682_136154;y4682_135961;y4682_134356;y4682_138020;y4682_134774;y4682_136152;y4682_138028;y4682_148816;y4682_137949;y4682_136672;y4682_136261;y4682_137951;y4682_135965;y4682_135971;y4682_138025;y4682_136145;y4682_138024;y4682_134380;y4682_136150;y4682_146591;y4682_136258"], "y4646": ["sdb:4646", S1, "y4646_134631;y4646_134410;y4646_147592;y4646_137880;y4646_134359;y4646_145181;y4646_136001;y4646_148808;y4646_135969;y4646_135970;y4646_136034;y4646_136157;y4646_145138;y4646_137883;y4646_145141;y4646_147585;y4646_148930;y4646_145242;y4646_140306;y4646_136260;y4646_137890;y4646_145164"], "y4647": ["sdb:4647", S1, "y4647_148729;y4647_134414;y4647_140237;y4647_145123;y4647_137933;y4647_146593;y4647_137935;y4647_137946;y4647_135943;y4647_138021;y4647_136008;y4647_137948;y4647_136146;y4647_137953;y4647_137702;y4647_145202;y4647_135942;y4647_148966;y4647_145211;y4647_135960;y4647_135957;y4647_137932"], "y4648": ["sdb:4648", S1, "y4648_135978;y4648_138018;y4648_145121;y4648_145174;y4648_145179;y4648_145180;y4648_136256;y4648_145185;y4648_145130;y4648_138013;y4648_138235;y4648_145188;y4648_146589;y4648_138022;y4648_147577;y4648_145238;y4648_136254;y4648_145205;y4648_136004;y4648_145157;y4648_138241;y4648_138164"], "y5324": ["sdb:5324", S1, "y5324_145220;y5324_147582;y5324_134418;y5324_137929;y5324_145222;y5324_145176;y5324_145187;y5324_136673;y5324_138014;y5324_138016;y5324_147589;y5324_145224;y5324_140239;y5324_145226;y5324_148926;y5324_148929;y5324_134413;y5324_145228;y5324_136006;y5324_135962;y5324_144691;y5324_134764"], "y5777": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5777_142600;y5777_153863;y5777_153864;y5777_142575;y5777_154067;y5777_142609;y5777_142571;y5777_142646;y5777_rodez2;y5777_cestas;y5777_147622;y5777_137697;y5777_154070;y5777_142579", "National 2 \xB7 Grupo A"], "y5778": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5778_142642;y5778_avoinechinon;y5778_147878;y5778_146341;y5778_147034;y5778_lemans2;y5778_sable;y5778_lessables;y5778_saintphilbertgrandlieu;y5779_154075;y5779_149939;y5778_144770;y5778_fontenay;y5778_149978", "National 2 \xB7 Grupo B"], "y5779": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5779_vire;y5779_saintbrieucginglincesson;y5779_144768;y5779_aspttcaen;y5779_146332;y5779_saintlo;y5779_milizac;y5779_147036;y5779_149704;y5779_rennesta;y5780_146327;y5779_154074;y5779_146350;y5779_142593", "National 2 \xB7 Grupo C"], "y5780": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5780_steenvoorde;y5780_trouvilledeauville;y5780_146326;y5780_153857;y5781_153856;y5781_149128;y5780_154086;y5781_154092;y5780_saintquentin;y5780_redstar2;y5780_154077;y5780_154088;y5780_saintamand;y5781_154094", "National 2 \xB7 Grupo D"], "y5781": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5781_nancy2;y5780_147561;y5781_belfort;y5781_charlevilleprix;y5781_146337;y5782_140487;y5782_154096;y5782_153858;y5781_drancy;y5781_metzapm;y5781_149974;y5782_154097;y5782_142591;y5782_153855", "National 2 \xB7 Grupo E"], "y5782": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5784_153859;y5782_142610;y5783_154099;y5782_annecy2;y5784_147564;y5782_153860;y5782_vesoul;y5782_isselongey;y5782_149700;y5783_142619;y5784_146342;y5782_146349;y5782_thononevian;y5783_142603", "National 2 \xB7 Grupo F"], "y5783": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5783_154098;y5783_beaucaire;y5784_149805;y5784_154103;y5783_espaly;y5783_152841;y5783_gallialucciana;y5783_montpellieratlaspaillade;y5784_146340;y5783_ales;y5784_146343;y5784_154104;y5783_berre;y5783_mandelieu", "National 2 \xB7 Grupo G"], "y5784": ["https://media.fff.fr/uploads/documents/groupes-championnats-2026-2027-national-2-vdef-belfa.pdf", S1, "y5783_146323;y5784_146324;y5778_154071;y5780_137698;y5784_saintjeanleblanc;y5780_149972;y5781_134716;y5784_parisfc2;y5783_142611;y5780_146346;y5784_unionfootdetouraine;y5783_154102;y5784_corte;y5783_146351", "National 2 \xB7 Grupo H"], "y5891": ["sdb:5891", S1, "y5891_155612;y5891_138416;y5891_138421;y5891_155615;y5891_155796;y5891_155620;y5891_156192;y5891_155617;y5891_155611;y5891_146276;y5891_155610;y5891_155619;y5891_140557;y5891_155671;y5891_156193;y5891_155670;y5891_139978;y5891_156194"], "y5892": ["sdb:5892", S1, "y5892_156059;y5892_155692;y5892_155705;y5892_155704;y5892_156058;y5892_147618;y5892_155693;y5892_155726;y5892_155797;y5892_155690;y5892_155711;y5892_155701;y5892_155702;y5892_155716;y5892_155725;y5892_138426;y5892_155694;y5892_155703"], "y5893": ["sdb:5893", S1, "y5893_155712;y5893_138434;y5893_155713;y5893_155672;y5893_155727;y5893_155723;y5893_146318;y5893_138435;y5893_155718;y5893_155700;y5893_155714;y5893_156060;y5893_155800;y5893_142917;y5893_138433;y5893_156061;y5893_155722;y5893_155801"], "y5894": ["sdb:5894", S1, "y5894_155735;y5894_155733;y5894_155731;y5894_155737;y5894_155732;y5894_155728;y5894_156343;y5894_152267;y5894_155741;y5894_139537;y5894_155730;y5894_156342;y5894_155734;y5894_155740;y5894_155738;y5894_155736"], "y5895": ["sdb:5895", S1, "y5895_138379;y5895_139976;y5895_156295;y5895_155755;y5895_155746;y5895_155758;y5895_155745;y5895_155757;y5895_155743;y5895_155802;y5895_155753;y5895_155749;y5895_140025;y5895_155750;y5895_155747;y5895_156137"], "y5896": ["sdb:5896", S1, "y5896_139977;y5896_138418;y5896_155763;y5896_155765;y5896_140053;y5896_155761;y5896_138419;y5896_155785;y5896_156152;y5896_155790;y5896_155764;y5896_155788;y5896_155787;y5896_155789;y5896_156153;y5896_155762;y5896_155760;y5896_156154"], "y5897": ["sdb:5897", S1, "y5897_155825;y5897_156570;y5897_156571;y5897_140215;y5897_149028;y5897_155823;y5897_155817;y5897_155821;y5897_156572;y5897_155818;y5897_155804;y5897_156996;y5897_155820;y5897_155805;y5897_155819;y5897_140047"], "y5898": ["sdb:5898", S1, "y5898_155862;y5898_155849;y5898_138363;y5898_155861;y5898_155852;y5898_155854;y5898_155851;y5898_156272;y5898_155827;y5898_155828;y5898_156271;y5898_155850;y5898_155859;y5898_153099;y5898_137966;y5898_147616;y5898_155860;y5898_138405"], "y5899": ["sdb:5899", S1, "y5899_147412;y5899_146272;y5899_156228;y5899_155869;y5899_155868;y5899_155864;y5899_156227;y5899_140026;y5899_138377;y5899_155865;y5899_138374;y5899_147614;y5899_155870;y5899_156226;y5899_156229;y5899_155867"], "y5225": ["sdb:5225", S3, "y5225_144077;y5225_137931;y5225_137936;y5225_148769;y5225_145124;y5225_134415;y5225_138019;y5225_148813;y5225_140231;y5225_146587;y5225_134442;y5225_140230;y5225_148876;y5225_145225;y5225_148897;y5225_148904;y5225_147571;y5225_148975;y5225_145155;y5225_146611;y5225_145163;y5225_146588"], "y5226": ["sdb:5226", S3, "y5226_148725;y5226_148727;y5226_140351;y5226_145169;y5226_145119;y5226_134797;y5226_137930;y5226_148782;y5226_148806;y5226_136009;y5226_138236;y5226_138165;y5226_138237;y5226_152216;y5226_137952;y5226_143770;y5226_148896;y5226_147590;y5226_146590;y5226_145161;y5226_145217;y5226_152757"], "y5228": ["sdb:5228", S3, "y5228_145117;y5228_145122;y5228_146596;y5228_145175;y5228_138026;y5228_146597;y5228_148814;y5228_148841;y5228_138023;y5228_145140;y5228_145143;y5228_145146;y5228_148922;y5228_148945;y5228_145206;y5228_148962;y5228_138163;y5228_138240;y5228_146600;y5228_138017;y5228_145162;y5228_149009"], "y5227": ["sdb:5227", S3, "y5227_148722;y5227_145115;y5227_147572;y5227_140349;y5227_148792;y5227_148794;y5227_148802;y5227_148810;y5227_140238;y5227_145133;y5227_145134;y5227_148854;y5227_137954;y5227_136010;y5227_148915;y5227_148925;y5227_143782;y5227_146594;y5227_145151;y5227_145152;y5227_148967;y5227_145215"], "y5325": ["sdb:5325", S3, "y5325_139947;y5325_148749;y5325_148754;y5325_138011;y5325_145231;y5325_146602;y5325_140391;y5325_148822;y5325_146604;y5325_148830;y5325_148832;y5325_148845;y5325_145195;y5325_145236;y5325_134421;y5325_137885;y5325_147580;y5325_140393;y5325_145149;y5325_148955;y5325_140369;y5325_148995"], "y5326": ["sdb:5326", S3, "y5326_145219;y5326_135973;y5326_134420;y5326_145120;y5326_145172;y5326_146601;y5326_148756;y5326_148758;y5326_145177;y5326_145183;y5326_145127;y5326_148787;y5326_137882;y5326_146609;y5326_148882;y5326_137884;y5326_145246;y5326_148937;y5326_145239;y5326_140382;y5326_145153;y5326_148990"], "y5327": ["sdb:5327", S3, "y5327_134416;y5327_145170;y5327_138027;y5327_145173;y5327_145221;y5327_135972;y5327_148819;y5327_146605;y5327_136253;y5327_145191;y5327_148871;y5327_148877;y5327_145198;y5327_148894;y5327_137955;y5327_145227;y5327_147591;y5327_145210;y5327_145159;y5327_145213;y5327_145214;y5327_149004"], "y5328": ["sdb:5328", S3, "y5328_145229;y5328_137879;y5328_145230;y5328_145178;y5328_140388;y5328_148784;y5328_146606;y5328_145194;y5328_148872;y5328_148883;y5328_140392;y5328_136155;y5328_145144;y5328_148912;y5328_145200;y5328_145203;y5328_148952;y5328_137889;y5328_135974;y5328_147593;y5328_134411;y5328_149011"], "y4778": ["sdb:4778", S1, "y4778_142935;y4778_142954;y4778_134780;y4778_149236;y4778_142974;y4778_152842;y4778_148674;y4778_156647;y4778_156648;y4778_133819;y4778_149238;y4778_143895;y4778_153108;y4778_142946;y4778_140304;y4778_142948;y4778_142950;y4778_137254"], "y4779": ["sdb:4779", S1, "y4779_134655;y4779_149239;y4779_149240;y4779_142951;y4779_142957;y4779_153106;y4779_142960;y4779_156649;y4779_140293;y4779_142961;y4779_135892;y4779_152843;y4779_156650;y4779_156651;y4779_133821;y4779_142958;y4779_153107;y4779_142949"], "y4780": ["sdb:4780", S1, "y4780_142992;y4780_142990;y4780_135898;y4780_142925;y4780_142991;y4780_134674;y4780_142977;y4780_133973;y4780_134672;y4780_156653;y4780_142994;y4780_143904;y4780_142996;y4780_142982;y4780_142930;y4780_135951;y4780_146941;y4780_146942"], "y4782": ["sdb:4782", S1, "y4782_143521;y4782_156654;y4782_149246;y4782_142989;y4782_149249;y4782_143010;y4782_156655;y4782_134800;y4782_133971;y4782_135952;y4782_140302;y4782_156656;y4782_143011;y4782_156657;y4782_142997;y4782_134663;y4782_146944;y4782_146945"], "y4784": ["sdb:4784", S1, "y4784_135896;y4784_143034;y4784_156662;y4784_135954;y4784_143035;y4784_143036;y4784_143037;y4784_134684;y4784_149256;y4784_146952;y4784_134683;y4784_143029;y4784_134786;y4784_146950;y4784_144187;y4784_156663;y4784_140295;y4784_135737"], "y4785": ["sdb:4785", S1, "y4785_153116;y4785_156664;y4785_147198;y4785_153117;y4785_156666;y4785_149259;y4785_143047;y4785_153118;y4785_156665;y4785_149261;y4785_149260;y4785_147201;y4785_133699;y4785_149263;y4785_135732;y4785_144191;y4785_135730;y4785_134801"], "y4783": ["sdb:4783", S1, "y4783_144170;y4783_142984;y4783_149251;y4783_156658;y4783_149252;y4783_143018;y4783_156661;y4783_143020;y4783_140298;y4783_140296;y4783_153112;y4783_156659;y4783_134679;y4783_149253;y4783_146948;y4783_140299;y4783_143915;y4783_156660"], "y4786": ["sdb:4786", S1, "y4786_134661;y4786_143887;y4786_153103;y4786_142919;y4786_142920;y4786_153104;y4786_146928;y4786_143889;y4786_142923;y4786_137119;y4786_143890;y4786_156645;y4786_142927;y4786_156646;y4786_143893;y4786_142929;y4786_143894;y4786_153105"], "y5095": ["sdb:5095", S1, "y5095_142750;y5095_140312;y5095_142342;y5095_142343;y5095_142344;y5095_142345;y5095_142346;y5095_142348;y5095_142349;y5095_149151;y5095_142350;y5095_142351;y5095_142352;y5095_142353;y5095_142354;y5095_142355;y5095_142356;y5095_142357"], "y5798": ["sdb:5798", S1, "y5798_154252;y5798_154249;y5798_153536;y5798_154243;y5798_156078;y5798_154253;y5798_154250;y5798_156079;y5798_156076;y5798_156080;y5798_143921;y5798_154248;y5798_154242;y5798_156077;y5798_154251;y5798_138907;y5798_154246;y5798_154244"], "y5799": ["sdb:5799", S1, "y5799_156084;y5799_154292;y5799_155937;y5799_154275;y5799_154291;y5799_156081;y5799_156082;y5799_153535;y5799_154295;y5799_156083;y5799_154276;y5799_154290;y5799_154274;y5799_154294;y5799_154273;y5799_154298;y5799_154299;y5799_154293"], "y5801": ["sdb:5801", S1, "y5801_156092;y5801_154329;y5801_154349;y5801_156089;y5801_156091;y5801_154335;y5801_154328;y5801_156093;y5801_154353;y5801_154333;y5801_154334;y5801_154332;y5801_154355;y5801_154331;y5801_156090;y5801_154350;y5801_154330;y5801_154348"], "y5800": ["sdb:5800", S1, "y5800_156085;y5800_154315;y5800_154314;y5800_142468;y5800_154319;y5800_154316;y5800_154323;y5800_154965;y5800_156088;y5800_142469;y5800_154321;y5800_154322;y5800_154303;y5800_156087;y5800_156086;y5800_154317;y5800_154313;y5800_136196"], "y5870": ["sdb:5870", S1, "y5870_156262;tur2_ada||134247;y5870_149639;y5870_149669;y5870_143378;y5870_149649;y5870_149210;y5870_147642;y5870_149654;y5870_138978;y5870_153068;y5870_149656;y5870_149663;y5870_149648;y5870_149638;y5870_134227;y5870_147641;y5870_149658"], "x4683": ["sdb:4683", S1, "x4683_133894|Aab;x4683_141777|Aarhus Fremad;x4683_141778|Ab Gladsaxe;x4683_133939|Esbjerg;den_fre||138451;x4683_141782|Hiller\xF8d;den_hob||134577;den_hvi||139047;x4683_133896|K\xF8ge;x4683_139046|Kolding;den_vej||136188;x4683_136189|Vendsyssel"], "y4616a": ["https://www.afa.com.ar/agenda/posts/primera-nacional-fixture-para-la-temporada-2026", S0, "y4616a_144739;y4616a_137767;arg2_all||137781;y4616a_137766;y4616a_143087;arg2_almb||141011;y4616a_135162;arg2_149544|Ciudad De Bol\xEDvar;arg2_mor||137772;arg2_def||137779;y4616a_135157;arg2_dep||142479;y4616a_143096;y4616a_142489;y4616a_141014;arg2_fer||137774;y4616a_143091;arg2_cfe||140526", "Primera Nacional \xB7 Zona A"], "y5079a": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079a_nacionalam|Nacional-AM|147315;y5079a_137817;y5079b_148207;x5772_142292;x5772_152672;x5772_142250", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A1"], "y5079b": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "x5676_150120;x5676_142253;x5676_144967;y5079a_142294;y5079c_152668;x5775_152688", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A2"], "y5079c": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "x5685_142251;x5685_139997;x5762_134748;x5762_152636;y5079c_152627;y5079a_142246", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A3"], "y5079d": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079d_capitaldf;x5685_144960;x5762_148209;y5079d_operariomt;y5079d_uniaomt;y5079b_150117", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A4"], "y5079e": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "x5678_144963;x5678_150127;x5764_144975;x5764_147141;x5775_142276;y5079a_137815", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A5"], "y5079f": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079f_sampaiocorreama;y5079a_142258;y5079c_152633;y5079b_148208;y5079b_147147;x5769_147150", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A6"], "y5079g": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079a_137814;y5079c_152623;y5079g_atleticoce;x5769_141179;x5769_152660;x5769_144976", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A7"], "y5079h": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "bra3_abc||134747;y5079a_134746;y5079c_152662;x5765_142274;y5079c_152656;y5079h_centralpe", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A8"], "y5079i": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079a_142296;y5079i_decisaope;x5765_152647;x5765_137819;x5773_144965;x5773_142261", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A9"], "y5079j": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079j_asaal|ASA-AL|142248;bra3_csa||136187;y5079b_145391;x5684_137816;y5079j_atleticoba;x5684_142252", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A10"], "y5079k": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079a_142244;y5079c_152640;y5079b_147309;y5079k_abecatgo;y5079k_operarioms;x5774_152682", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A11"], "y5079l": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079l_portoba;x5686_142286;x5686_147154;x5686_144968;bra3_tom||138059;y5079b_147145", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A12"], "y5079m": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079a_142266;y5079m_portuguesarj|Portuguesa-RJ|144962;y5079m_americarj|America-RJ|155256;y5079m_portuguesasp;y5079b_148198;y5079b_144971", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A13"], "y5079n": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079b_144961;y5079n_sampaiocorrearj;y5079b_144974;y5079a_139998;y5079c_152655;y5079c_152654", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A14"], "y5079o": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "x5766_142243;x5766_142283;y5079c_152619;y5079a_134743;y5079b_150118;y5079b_145393", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A15"], "y5079p": ["https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026", S0, "y5079c_155257;y5079a_142285;x5766_147312;x5766_144970;y5079a_138058;y5079a_135663", "Brasileir\xE3o S\xE9rie D \xB7 Grupo A16"] };
var CATALOG_ALIASES = { "x5743": "ven", "y5279b": "y5279a", "y4525": "eng", "y4676": "tur2", "y4334": "fra", "y4331": "ger", "y4399": "ger2" };

// src/game/data/league-memberships.ts
function applyMembership(league, registry) {
  const snapshot = LEAGUE_MEMBERSHIPS[league.id];
  if (!snapshot) return { ...league, catalogStatus: "legacy" };
  const [sourceUrl, season, clubRows, displayName] = snapshot;
  const strength = Math.round(
    league.clubs.reduce((s, c) => s + c.strength, 0) / Math.max(1, league.clubs.length)
  );
  return {
    ...league,
    ...displayName ? { name: displayName } : {},
    membershipSeason: season,
    membershipSource: sourceUrl.startsWith("sdb:") ? `https://www.thesportsdb.com/league/${sourceUrl.slice(4)}` : sourceUrl,
    catalogStatus: "sourced",
    clubs: clubRows.split(";").map((row) => {
      const [id = "", label, source] = row.split("|");
      const name = label || registry[id]?.name || "Clube";
      const sourceTeamId = source || id.match(/_(\d{5,})$/)?.[1];
      return {
        ...registry[id] ?? {
          id,
          name,
          short: name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase(),
          primary: "#1f4fa0",
          secondary: "#ffffff",
          strength: Math.max(40, Math.min(80, strength))
        },
        league: league.id,
        ...sourceTeamId ? { sourceTeamId } : {}
      };
    })
  };
}

// src/game/data/serie-d.ts
var SERIE_D_IDS = Array.from(
  { length: 16 },
  (_, i) => `y5079${String.fromCharCode(97 + i)}`
);

// src/game/data/leagues.ts
var BRA = [
  // Game quality priors, reviewed 2026-10-02 against CBF 2025 + 2026 results.
  // These are not official ratings or a direct encoding of league positions.
  // https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Regulamento
  ["fla", "Flamengo", "FLA", "#c52613", "#111111", 85],
  ["pal", "Palmeiras", "PAL", "#0a6b3c", "#ffffff", 85],
  ["bot", "Botafogo", "BOT", "#141414", "#ffffff", 78],
  ["cru", "Cruzeiro", "CRU", "#1f3f95", "#ffffff", 80],
  ["mgo", "Atl\xE9tico Mineiro", "CAM", "#101010", "#ffffff", 79],
  ["sao", "S\xE3o Paulo", "SAO", "#c1121f", "#ffffff", 78],
  ["flu", "Fluminense", "FLU", "#7a1b30", "#0d5b3c", 82],
  ["int", "Internacional", "INT", "#c8102e", "#ffffff", 75],
  ["gre", "Gr\xEAmio", "GRE", "#0d8bd9", "#111111", 75],
  ["cor", "Corinthians", "COR", "#101010", "#ffffff", 78],
  ["bah", "Bahia", "BAH", "#1c5cb8", "#e10600", 80],
  ["vas", "Vasco da Gama", "VAS", "#111111", "#ffffff", 75],
  ["for", "Fortaleza", "FOR", "#1a3fa0", "#e10600", 72],
  ["san", "Santos", "SAN", "#f2f2f2", "#111111", 77],
  ["rbb", "Red Bull Bragantino", "RBB", "#e10600", "#ffffff", 76],
  ["mir", "Mirassol", "MIR", "#f5b400", "#0a6b3c", 73],
  ["cea", "Cear\xE1", "CEA", "#101010", "#ffffff", 70],
  ["spt", "Sport Recife", "SPT", "#c8102e", "#111111", 66],
  ["vit", "Vit\xF3ria", "VIT", "#c8102e", "#111111", 73],
  ["juv", "Juventude", "JUV", "#0a8f3c", "#ffffff", 67]
];
var BRA2 = [
  ["gao", "Goi\xE1s", "GOI", "#0a8f3c", "#ffffff", 72],
  ["cor_pr", "Coritiba", "CFC", "#0a6b3c", "#ffffff", 73],
  ["ath", "Athletico Paranaense", "CAP", "#c8102e", "#111111", 80],
  ["cri", "Crici\xFAma", "CRI", "#f5b400", "#111111", 68],
  ["ame", "Am\xE9rica-MG", "AME", "#0a8f3c", "#ffffff", 69],
  ["avai", "Ava\xED", "AVA", "#1f3f95", "#f5b400", 66],
  ["cha", "Chapecoense", "CHA", "#0a8f3c", "#ffffff", 68],
  ["nov", "Novorizontino", "NOV", "#f5b400", "#111111", 68],
  ["pay", "Paysandu", "PAY", "#1f3f95", "#ffffff", 66],
  ["rem", "Remo", "REM", "#1f3f95", "#ffffff", 68],
  ["ope", "Oper\xE1rio-PR", "OPE", "#111111", "#f5b400", 64],
  ["vnv", "Vila Nova", "VIL", "#c8102e", "#0a8f3c", 65],
  ["crb", "CRB", "CRB", "#c8102e", "#111111", 66],
  ["ath_go", "Atl\xE9tico Goianiense", "ACG", "#c8102e", "#111111", 66],
  ["fer", "Ferrovi\xE1ria", "FER", "#c8102e", "#111111", 63],
  ["ath_ba", "Athletic Club-MG", "ATH", "#111111", "#ffffff", 62],
  ["vol", "Volta Redonda", "VRE", "#111111", "#f5b400", 61],
  ["ama", "Amazonas", "AMA", "#0a8f3c", "#f5b400", 61],
  ["bra2_bot", "Botafogo-SP", "BSP", "#f5f5f5", "#111111", 62],
  ["bra2_nau", "N\xE1utico", "NAU", "#e30613", "#ffffff", 63]
];
var ENG = [
  ["liv", "Liverpool", "LIV", "#c8102e", "#ffffff", 91],
  ["ars", "Arsenal", "ARS", "#ef0107", "#ffffff", 90],
  ["mci", "Manchester City", "MCI", "#6cabdd", "#ffffff", 90],
  ["che", "Chelsea", "CHE", "#034694", "#ffffff", 87],
  ["new", "Newcastle United", "NEW", "#111111", "#ffffff", 85],
  ["avl", "Aston Villa", "AVL", "#670e36", "#95bfe5", 84],
  ["tot", "Tottenham Hotspur", "TOT", "#f1f1f1", "#132257", 83],
  ["mun", "Manchester United", "MUN", "#da291c", "#ffffff", 83],
  ["bha", "Brighton", "BHA", "#0057b8", "#ffffff", 81],
  ["cry", "Crystal Palace", "CRY", "#1b458f", "#c4122e", 80],
  ["bou", "Bournemouth", "BOU", "#da291c", "#111111", 79],
  ["ful", "Fulham", "FUL", "#f5f5f5", "#111111", 78],
  ["bre", "Brentford", "BRE", "#e30613", "#ffffff", 77],
  ["nfo", "Nottingham Forest", "NFO", "#dd0000", "#ffffff", 77],
  ["whu", "West Ham United", "WHU", "#7a263a", "#1bb1e7", 76],
  ["eve", "Everton", "EVE", "#003399", "#ffffff", 76],
  ["wol", "Wolverhampton", "WOL", "#fdb913", "#111111", 74],
  ["lee", "Leeds United", "LEE", "#ffffff", "#1d428a", 73],
  ["sun", "Sunderland", "SUN", "#eb172b", "#ffffff", 72],
  ["bur", "Burnley", "BUR", "#6c1d45", "#99d6ea", 70]
];
var ENG2 = [
  ["lei", "Leicester City", "LEI", "#003090", "#ffffff", 75],
  ["sou", "Southampton", "SOU", "#d71920", "#ffffff", 74],
  ["ips", "Ipswich Town", "IPS", "#0033a0", "#ffffff", 73],
  ["mid", "Middlesbrough", "MID", "#e21c38", "#ffffff", 72],
  ["wba", "West Bromwich", "WBA", "#122f67", "#ffffff", 71],
  ["cov", "Coventry City", "COV", "#6cabdd", "#111111", 71],
  ["nor", "Norwich City", "NOR", "#00a650", "#fff200", 70],
  ["shu", "Sheffield United", "SHU", "#ee2737", "#111111", 70],
  ["swa", "Swansea City", "SWA", "#f5f5f5", "#111111", 68],
  ["hul", "Hull City", "HUL", "#f18a01", "#111111", 68],
  ["mil", "Millwall", "MIL", "#001d5e", "#ffffff", 67],
  ["qpr", "Queens Park Rangers", "QPR", "#1d5ba4", "#ffffff", 67],
  ["pre", "Preston North End", "PNE", "#f5f5f5", "#00478f", 66],
  ["bri", "Bristol City", "BRC", "#e31b23", "#111111", 66],
  ["wat", "Watford", "WAT", "#fbee23", "#111111", 66],
  ["stk", "Stoke City", "STK", "#e03a3e", "#ffffff", 65],
  ["der", "Derby County", "DER", "#f5f5f5", "#111111", 65],
  ["por", "Portsmouth", "POR", "#001489", "#ffffff", 64],
  ["eng2_shw", "Sheffield Wednesday", "SHW", "#1f4fa0", "#ffffff", 65],
  ["eng2_blb", "Blackburn Rovers", "BLB", "#1f4fa0", "#ffffff", 65],
  ["eng2_car", "Cardiff City", "CAR", "#c8102e", "#ffffff", 64],
  ["eng2_lut", "Luton Town", "LUT", "#f5820a", "#111111", 64],
  ["eng2_oxf", "Oxford United", "OXF", "#f5c400", "#1f4fa0", 62],
  ["eng2_ply", "Plymouth Argyle", "PLY", "#0a7a3c", "#ffffff", 62]
];
var ESP = [
  ["rma", "Real Madrid", "RMA", "#f7f7f7", "#febe10", 92],
  ["bar", "Barcelona", "BAR", "#a50044", "#004d98", 91],
  ["atm", "Atl\xE9tico de Madrid", "ATM", "#cb3524", "#272e61", 87],
  ["ath_b", "Athletic Club", "ATH", "#ee2523", "#ffffff", 83],
  ["vil_e", "Villarreal", "VIL", "#ffe667", "#005187", 82],
  ["bet", "Real Betis", "BET", "#0bb363", "#ffffff", 81],
  ["rso", "Real Sociedad", "RSO", "#0067b1", "#ffffff", 80],
  ["sev", "Sevilla", "SEV", "#f4f4f4", "#d81920", 78],
  ["cel", "Celta de Vigo", "CEL", "#8ac3ee", "#ffffff", 77],
  ["ray", "Rayo Vallecano", "RAY", "#f7f7f7", "#e53027", 76],
  ["val", "Valencia", "VAL", "#f7f7f7", "#ee3524", 76],
  ["osa", "Osasuna", "OSA", "#0a346f", "#d81e05", 75],
  ["gir", "Girona", "GIR", "#d6001c", "#ffffff", 75],
  ["mlg", "Mallorca", "MLG", "#e20613", "#111111", 74],
  ["get", "Getafe", "GET", "#005999", "#ffffff", 73],
  ["esp_e", "Espanyol", "ESP", "#0072ce", "#ffffff", 73],
  ["alv", "Deportivo Alav\xE9s", "ALV", "#0761af", "#ffffff", 72],
  ["elc", "Elche", "ELC", "#f7f7f7", "#00a94f", 70],
  ["lev", "Levante", "LEV", "#004b9b", "#c8102e", 69],
  ["ovi", "Real Oviedo", "OVI", "#0055a4", "#ffffff", 68]
];
var ITA = [
  ["int_i", "Inter", "INT", "#0068a8", "#111111", 89],
  ["nap", "Napoli", "NAP", "#12a0d7", "#ffffff", 88],
  ["mil_i", "Milan", "MIL", "#fb090b", "#111111", 86],
  ["juv_i", "Juventus", "JUV", "#f7f7f7", "#111111", 85],
  ["ata", "Atalanta", "ATA", "#1d5aa8", "#111111", 84],
  ["rom", "Roma", "ROM", "#8e1f2f", "#f0bc42", 83],
  ["laz", "Lazio", "LAZ", "#87d8f7", "#ffffff", 81],
  ["fio", "Fiorentina", "FIO", "#7b2c8f", "#ffffff", 80],
  ["bol", "Bologna", "BOL", "#1a2f57", "#a21c26", 79],
  ["com", "Como", "COM", "#0a3d91", "#ffffff", 77],
  ["tor", "Torino", "TOR", "#7a1c22", "#ffffff", 76],
  ["udi", "Udinese", "UDI", "#111111", "#ffffff", 75],
  ["gen", "Genoa", "GEN", "#a21c26", "#0a3d91", 74],
  ["cag", "Cagliari", "CAG", "#a4133c", "#0a3d91", 73],
  ["ver", "Hellas Verona", "VER", "#f7d417", "#0a3d91", 72],
  ["lec", "Lecce", "LEC", "#f7d417", "#a4133c", 71],
  ["par", "Parma", "PAR", "#f7e04a", "#0a72bb", 71],
  ["sas", "Sassuolo", "SAS", "#00a752", "#111111", 70],
  ["pis", "Pisa", "PIS", "#0a3d91", "#ffffff", 69],
  ["cre", "Cremonese", "CRE", "#a4133c", "#7a7a7a", 68]
];
var GER = [
  ["bay", "Bayern de Munique", "FCB", "#dc052d", "#ffffff", 92],
  ["bvb", "Borussia Dortmund", "BVB", "#fde100", "#111111", 86],
  ["b04", "Bayer Leverkusen", "B04", "#e32221", "#111111", 85],
  ["rbl", "RB Leipzig", "RBL", "#dd0741", "#ffffff", 84],
  ["sge", "Eintracht Frankfurt", "SGE", "#111111", "#e1000f", 82],
  ["vfb", "VfB Stuttgart", "VFB", "#f7f7f7", "#e32219", 81],
  ["scf", "SC Freiburg", "SCF", "#e2001a", "#111111", 79],
  ["wob", "VfL Wolfsburg", "WOB", "#65b32e", "#ffffff", 78],
  ["bmg", "Borussia M'gladbach", "BMG", "#f7f7f7", "#111111", 77],
  ["fcu", "Union Berlin", "FCU", "#eb1923", "#f5d200", 76],
  ["m05", "Mainz 05", "M05", "#c3141e", "#ffffff", 76],
  ["tsg", "Hoffenheim", "TSG", "#1961b3", "#ffffff", 75],
  ["wer", "Werder Bremen", "SVW", "#1d9053", "#ffffff", 75],
  ["fca", "FC Augsburg", "FCA", "#ba3733", "#00623f", 73],
  ["koe", "1. FC K\xF6ln", "KOE", "#f7f7f7", "#e2001a", 73],
  ["hsv", "Hamburger SV", "HSV", "#0a3a8b", "#111111", 72],
  ["hdh", "Heidenheim", "FCH", "#e2001a", "#0a3a8b", 70],
  ["stp", "St. Pauli", "STP", "#61361e", "#ffffff", 70]
];
var FRA = [
  ["psg", "Paris Saint-Germain", "PSG", "#004170", "#da291c", 92],
  ["mar", "Olympique de Marselha", "OM", "#f7f7f7", "#2faee0", 84],
  ["mon", "AS Monaco", "ASM", "#e63329", "#ffffff", 83],
  ["lil", "Lille", "LOSC", "#e01e13", "#0a2240", 82],
  ["lyo", "Olympique Lyonnais", "OL", "#f7f7f7", "#1b3a8c", 81],
  ["nic", "OGC Nice", "NIC", "#111111", "#e2001a", 79],
  ["ren", "Stade Rennais", "SRFC", "#e2001a", "#111111", 78],
  ["len", "RC Lens", "RCL", "#f5d200", "#e2001a", 78],
  ["str", "Strasbourg", "RCSA", "#0a80c8", "#ffffff", 77],
  ["bre_f", "Stade Brestois", "SB29", "#e2001a", "#ffffff", 75],
  ["tou", "Toulouse", "TFC", "#5c2d91", "#ffffff", 74],
  ["nan", "FC Nantes", "FCN", "#f5d200", "#0a8f3c", 73],
  ["aux", "AJ Auxerre", "AJA", "#f5f5f5", "#1961b3", 72],
  ["ang", "Angers SCO", "SCO", "#111111", "#ffffff", 70],
  ["laz_f", "Le Havre", "HAC", "#0a2240", "#7ec8e3", 69],
  ["mtp", "Montpellier", "MHSC", "#e2001a", "#0a2240", 69],
  ["par_f", "Paris FC", "PFC", "#0a2240", "#ffffff", 71],
  ["met", "FC Metz", "FCM", "#7a1c22", "#ffffff", 68]
];
var POR = [
  ["ben", "Benfica", "SLB", "#e01e13", "#ffffff", 86],
  ["prt", "FC Porto", "FCP", "#0a3a8b", "#ffffff", 85],
  ["spo", "Sporting CP", "SCP", "#0a8f3c", "#ffffff", 86],
  ["sbr", "SC Braga", "SCB", "#e2001a", "#ffffff", 81],
  ["vit_g", "Vit\xF3ria de Guimar\xE3es", "VSC", "#f7f7f7", "#111111", 76],
  ["mor", "Moreirense", "MOR", "#0a8f3c", "#ffffff", 72],
  ["fam", "Famalic\xE3o", "FAM", "#f7f7f7", "#0a3a8b", 72],
  ["san_p", "Santa Clara", "SCL", "#e2001a", "#ffffff", 70],
  ["est", "Estoril", "EST", "#f5d200", "#0a3a8b", 70],
  ["riv", "Rio Ave", "RAV", "#0a8f3c", "#ffffff", 69],
  ["nac", "Nacional", "NAC", "#111111", "#ffffff", 68],
  ["gil", "Gil Vicente", "GIL", "#e2001a", "#0a3a8b", 69],
  ["cas", "Casa Pia", "CAS", "#111111", "#f5d200", 67],
  ["ave", "AVS", "AVS", "#f5d200", "#111111", 66],
  ["arv", "Arouca", "ARO", "#f5d200", "#0a8f3c", 67],
  ["ton", "Tondela", "TON", "#f5d200", "#111111", 65],
  ["ala", "Alverca", "ALV", "#e2001a", "#111111", 64],
  ["mar_p", "Mar\xEDtimo", "MAR", "#0a8f3c", "#e2001a", 65]
];
var NED = [
  ["aja", "Ajax", "AJA", "#f7f7f7", "#d2122e", 83],
  ["psv", "PSV Eindhoven", "PSV", "#e30613", "#ffffff", 85],
  ["fey", "Feyenoord", "FEY", "#f7f7f7", "#c8102e", 83],
  ["az", "AZ Alkmaar", "AZ", "#e30613", "#ffffff", 79],
  ["twe", "FC Twente", "TWE", "#e30613", "#ffffff", 78],
  ["utr", "FC Utrecht", "UTR", "#e30613", "#ffffff", 77],
  ["gro", "FC Groningen", "GRO", "#0a8f3c", "#ffffff", 73],
  ["skc", "Sparta Rotterdam", "SPA", "#e30613", "#ffffff", 71],
  ["hee", "Heerenveen", "HEE", "#1961b3", "#ffffff", 72],
  ["nec", "NEC Nijmegen", "NEC", "#e30613", "#0a8f3c", 73],
  ["gae", "Go Ahead Eagles", "GAE", "#e30613", "#f5d200", 72],
  ["for_n", "Fortuna Sittard", "FOR", "#f5d200", "#0a8f3c", 69],
  ["pec", "PEC Zwolle", "PEC", "#1961b3", "#ffffff", 69],
  ["her", "Heracles", "HER", "#111111", "#f5d200", 68],
  ["nac_n", "NAC Breda", "NAC", "#f5d200", "#111111", 68],
  ["tel", "Telstar", "TEL", "#f5d200", "#111111", 65],
  ["exc", "Excelsior", "EXC", "#e30613", "#111111", 66],
  ["vol_n", "Volendam", "VOL", "#e30613", "#111111", 65]
];
var ARG = [
  ["riv_a", "River Plate", "RIV", "#f7f7f7", "#e30613", 84],
  ["boc", "Boca Juniors", "BOC", "#12326b", "#f5c400", 84],
  ["rac", "Racing Club", "RAC", "#7ec8e3", "#ffffff", 81],
  ["ind", "Independiente", "IND", "#e30613", "#ffffff", 79],
  ["san_a", "San Lorenzo", "SLO", "#12326b", "#e30613", 77],
  ["vel", "V\xE9lez Sarsfield", "VEL", "#f7f7f7", "#12326b", 79],
  ["est_a", "Estudiantes", "EDLP", "#e30613", "#ffffff", 79],
  ["hur", "Hurac\xE1n", "HUR", "#f7f7f7", "#e30613", 74],
  ["arg_j", "Argentinos Juniors", "AAAJ", "#e30613", "#12326b", 75],
  ["lan", "Lan\xFAs", "LAN", "#7a1c22", "#ffffff", 76],
  ["tal", "Talleres", "TAL", "#12326b", "#ffffff", 76],
  ["bel", "Belgrano", "BEL", "#7ec8e3", "#ffffff", 73],
  ["new_a", "Newell's Old Boys", "NOB", "#e30613", "#111111", 74],
  ["ros", "Rosario Central", "CARC", "#f5c400", "#12326b", 75],
  ["def", "Defensa y Justicia", "DYJ", "#f5c400", "#0a8f3c", 73],
  ["tig", "Tigre", "TIG", "#12326b", "#e30613", 71],
  ["gim", "Gimnasia LP", "GEL", "#12326b", "#f7f7f7", 71],
  ["ban", "Banfield", "BAN", "#0a8f3c", "#f7f7f7", 70]
];
var MEX = [
  ["ame_m", "Club Am\xE9rica", "AME", "#f5d200", "#12326b", 82],
  ["gua", "Guadalajara", "CHI", "#e30613", "#12326b", 79],
  ["mty", "Monterrey", "MTY", "#12326b", "#f7f7f7", 81],
  ["tig_m", "Tigres UANL", "TIG", "#f5a800", "#12326b", 81],
  ["cru_m", "Cruz Azul", "CAZ", "#1961b3", "#ffffff", 80],
  ["pum", "Pumas UNAM", "PUM", "#12326b", "#f5d200", 76],
  ["tol", "Toluca", "TOL", "#e30613", "#ffffff", 80],
  ["pac", "Pachuca", "PAC", "#12326b", "#f7f7f7", 78],
  ["san_m", "Santos Laguna", "SAN", "#0a8f3c", "#ffffff", 74],
  ["lea", "Le\xF3n", "LEO", "#0a8f3c", "#f5d200", 76],
  ["atl_m", "Atlas", "ATL", "#e30613", "#111111", 73],
  ["nec_m", "Necaxa", "NEC", "#e30613", "#ffffff", 73],
  ["pue", "Puebla", "PUE", "#12326b", "#ffffff", 70],
  ["que", "Quer\xE9taro", "QRO", "#111111", "#12326b", 70],
  ["jua", "FC Ju\xE1rez", "JUA", "#0a8f3c", "#e30613", 72],
  ["tij", "Tijuana", "TIJ", "#e30613", "#111111", 73],
  ["maz", "Mazatl\xE1n", "MAZ", "#7a1c8f", "#f5d200", 70],
  ["sla", "San Luis", "ASL", "#e30613", "#12326b", 71]
];
var USA = [
  ["mia", "Inter Miami", "MIA", "#f4b7cd", "#111111", 81],
  ["lag", "LA Galaxy", "LAG", "#f7f7f7", "#f5d200", 78],
  ["laf", "Los Angeles FC", "LAFC", "#111111", "#c39e6d", 81],
  ["sea", "Seattle Sounders", "SEA", "#0a8f3c", "#12326b", 78],
  ["atl_u", "Atlanta United", "ATL", "#e30613", "#111111", 77],
  ["nyc", "New York City FC", "NYC", "#7ec8e3", "#12326b", 77],
  ["rbny", "New York Red Bulls", "RBNY", "#e30613", "#f5d200", 76],
  ["phi", "Philadelphia Union", "PHI", "#12326b", "#f5d200", 78],
  ["col", "Columbus Crew", "CLB", "#f5d200", "#111111", 79],
  ["orl", "Orlando City", "ORL", "#5c2d91", "#f5d200", 77],
  ["cin", "FC Cincinnati", "CIN", "#e30613", "#12326b", 78],
  ["aus", "Austin FC", "ATX", "#0a8f3c", "#111111", 74],
  ["por_u", "Portland Timbers", "POR", "#0a5c36", "#f5d200", 74],
  ["min", "Minnesota United", "MIN", "#7ec8e3", "#111111", 74],
  ["nsh", "Nashville SC", "NSH", "#f5d200", "#12326b", 74],
  ["dal", "FC Dallas", "DAL", "#e30613", "#12326b", 73],
  ["hou", "Houston Dynamo", "HOU", "#f56600", "#111111", 73],
  ["skc_u", "Sporting Kansas City", "SKC", "#7ec8e3", "#111111", 73],
  ["usa_van", "Vancouver Whitecaps", "VAN", "#7ec8e3", "#12326b", 73],
  ["usa_rsl", "Real Salt Lake", "RSL", "#7a1020", "#f5d200", 72],
  ["usa_col", "Colorado Rapids", "COL", "#7a1020", "#7ec8e3", 72],
  ["usa_sjo", "San Jose Earthquakes", "SJ", "#12326b", "#111111", 70],
  ["usa_stl", "St. Louis City", "STL", "#e30613", "#12326b", 72],
  ["usa_cha", "Charlotte FC", "CLT", "#12326b", "#7ec8e3", 72],
  ["usa_dcu", "DC United", "DCU", "#111111", "#e30613", 70],
  ["usa_ner", "New England Revolution", "NE", "#12326b", "#e30613", 72],
  ["usa_chi", "Chicago Fire", "CHI", "#12326b", "#e30613", 71],
  ["usa_tor", "Toronto FC", "TOR", "#e30613", "#111111", 70],
  ["usa_mtl", "CF Montr\xE9al", "MTL", "#12326b", "#7ec8e3", 70],
  ["usa_sdi", "San Diego FC", "SD", "#f5d200", "#111111", 73]
];
var TUR = [
  ["gal", "Galatasaray", "GAL", "#a90432", "#f5d200", 84],
  ["fen", "Fenerbah\xE7e", "FEN", "#f5d200", "#12326b", 83],
  ["bes", "Be\u015Fikta\u015F", "BJK", "#111111", "#ffffff", 80],
  ["tra", "Trabzonspor", "TRA", "#7a1c22", "#7ec8e3", 78],
  ["bas", "Ba\u015Fak\u015Fehir", "IBFK", "#12326b", "#f56600", 76],
  ["sam", "Samsunspor", "SAM", "#e30613", "#ffffff", 74],
  ["ant", "Antalyaspor", "ANT", "#e30613", "#ffffff", 72],
  ["kas", "Kas\u0131mpa\u015Fa", "KAS", "#12326b", "#ffffff", 71],
  ["kon", "Konyaspor", "KON", "#0a8f3c", "#ffffff", 71],
  ["ala_t", "Alanyaspor", "ALA", "#f56600", "#0a8f3c", 71],
  ["riz", "Rizespor", "RIZ", "#0a8f3c", "#7ec8e3", 70],
  ["gaz", "Gaziantep FK", "GFK", "#e30613", "#111111", 70],
  ["goz", "G\xF6ztepe", "GOZ", "#e30613", "#f5d200", 72],
  ["kay", "Kayserispor", "KAY", "#e30613", "#f5d200", 69],
  ["eyu", "Ey\xFCpspor", "EYU", "#5c2d91", "#f5d200", 69],
  ["kocae", "Kocaelispor", "KOC", "#0a8f3c", "#111111", 68],
  ["gen_t", "Gen\xE7lerbirli\u011Fi", "GEN", "#e30613", "#111111", 67],
  ["kar", "Karag\xFCmr\xFCk", "KAR", "#e30613", "#111111", 68]
];
var SAU = [
  ["hil", "Al Hilal", "HIL", "#12326b", "#ffffff", 85],
  ["nas", "Al Nassr", "NAS", "#f5d200", "#12326b", 84],
  ["ahl", "Al Ahli", "AHL", "#0a8f3c", "#ffffff", 83],
  ["itt", "Al Ittihad", "ITT", "#111111", "#f5d200", 84],
  ["qad", "Al Qadsiah", "QAD", "#f5d200", "#12326b", 78],
  ["shb", "Al Shabab", "SHB", "#f7f7f7", "#111111", 77],
  ["eti", "Al Ettifaq", "ETI", "#0a8f3c", "#ffffff", 75],
  ["taa", "Al Taawoun", "TAA", "#f5d200", "#111111", 75],
  ["fat", "Al Fateh", "FAT", "#12326b", "#ffffff", 73],
  ["kho", "Al Kholood", "KHO", "#e30613", "#111111", 70],
  ["rae", "Al Raed", "RAE", "#f5d200", "#111111", 70],
  ["fay", "Al Fayha", "FAY", "#e30613", "#ffffff", 71],
  ["kha", "Al Khaleej", "KHA", "#7ec8e3", "#111111", 71],
  ["ori", "Al Orobah", "ORO", "#0a8f3c", "#f5d200", 68],
  ["okh", "Al Okhdood", "OKH", "#e30613", "#111111", 68],
  ["riy", "Al Riyadh", "RIY", "#f7f7f7", "#12326b", 69],
  ["nah", "Al Najma", "NAJ", "#12326b", "#f5d200", 67],
  ["ham", "Al Hazem", "HAZ", "#e30613", "#f5d200", 67]
];
var SCO = [
  ["cel_s", "Celtic", "CEL", "#0a8f3c", "#ffffff", 81],
  ["ran", "Rangers", "RAN", "#12326b", "#e30613", 79],
  ["hib", "Hibernian", "HIB", "#0a8f3c", "#f7f7f7", 73],
  ["hea", "Heart of Midlothian", "HEA", "#7a1c22", "#f5d200", 73],
  ["abe", "Aberdeen", "ABE", "#e30613", "#ffffff", 73],
  ["dun", "Dundee United", "DUU", "#f56600", "#111111", 70],
  ["mot", "Motherwell", "MOT", "#f5d200", "#7a1c22", 70],
  ["kil", "Kilmarnock", "KIL", "#12326b", "#ffffff", 69],
  ["stj", "St Johnstone", "STJ", "#12326b", "#ffffff", 67],
  ["stm", "St Mirren", "STM", "#111111", "#f7f7f7", 68],
  ["fal", "Falkirk", "FAL", "#12326b", "#ffffff", 66],
  ["liv_s", "Livingston", "LIV", "#f5d200", "#111111", 65],
  ["dun_d", "Dundee FC", "DUN", "#12326b", "#e30613", 66],
  ["ros_c", "Ross County", "ROS", "#12326b", "#e30613", 64],
  ["par_s", "Partick Thistle", "PAR", "#f5d200", "#e30613", 64],
  ["ayr", "Ayr United", "AYR", "#111111", "#f7f7f7", 62],
  ["rai", "Raith Rovers", "RAI", "#12326b", "#ffffff", 62],
  ["que_s", "Queen's Park", "QPK", "#111111", "#f7f7f7", 61]
];
var BEL = [
  ["clb", "Club Brugge", "CLB", "#12326b", "#111111", 80],
  ["and", "Anderlecht", "AND", "#5c2d91", "#f7f7f7", 78],
  ["gnk", "KRC Genk", "GNK", "#12326b", "#f7f7f7", 78],
  ["usg", "Union Saint-Gilloise", "USG", "#f5d200", "#12326b", 79],
  ["aag", "KAA Gent", "GNT", "#12326b", "#f7f7f7", 76],
  ["ant_b", "Royal Antwerp", "ANT", "#e30613", "#111111", 75],
  ["cer", "Cercle Brugge", "CER", "#0a8f3c", "#111111", 73],
  ["std", "Standard Li\xE8ge", "STL", "#e30613", "#ffffff", 74],
  ["mec", "KV Mechelen", "MEC", "#f5d200", "#e30613", 72],
  ["ostend", "KV Oostende", "OST", "#e30613", "#f5d200", 68],
  ["cha_b", "Charleroi", "CHA", "#111111", "#f7f7f7", 72],
  ["lou", "Louvain", "OHL", "#f7f7f7", "#111111", 70],
  ["wes", "Westerlo", "WES", "#f5d200", "#12326b", 70],
  ["stt", "Sint-Truiden", "STT", "#f5d200", "#12326b", 70],
  ["den", "Dender", "DEN", "#e30613", "#ffffff", 66],
  ["beer", "Beerschot", "BEE", "#5c2d91", "#f7f7f7", 66],
  ["zul", "Zulte Waregem", "ZUL", "#e30613", "#0a8f3c", 68],
  ["lag_b", "La Louvi\xE8re", "LLV", "#e30613", "#f7f7f7", 65]
];
var JPN = [
  ["kaw", "Kawasaki Frontale", "KAW", "#7ec8e3", "#111111", 78],
  ["vis", "Vissel Kobe", "VIS", "#7a1c22", "#111111", 79],
  ["yok", "Yokohama F. Marinos", "YOK", "#12326b", "#e30613", 77],
  ["urw", "Urawa Red Diamonds", "URA", "#e30613", "#111111", 77],
  ["kas_j", "Kashima Antlers", "KAS", "#7a1c22", "#12326b", 78],
  ["gam", "Gamba Osaka", "GAM", "#12326b", "#111111", 75],
  ["cer_j", "Cerezo Osaka", "CER", "#e94b8a", "#111111", 75],
  ["fct", "FC Tokyo", "FCT", "#12326b", "#e30613", 74],
  ["san_j", "Sanfrecce Hiroshima", "SAN", "#5c2d91", "#f7f7f7", 77],
  ["nag", "Nagoya Grampus", "NAG", "#e30613", "#f5d200", 74],
  ["kas_k", "Kashiwa Reysol", "KSR", "#f5d200", "#111111", 75],
  ["shi", "Shimizu S-Pulse", "SHI", "#f56600", "#111111", 72],
  ["avs_j", "Avispa Fukuoka", "AVI", "#12326b", "#7ec8e3", 71],
  ["kyo", "Kyoto Sanga", "KYO", "#5c2d91", "#f5d200", 73],
  ["mac", "Machida Zelvia", "MAC", "#12326b", "#f7f7f7", 73],
  ["shonan", "Shonan Bellmare", "SHO", "#0a8f3c", "#7ec8e3", 70],
  ["nii", "Albirex Niigata", "NII", "#f5d200", "#12326b", 70],
  ["oka", "Fagiano Okayama", "OKA", "#e30613", "#111111", 69],
  ["jpn_tky", "Tokyo Verdy", "TKV", "#0a8f3c", "#ffffff", 70],
  ["jpn_jub", "J\xFAbilo Iwata", "JUB", "#7ec8e3", "#111111", 69]
];
var GRE = [
  ["gre_oly", "Olympiacos", "OLY", "#e30613", "#ffffff", 79],
  ["gre_pao", "Panathinaikos", "PAO", "#0a7a3c", "#ffffff", 77],
  ["gre_aek", "AEK Atenas", "AEK", "#f5c400", "#111111", 76],
  ["gre_paok", "PAOK", "PAO", "#111111", "#e30613", 76],
  ["gre_ari", "Aris", "ARI", "#f5c400", "#111111", 72],
  ["gre_ofi", "OFI Creta", "OFI", "#111111", "#f5c400", 69],
  ["gre_ath", "Athens Kallithea", "ATK", "#1f4fa0", "#ffffff", 66],
  ["gre_vol", "Volos", "VOL", "#1f78c1", "#e30613", 66],
  ["gre_lam", "Lamia", "LAM", "#0a7a3c", "#ffffff", 65],
  ["gre_pan", "Panserraikos", "PAN", "#e30613", "#111111", 64],
  ["gre_ast", "Asteras Tripolis", "AST", "#f5c400", "#1f4fa0", 67],
  ["gre_lev", "Levadiakos", "LEV", "#0a7a3c", "#f5c400", 64],
  ["gre_kif", "Kifisia", "KIF", "#1f4fa0", "#f5c400", 64],
  ["gre_ate", "Atromitos", "ATR", "#1f78c1", "#ffffff", 68],
  ["gre_ion", "Ionikos", "ION", "#7a1020", "#ffffff", 63],
  ["gre_ver", "Veria", "VER", "#e30613", "#1f4fa0", 63]
];
var SUI = [
  ["sui_ybb", "Young Boys", "YB", "#f5c400", "#111111", 77],
  ["sui_bas", "FC Basel", "BAS", "#e30613", "#1f4fa0", 76],
  ["sui_ser", "Servette", "SER", "#7a1020", "#ffffff", 74],
  ["sui_lug", "FC Lugano", "LUG", "#111111", "#ffffff", 73],
  ["sui_zur", "FC Z\xFCrich", "ZUR", "#1f4fa0", "#ffffff", 73],
  ["sui_stg", "St. Gallen", "STG", "#0a7a3c", "#ffffff", 72],
  ["sui_lau", "Lausanne", "LAU", "#1f4fa0", "#ffffff", 70],
  ["sui_luz", "FC Luzern", "LUZ", "#1f78c1", "#ffffff", 70],
  ["sui_sio", "FC Sion", "SIO", "#e30613", "#ffffff", 69],
  ["sui_win", "Winterthur", "WIN", "#e30613", "#ffffff", 66],
  ["sui_gra", "Grasshopper", "GRA", "#1f4fa0", "#ffffff", 68],
  ["sui_yve", "Yverdon", "YVE", "#0a7a3c", "#ffffff", 65],
  ["sui_thu", "FC Thun", "THU", "#e30613", "#f5f5f5", 67],
  ["sui_aar", "Aarau", "AAR", "#111111", "#ffffff", 65],
  ["sui_bel", "Bellinzona", "BEL", "#1f78c1", "#ffffff", 64],
  ["sui_ver", "Vaduz", "VAD", "#e30613", "#1f4fa0", 64]
];
var AUT = [
  ["aut_rbs", "Red Bull Salzburg", "RBS", "#e30613", "#f5c400", 79],
  ["aut_sturm", "Sturm Graz", "STU", "#111111", "#ffffff", 77],
  ["aut_rap", "Rapid Viena", "RAP", "#0a7a3c", "#ffffff", 74],
  ["aut_aus", "Austria Viena", "AUS", "#7a1020", "#ffffff", 73],
  ["aut_lask", "LASK", "LAS", "#111111", "#ffffff", 73],
  ["aut_wac", "Wolfsberger AC", "WAC", "#ffffff", "#111111", 71],
  ["aut_har", "Hartberg", "HAR", "#1f4fa0", "#ffffff", 69],
  ["aut_blw", "Blau-Wei\xDF Linz", "BWL", "#1f78c1", "#ffffff", 67],
  ["aut_alt", "Altach", "ALT", "#e30613", "#ffffff", 67],
  ["aut_kla", "Austria Klagenfurt", "KLA", "#7a1020", "#f5c400", 67],
  ["aut_ried", "SV Ried", "RIE", "#0a7a3c", "#ffffff", 65],
  ["aut_gak", "GAK", "GAK", "#e30613", "#111111", 65],
  ["aut_tir", "WSG Tirol", "TIR", "#0a7a3c", "#ffffff", 66],
  ["aut_stp", "St. P\xF6lten", "STP", "#f5c400", "#1f4fa0", 64],
  ["aut_dor", "Dornbirn", "DOR", "#e30613", "#f5c400", 63],
  ["aut_vor", "Vorw\xE4rts Steyr", "VOR", "#1f4fa0", "#e30613", 62]
];
var DEN = [
  ["den_cop", "FC K\xF8benhavn", "FCK", "#1f4fa0", "#ffffff", 78],
  ["den_mid", "FC Midtjylland", "FCM", "#111111", "#e30613", 77],
  ["den_bru", "Br\xF8ndby", "BIF", "#f5c400", "#1f4fa0", 74],
  ["den_nor", "FC Nordsj\xE6lland", "FCN", "#f5c400", "#e30613", 74],
  ["den_aal", "AaB Aalborg", "AAB", "#e30613", "#ffffff", 71],
  ["den_sil", "Silkeborg", "SIL", "#1f78c1", "#ffffff", 71],
  ["den_vib", "Viborg", "VIB", "#0a7a3c", "#ffffff", 70],
  ["den_ran", "Randers", "RAN", "#1f4fa0", "#ffffff", 70],
  ["den_lyn", "Lyngby", "LYN", "#1f78c1", "#f5c400", 68],
  ["den_ags", "AGF Aarhus", "AGF", "#ffffff", "#1f4fa0", 71],
  ["den_son", "S\xF8nderjyske", "SON", "#1f4fa0", "#f5c400", 68],
  ["den_ode", "OB Odense", "OB", "#1f4fa0", "#ffffff", 69],
  ["den_vej", "Vejle", "VEJ", "#e30613", "#ffffff", 66],
  ["den_hvi", "Hvidovre", "HVI", "#e30613", "#111111", 64],
  ["den_hob", "Hobro", "HOB", "#f5c400", "#111111", 63],
  ["den_fre", "Fredericia", "FRE", "#e30613", "#1f4fa0", 63]
];
var NOR = [
  ["nor_bod", "Bod\xF8/Glimt", "BOD", "#f5c400", "#111111", 78],
  ["nor_mol", "Molde", "MOL", "#1f78c1", "#ffffff", 76],
  ["nor_ros", "Rosenborg", "RBK", "#ffffff", "#111111", 74],
  ["nor_bra2b", "Brann", "BRA", "#e30613", "#ffffff", 73],
  ["nor_vik", "Viking", "VIK", "#1f4fa0", "#ffffff", 72],
  ["nor_lil", "Lillestr\xF8m", "LSK", "#f5c400", "#111111", 70],
  ["nor_tro", "Troms\xF8", "TIL", "#e30613", "#ffffff", 70],
  ["nor_val", "V\xE5lerenga", "VIF", "#1f4fa0", "#e30613", 70],
  ["nor_sar", "Sarpsborg 08", "SAR", "#1f4fa0", "#ffffff", 68],
  ["nor_hau", "Haugesund", "HAU", "#1f4fa0", "#ffffff", 68],
  ["nor_str", "Str\xF8msgodset", "STR", "#1f4fa0", "#ffffff", 68],
  ["nor_odd", "Odd", "ODD", "#ffffff", "#111111", 67],
  ["nor_kri", "Kristiansund", "KBK", "#1f78c1", "#ffffff", 66],
  ["nor_sand", "Sandefjord", "SAN", "#1f4fa0", "#f5c400", 65],
  ["nor_fre", "Fredrikstad", "FRE", "#e30613", "#ffffff", 66],
  ["nor_kfu", "KFUM Oslo", "KFU", "#0a7a3c", "#ffffff", 63]
];
var SWE = [
  ["swe_mal", "Malm\xF6 FF", "MFF", "#7ec8e3", "#ffffff", 77],
  ["swe_aik", "AIK", "AIK", "#111111", "#f5c400", 75],
  ["swe_ham", "Hammarby", "HAM", "#0a7a3c", "#ffffff", 75],
  ["swe_dju", "Djurg\xE5rden", "DIF", "#1f4fa0", "#e30613", 76],
  ["swe_elf", "Elfsborg", "ELF", "#f5c400", "#111111", 73],
  ["swe_ifk", "IFK G\xF6teborg", "IFK", "#1f4fa0", "#ffffff", 72],
  ["swe_hac", "H\xE4cken", "HAC", "#f5c400", "#111111", 73],
  ["swe_nor", "IFK Norrk\xF6ping", "IFK", "#1f4fa0", "#ffffff", 71],
  ["swe_sir", "Sirius", "SIR", "#1f4fa0", "#111111", 68],
  ["swe_mjo", "Mj\xE4llby", "MJA", "#f5c400", "#111111", 70],
  ["swe_kal", "Kalmar FF", "KAL", "#e30613", "#ffffff", 69],
  ["swe_var", "V\xE4rnamo", "VAR", "#e30613", "#ffffff", 66],
  ["swe_bro", "Brommapojkarna", "BP", "#e30613", "#111111", 66],
  ["swe_gais", "GAIS", "GAI", "#0a7a3c", "#111111", 65],
  ["swe_hal", "Halmstad", "HAL", "#1f4fa0", "#ffffff", 66],
  ["swe_deg", "Degerfors", "DEG", "#e30613", "#ffffff", 64]
];
var POL = [
  ["pol_leg", "Legia Vars\xF3via", "LEG", "#0a7a3c", "#ffffff", 76],
  ["pol_rak", "Rak\xF3w", "RAK", "#e30613", "#1f4fa0", 76],
  ["pol_lech", "Lech Pozna\u0144", "LEC", "#1f4fa0", "#ffffff", 75],
  ["pol_jag", "Jagiellonia", "JAG", "#f5c400", "#e30613", 74],
  ["pol_pog", "Pogo\u0144 Szczecin", "POG", "#1f4fa0", "#7a1020", 73],
  ["pol_cra", "Cracovia", "CRA", "#e30613", "#ffffff", 71],
  ["pol_wis", "Wis\u0142a Krak\xF3w", "WIS", "#ffffff", "#e30613", 70],
  ["pol_gor", "G\xF3rnik Zabrze", "GOR", "#1f4fa0", "#ffffff", 70],
  ["pol_sla", "\u015Al\u0105sk Wroc\u0142aw", "SLA", "#0a7a3c", "#ffffff", 70],
  ["pol_wid", "Widzew \u0141\xF3d\u017A", "WID", "#e30613", "#ffffff", 69],
  ["pol_pia", "Piast Gliwice", "PIA", "#e30613", "#1f4fa0", 68],
  ["pol_kor", "Korona Kielce", "KOR", "#f5c400", "#e30613", 66],
  ["pol_rad", "Radomiak", "RAD", "#0a7a3c", "#ffffff", 66],
  ["pol_zag", "Zag\u0142\u0119bie Lubin", "ZAG", "#f5820a", "#111111", 67],
  ["pol_mot", "Motor Lublin", "MOT", "#1f78c1", "#ffffff", 64],
  ["pol_puz", "Puszcza", "PUZ", "#0a7a3c", "#f5c400", 63]
];
var UKR = [
  ["ukr_sha", "Shakhtar Donetsk", "SHA", "#f5820a", "#111111", 80],
  ["ukr_dyn", "Dynamo Kyiv", "DYN", "#1f4fa0", "#ffffff", 79],
  ["ukr_dnp", "Dnipro-1", "DNP", "#1f4fa0", "#f5c400", 74],
  ["ukr_zor", "Zorya Luhansk", "ZOR", "#111111", "#f5c400", 73],
  ["ukr_kry", "Kryvbas", "KRY", "#e30613", "#1f4fa0", 71],
  ["ukr_ruk", "Rukh Lviv", "RUK", "#0a7a3c", "#ffffff", 69],
  ["ukr_obo", "Obolon", "OBO", "#1f78c1", "#0a7a3c", 68],
  ["ukr_ver", "Veres Rivne", "VER", "#0a7a3c", "#ffffff", 67],
  ["ukr_kol", "Kolos Kovalivka", "KOL", "#0a7a3c", "#f5c400", 68],
  ["ukr_pol", "Polissya", "POL", "#0a7a3c", "#f5c400", 71],
  ["ukr_ole", "Oleksandriya", "OLE", "#f5c400", "#111111", 70],
  ["ukr_lnz", "LNZ Cherkasy", "LNZ", "#1f4fa0", "#f5c400", 67],
  ["ukr_che", "Chornomorets", "CHO", "#1f4fa0", "#111111", 68],
  ["ukr_mvk", "Metalist 1925", "MET", "#f5820a", "#1f4fa0", 69],
  ["ukr_ing", "Inhulets", "INH", "#0a7a3c", "#ffffff", 65],
  ["ukr_liv", "Livyi Bereh", "LIV", "#111111", "#f5c400", 64]
];
var CHI = [
  ["chi_col", "Colo-Colo", "COL", "#111111", "#ffffff", 76],
  ["chi_uch", "Universidad de Chile", "UCH", "#1f4fa0", "#e30613", 75],
  ["chi_ucat", "Universidad Cat\xF3lica", "UC", "#ffffff", "#1f4fa0", 75],
  ["chi_hua", "Huachipato", "HUA", "#111111", "#f5c400", 71],
  ["chi_cob", "Cobresal", "COB", "#f5820a", "#111111", 70],
  ["chi_pal", "Palestino", "PAL", "#0a7a3c", "#e30613", 70],
  ["chi_uni", "Uni\xF3n Espa\xF1ola", "UE", "#e30613", "#ffffff", 69],
  ["chi_aud", "Audax Italiano", "AUD", "#0a7a3c", "#ffffff", 69],
  ["chi_ohi", "O'Higgins", "OHI", "#1f78c1", "#ffffff", 68],
  ["chi_ever", "Everton Vi\xF1a", "EVE", "#1f4fa0", "#f5c400", 67],
  ["chi_ibe", "\xD1ublense", "NUB", "#e30613", "#1f4fa0", 68],
  ["chi_coq", "Coquimbo Unido", "COQ", "#f5c400", "#111111", 68],
  ["chi_dip", "Deportes Iquique", "IQU", "#e30613", "#f5c400", 66],
  ["chi_lasr", "La Serena", "LSE", "#7a1020", "#ffffff", 65],
  ["chi_lim", "Deportes Limache", "LIM", "#0a7a3c", "#ffffff", 63],
  ["chi_cal", "Uni\xF3n La Calera", "CAL", "#e30613", "#111111", 66]
];
var COL = [
  ["col_atn", "Atl\xE9tico Nacional", "NAC", "#0a7a3c", "#ffffff", 77],
  ["col_mil", "Millonarios", "MIL", "#1f4fa0", "#ffffff", 75],
  ["col_jun", "Junior", "JUN", "#e30613", "#f5c400", 75],
  ["col_ame", "Am\xE9rica de Cali", "AME", "#e30613", "#ffffff", 74],
  ["col_dim", "Independiente Medell\xEDn", "DIM", "#e30613", "#1f4fa0", 73],
  ["col_san", "Santa Fe", "SFE", "#e30613", "#ffffff", 73],
  ["col_dep", "Deportivo Cali", "CAL", "#0a7a3c", "#ffffff", 72],
  ["col_ton", "Deportes Tolima", "TOL", "#f5c400", "#7a1020", 72],
  ["col_bug", "Bucaramanga", "BUC", "#f5c400", "#0a7a3c", 71],
  ["col_pas", "Deportivo Pasto", "PAS", "#e30613", "#111111", 68],
  ["col_ale", "Alianza FC", "ALI", "#e30613", "#f5c400", 67],
  ["col_env", "Envigado", "ENV", "#f5820a", "#111111", 66],
  ["col_equ", "La Equidad", "EQU", "#0a7a3c", "#ffffff", 67],
  ["col_pere", "Deportivo Pereira", "PER", "#e30613", "#f5c400", 69],
  ["col_cha", "Chic\xF3", "CHI", "#1f4fa0", "#f5c400", 65],
  ["col_hui", "Atl\xE9tico Huila", "HUI", "#f5c400", "#111111", 64]
];
var URU = [
  ["uru_pen", "Pe\xF1arol", "PEN", "#f5c400", "#111111", 76],
  ["uru_nac", "Nacional", "NAC", "#ffffff", "#1f4fa0", 76],
  ["uru_def", "Defensor Sporting", "DEF", "#7a1020", "#ffffff", 71],
  ["uru_lqu", "Liverpool FC", "LIV", "#111111", "#1f4fa0", 72],
  ["uru_mon", "Montevideo City", "MCT", "#7ec8e3", "#ffffff", 70],
  ["uru_dan", "Danubio", "DAN", "#1f4fa0", "#ffffff", 69],
  ["uru_wan", "Wanderers", "WAN", "#111111", "#ffffff", 68],
  ["uru_rac", "Racing Montevideo", "RAC", "#1f78c1", "#ffffff", 66],
  ["uru_cer", "Cerro Largo", "CER", "#0a7a3c", "#ffffff", 67],
  ["uru_pro", "Progreso", "PRO", "#e30613", "#111111", 66],
  ["uru_boston", "Boston River", "BOS", "#e30613", "#1f4fa0", 66],
  ["uru_ren", "Rentistas", "REN", "#1f4fa0", "#ffffff", 65],
  ["uru_mira", "Miramar Misiones", "MIR", "#0a7a3c", "#ffffff", 64],
  ["uru_pla", "Plaza Colonia", "PLA", "#f5c400", "#0a7a3c", 66],
  ["uru_juv", "Juventud", "JUV", "#1f4fa0", "#ffffff", 64],
  ["uru_cerr", "Cerro", "CRO", "#7ec8e3", "#111111", 65]
];
var AUS = [
  ["aus_mvc", "Melbourne Victory", "MVC", "#1f2a6b", "#f5c400", 73],
  ["aus_mcy", "Melbourne City", "MCY", "#7ec8e3", "#ffffff", 74],
  ["aus_syd", "Sydney FC", "SYD", "#7ec8e3", "#1f2a6b", 74],
  ["aus_wsw", "Western Sydney", "WSW", "#e30613", "#111111", 72],
  ["aus_cmr", "Central Coast", "CCM", "#f5c400", "#1f4fa0", 73],
  ["aus_adl", "Adelaide United", "ADL", "#e30613", "#111111", 71],
  ["aus_wel", "Wellington Phoenix", "WEL", "#f5c400", "#111111", 71],
  ["aus_bri", "Brisbane Roar", "BRI", "#f5820a", "#111111", 69],
  ["aus_mac", "Macarthur FC", "MAC", "#111111", "#7ec8e3", 69],
  ["aus_new", "Newcastle Jets", "NEW", "#1f4fa0", "#e30613", 68],
  ["aus_per", "Perth Glory", "PER", "#7a2ba0", "#ffffff", 67],
  ["aus_wun", "Western United", "WUN", "#0a7a3c", "#111111", 68],
  ["aus_auk", "Auckland FC", "AUK", "#1f2a6b", "#7ec8e3", 70],
  ["aus_can", "Canberra United", "CAN", "#1f78c1", "#ffffff", 65],
  ["aus_gcs", "Gold Coast", "GCS", "#f5c400", "#1f4fa0", 64],
  ["aus_tas", "Tasmania FC", "TAS", "#0a7a3c", "#f5c400", 63]
];
var KOR = [
  ["kor_uls", "Ulsan HD", "ULS", "#1f4fa0", "#f5c400", 76],
  ["kor_jeo", "Jeonbuk Hyundai", "JEO", "#0a7a3c", "#ffffff", 76],
  ["kor_poh", "Pohang Steelers", "POH", "#7a1020", "#111111", 74],
  ["kor_gwa", "Gwangju FC", "GWA", "#f5c400", "#111111", 73],
  ["kor_seo", "FC Seoul", "SEO", "#e30613", "#111111", 74],
  ["kor_dae", "Daegu FC", "DAE", "#7ec8e3", "#111111", 71],
  ["kor_gan", "Gangwon FC", "GAN", "#f5820a", "#1f4fa0", 72],
  ["kor_suw", "Suwon FC", "SUW", "#e30613", "#111111", 70],
  ["kor_inc", "Incheon United", "INC", "#1f4fa0", "#111111", 70],
  ["kor_jeju", "Jeju SK", "JEJ", "#f5820a", "#ffffff", 71],
  ["kor_gim", "Gimcheon Sangmu", "GIM", "#e30613", "#f5c400", 70],
  ["kor_ans", "Anyang", "ANY", "#7a2ba0", "#ffffff", 68],
  ["kor_ase", "Ansan Greeners", "ANS", "#0a7a3c", "#ffffff", 65],
  ["kor_bus", "Busan IPark", "BUS", "#e30613", "#111111", 67],
  ["kor_seon", "Seongnam FC", "SEO", "#111111", "#f5c400", 66],
  ["kor_cheo", "Cheonan City", "CHE", "#1f78c1", "#ffffff", 64]
];
var EGY = [
  ["egy_ahl", "Al Ahly", "AHL", "#e30613", "#ffffff", 78],
  ["egy_zam", "Zamalek", "ZAM", "#ffffff", "#e30613", 76],
  ["egy_pyr", "Pyramids FC", "PYR", "#1f4fa0", "#ffffff", 76],
  ["egy_ism", "Ismaily", "ISM", "#f5c400", "#111111", 71],
  ["egy_mas", "Al Masry", "MAS", "#0a7a3c", "#ffffff", 72],
  ["egy_cer", "Ceramica Cleopatra", "CER", "#7a1020", "#ffffff", 70],
  ["egy_ent", "Enppi", "ENP", "#e30613", "#111111", 69],
  ["egy_smo", "Smouha", "SMO", "#1f78c1", "#ffffff", 69],
  ["egy_nat", "National Bank", "NBE", "#0a7a3c", "#f5c400", 68],
  ["egy_fut", "Future FC", "FUT", "#f5820a", "#111111", 70],
  ["egy_pha", "Pharco", "PHA", "#1f4fa0", "#f5c400", 68],
  ["egy_mod", "Modern Sport", "MOD", "#0a7a3c", "#ffffff", 66],
  ["egy_gou", "El Gouna", "GOU", "#f5c400", "#1f78c1", 66],
  ["egy_baladi", "Baladiyat", "BAL", "#1f4fa0", "#ffffff", 65],
  ["egy_tal", "Tala'ea El Gaish", "GAI", "#0a7a3c", "#ffffff", 67],
  ["egy_zed", "ZED FC", "ZED", "#111111", "#f5c400", 64]
];
var ESP2 = [
  ["esp2_lev", "Levante", "LEV", "#1f4fa0", "#7a1020", 74],
  ["esp2_rac", "Racing Santander", "RAC", "#ffffff", "#0a7a3c", 74],
  ["esp2_alm", "Almer\xEDa", "ALM", "#e30613", "#ffffff", 73],
  ["esp2_ovi", "Real Oviedo", "OVI", "#1f4fa0", "#ffffff", 73],
  ["esp2_gra", "Granada", "GRA", "#e30613", "#1f4fa0", 73],
  ["esp2_cad", "C\xE1diz", "CAD", "#f5c400", "#1f4fa0", 72],
  ["esp2_spo", "Sporting Gij\xF3n", "SPO", "#e30613", "#ffffff", 72],
  ["esp2_zar", "Real Zaragoza", "ZAR", "#1f4fa0", "#ffffff", 71],
  ["esp2_dep", "Deportivo La Coru\xF1a", "DEP", "#1f78c1", "#ffffff", 72],
  ["esp2_hue", "Huesca", "HUE", "#1f4fa0", "#e30613", 70],
  ["esp2_eib", "Eibar", "EIB", "#7a1020", "#1f4fa0", 71],
  ["esp2_mir", "Mirand\xE9s", "MIR", "#e30613", "#111111", 69],
  ["esp2_cas", "Castell\xF3n", "CAS", "#111111", "#f5c400", 69],
  ["esp2_alb", "Albacete", "ALB", "#ffffff", "#111111", 68],
  ["esp2_bur", "Burgos", "BUR", "#111111", "#e30613", 68],
  ["esp2_mlg", "M\xE1laga", "MAL", "#1f4fa0", "#ffffff", 70],
  ["esp2_elc", "Elche", "ELC", "#0a7a3c", "#ffffff", 72],
  ["esp2_ten", "Tenerife", "TEN", "#1f4fa0", "#ffffff", 69],
  ["esp2_cor", "C\xF3rdoba", "COR", "#0a7a3c", "#ffffff", 68],
  ["esp2_fer", "Racing Ferrol", "FER", "#0a7a3c", "#ffffff", 67],
  ["esp2_val", "Real Valladolid", "VLL", "#7a1020", "#ffffff", 72],
  ["esp2_leg", "Legan\xE9s", "LEG", "#1f4fa0", "#ffffff", 71]
];
var ITA2 = [
  ["ita2_sam", "Sampdoria", "SAM", "#1f4fa0", "#ffffff", 73],
  ["ita2_pal", "Palermo", "PAL", "#e6559b", "#111111", 74],
  ["ita2_spe", "Spezia", "SPE", "#111111", "#f5f5f5", 73],
  ["ita2_cre", "Cremonese", "CRE", "#e30613", "#7a7a7a", 73],
  ["ita2_bar", "Bari", "BAR", "#e30613", "#ffffff", 72],
  ["ita2_cat", "Catanzaro", "CAT", "#f5c400", "#e30613", 71],
  ["ita2_ven", "Venezia", "VEN", "#f5820a", "#0a7a3c", 73],
  ["ita2_bre", "Brescia", "BRE", "#1f4fa0", "#ffffff", 71],
  ["ita2_mod", "Modena", "MOD", "#f5c400", "#1f4fa0", 70],
  ["ita2_sud", "S\xFCdtirol", "SUD", "#e30613", "#ffffff", 70],
  ["ita2_ces", "Cesena", "CES", "#111111", "#ffffff", 70],
  ["ita2_reg", "Reggiana", "REG", "#e30613", "#0a7a3c", 69],
  ["ita2_sas", "Salernitana", "SAL", "#7a1020", "#ffffff", 71],
  ["ita2_fro", "Frosinone", "FRO", "#f5c400", "#1f4fa0", 70],
  ["ita2_jus", "Juve Stabia", "JST", "#f5c400", "#1f4fa0", 68],
  ["ita2_man", "Mantova", "MAN", "#e30613", "#ffffff", 68],
  ["ita2_pis", "Pisa", "PIS", "#111111", "#7ec8e3", 71],
  ["ita2_cit", "Cittadella", "CIT", "#7a1020", "#12326b", 67],
  ["ita2_car", "Carrarese", "CAR", "#f5d200", "#1f4fa0", 67],
  ["ita2_cos", "Cosenza", "COS", "#e30613", "#1f4fa0", 67]
];
var GER2 = [
  ["ger2_hsv", "Hamburger SV", "HSV", "#1f4fa0", "#111111", 75],
  ["ger2_k", "1. FC K\xF6ln", "KOE", "#e30613", "#ffffff", 75],
  ["ger2_sch", "Schalke 04", "S04", "#1f4fa0", "#ffffff", 74],
  ["ger2_her", "Hertha BSC", "BSC", "#1f4fa0", "#ffffff", 74],
  ["ger2_dus", "Fortuna D\xFCsseldorf", "F95", "#e30613", "#ffffff", 73],
  ["ger2_nur", "1. FC N\xFCrnberg", "FCN", "#7a1020", "#111111", 72],
  ["ger2_kar", "Karlsruher SC", "KSC", "#1f4fa0", "#ffffff", 72],
  ["ger2_pad", "SC Paderborn", "SCP", "#1f4fa0", "#111111", 72],
  ["ger2_mag", "1. FC Magdeburg", "FCM", "#1f4fa0", "#ffffff", 72],
  ["ger2_kai", "Kaiserslautern", "FCK", "#e30613", "#ffffff", 72],
  ["ger2_elv", "SV Elversberg", "SVE", "#111111", "#f5c400", 71],
  ["ger2_bra", "Eintracht Braunschweig", "EBS", "#f5c400", "#1f4fa0", 69],
  ["ger2_gre", "Greuther F\xFCrth", "SGF", "#0a7a3c", "#ffffff", 70],
  ["ger2_ulm", "SSV Ulm", "ULM", "#ffffff", "#111111", 68],
  ["ger2_mun", "1860 M\xFCnchen", "M60", "#7ec8e3", "#ffffff", 69],
  ["ger2_ros", "Hansa Rostock", "HAN", "#1f4fa0", "#ffffff", 68],
  ["ger2_dar", "SV Darmstadt 98", "D98", "#1f4fa0", "#ffffff", 71],
  ["ger2_mst", "Preu\xDFen M\xFCnster", "PRM", "#0a7a3c", "#ffffff", 68]
];
var FRA2 = [
  ["fra2_sai", "Saint-\xC9tienne", "ASSE", "#0a7a3c", "#ffffff", 74],
  ["fra2_gui", "Guingamp", "GUI", "#e30613", "#111111", 71],
  ["fra2_lav", "Laval", "LAV", "#f5820a", "#111111", 70],
  ["fra2_ame", "Amiens", "AMI", "#111111", "#f5c400", 71],
  ["fra2_bas", "Bastia", "BAS", "#1f4fa0", "#ffffff", 70],
  ["fra2_gre", "Grenoble", "GRE", "#1f4fa0", "#e30613", 71],
  ["fra2_cle", "Clermont", "CLE", "#7a1020", "#1f4fa0", 71],
  ["fra2_pau", "Pau FC", "PAU", "#f5c400", "#1f4fa0", 69],
  ["fra2_dun", "Dunkerque", "DUN", "#7ec8e3", "#111111", 70],
  ["fra2_rod", "Rodez", "ROD", "#e30613", "#f5c400", 69],
  ["fra2_ajac", "AC Ajaccio", "ACA", "#e30613", "#ffffff", 69],
  ["fra2_ann", "Annecy", "ANN", "#e30613", "#ffffff", 68],
  ["fra2_mar", "Martigues", "MAR", "#f5c400", "#1f4fa0", 67],
  ["fra2_cae", "SM Caen", "CAE", "#e30613", "#1f4fa0", 70],
  ["fra2_lor", "Red Star", "RS", "#0a7a3c", "#ffffff", 68],
  ["fra2_troy", "Troyes", "TRO", "#7ec8e3", "#111111", 70],
  ["fra2_par", "Paris FC", "PFC", "#1f4fa0", "#ffffff", 72],
  ["fra2_nan", "AS Nancy", "ASN", "#e30613", "#ffffff", 67]
];
var HRV = [
  ["hrv_din", "Dinamo Zagreb", "DIN", "#1f4fa0", "#ffffff", 78],
  ["hrv_haj", "Hajduk Split", "HAJ", "#ffffff", "#1f4fa0", 76],
  ["hrv_rij", "Rijeka", "RIJ", "#ffffff", "#7ec8e3", 74],
  ["hrv_osi", "Osijek", "OSI", "#1f4fa0", "#ffffff", 73],
  ["hrv_lok", "Lokomotiva Zagreb", "LOK", "#7a1020", "#ffffff", 70],
  ["hrv_var", "Vara\u017Edin", "VAR", "#f5820a", "#111111", 68],
  ["hrv_ist", "Istra 1961", "IST", "#f5c400", "#0a7a3c", 68],
  ["hrv_gor", "Gorica", "GOR", "#111111", "#ffffff", 67],
  ["hrv_sla", "Slaven Belupo", "SLA", "#7ec8e3", "#ffffff", 67],
  ["hrv_sib", "\u0160ibenik", "SIB", "#f5820a", "#111111", 66],
  ["hrv_vuk", "Vukovar 91", "VUK", "#1f4fa0", "#f5c400", 65],
  ["hrv_rud", "Rude\u0161", "RUD", "#ffffff", "#1f4fa0", 65],
  ["hrv_int", "Inter Zapre\u0161i\u0107", "INT", "#0a7a3c", "#f5c400", 66],
  ["hrv_cib", "Cibalia", "CIB", "#111111", "#7ec8e3", 66]
];
var SRB = [
  ["srb_czv", "Crvena zvezda", "CZV", "#e30613", "#ffffff", 79],
  ["srb_par", "Partizan", "PAR", "#111111", "#ffffff", 77],
  ["srb_voj", "Vojvodina", "VOJ", "#e30613", "#ffffff", 72],
  ["srb_cuk", "\u010Cukari\u010Dki", "CUK", "#111111", "#ffffff", 71],
  ["srb_tsc", "TSC Ba\u010Dka Topola", "TSC", "#0a7a3c", "#111111", 70],
  ["srb_rad", "Radni\u010Dki Ni\u0161", "RAD", "#1f4fa0", "#ffffff", 68],
  ["srb_nap", "Napredak", "NAP", "#e30613", "#ffffff", 67],
  ["srb_mla", "Mladost Lu\u010Dani", "MLA", "#1f4fa0", "#ffffff", 67],
  ["srb_spk", "Spartak Subotica", "SPK", "#7ec8e3", "#ffffff", 67],
  ["srb_zem", "Zemun", "ZEM", "#1f4fa0", "#0a7a3c", 66],
  ["srb_jav", "Javor", "JAV", "#f5c400", "#111111", 66],
  ["srb_nov", "Novi Pazar", "NOV", "#1f4fa0", "#f5c400", 67],
  ["srb_voz", "Vo\u017Edovac", "VOZ", "#e30613", "#ffffff", 66],
  ["srb_rai", "Radni\u010Dki Kragujevac", "RAK", "#e30613", "#111111", 66]
];
var CZE = [
  ["cze_sla", "Slavia Praha", "SLA", "#e30613", "#ffffff", 78],
  ["cze_spa", "Sparta Praha", "SPA", "#7a1020", "#ffffff", 78],
  ["cze_plz", "Viktoria Plze\u0148", "PLZ", "#1f4fa0", "#e30613", 75],
  ["cze_ban", "Ban\xEDk Ostrava", "BAN", "#7ec8e3", "#ffffff", 72],
  ["cze_slo", "Slov\xE1cko", "SLK", "#1f4fa0", "#ffffff", 71],
  ["cze_lib", "Slovan Liberec", "LIB", "#1f4fa0", "#ffffff", 70],
  ["cze_sig", "Sigma Olomouc", "SIG", "#1f4fa0", "#ffffff", 70],
  ["cze_jab", "Jablonec", "JAB", "#0a7a3c", "#ffffff", 69],
  ["cze_tep", "Teplice", "TEP", "#f5c400", "#1f4fa0", 68],
  ["cze_boh", "Bohemians 1905", "BOH", "#0a7a3c", "#ffffff", 68],
  ["cze_mlb", "Mlad\xE1 Boleslav", "MLB", "#0a7a3c", "#ffffff", 69],
  ["cze_hra", "Hradec Kr\xE1lov\xE9", "HRA", "#111111", "#ffffff", 67],
  ["cze_pce", "Pardubice", "PCE", "#e30613", "#f5c400", 67],
  ["cze_kar", "Karvin\xE1", "KAR", "#0a7a3c", "#ffffff", 66]
];
var ROU = [
  ["rou_fcs", "FCSB", "FCS", "#e30613", "#1f4fa0", 76],
  ["rou_cfr", "CFR Cluj", "CFR", "#7a1020", "#ffffff", 75],
  ["rou_ucv", "Universitatea Craiova", "UCV", "#1f4fa0", "#ffffff", 74],
  ["rou_rap", "Rapid Bucure\u0219ti", "RAP", "#7a1020", "#f5c400", 73],
  ["rou_din", "Dinamo Bucure\u0219ti", "DIN", "#e30613", "#ffffff", 71],
  ["rou_far", "Farul Constan\u021Ba", "FAR", "#1f4fa0", "#7ec8e3", 70],
  ["rou_sep", "Sepsi OSK", "SEP", "#e30613", "#ffffff", 70],
  ["rou_pet", "Petrolul", "PET", "#f5c400", "#111111", 68],
  ["rou_uta", "UTA Arad", "UTA", "#e30613", "#ffffff", 68],
  ["rou_her", "Hermannstadt", "HER", "#e30613", "#111111", 67],
  ["rou_bot", "Boto\u0219ani", "BOT", "#e30613", "#ffffff", 67],
  ["rou_glm", "Gloria Buz\u0103u", "GLM", "#1f4fa0", "#e30613", 66],
  ["rou_otl", "O\u021Belul Gala\u021Bi", "OTL", "#e30613", "#1f4fa0", 66],
  ["rou_pol", "Poli Ia\u0219i", "POL", "#1f4fa0", "#ffffff", 66]
];
var PER = [
  ["per_uni", "Universitario", "UNI", "#f5f0dc", "#7a1020", 73],
  ["per_ali", "Alianza Lima", "ALI", "#1f2a5a", "#ffffff", 73],
  ["per_cri", "Sporting Cristal", "CRI", "#7ec8e3", "#ffffff", 74],
  ["per_mel", "FBC Melgar", "MEL", "#e30613", "#111111", 70],
  ["per_boy", "Sport Boys", "BOY", "#f582a0", "#ffffff", 67],
  ["per_cie", "Cienciano", "CIE", "#e30613", "#ffffff", 68],
  ["per_mun", "Deportivo Municipal", "MUN", "#e30613", "#ffffff", 67],
  ["per_val", "C\xE9sar Vallejo", "VAL", "#1f4fa0", "#f5820a", 68],
  ["per_gar", "Sport Huancayo", "HUA", "#e30613", "#f5c400", 67],
  ["per_utc", "UTC Cajamarca", "UTC", "#7ec8e3", "#111111", 66],
  ["per_adt", "ADT Tarma", "ADT", "#7ec8e3", "#ffffff", 66],
  ["per_gri", "Atl\xE9tico Grau", "GRI", "#f5c400", "#e30613", 66],
  ["per_ayc", "Ayacucho FC", "AYC", "#f5820a", "#111111", 66],
  ["per_com", "Comerciantes Unidos", "COM", "#1f4fa0", "#f5c400", 65]
];
var ECU = [
  ["ecu_ldu", "LDU Quito", "LDU", "#ffffff", "#e30613", 74],
  ["ecu_bsc", "Barcelona SC", "BSC", "#f5c400", "#111111", 73],
  ["ecu_idv", "Independiente del Valle", "IDV", "#111111", "#7ec8e3", 75],
  ["ecu_eme", "Emelec", "EME", "#1f4fa0", "#7ec8e3", 72],
  ["ecu_nac", "El Nacional", "NAC", "#e30613", "#ffffff", 68],
  ["ecu_auc", "Aucas", "AUC", "#f5c400", "#e30613", 68],
  ["ecu_del", "Delf\xEDn", "DEL", "#7ec8e3", "#111111", 67],
  ["ecu_tec", "T\xE9cnico Universitario", "TEC", "#e30613", "#ffffff", 67],
  ["ecu_msr", "Mushuc Runa", "MSR", "#0a7a3c", "#f5c400", 66],
  ["ecu_cat", "Universidad Cat\xF3lica", "CAT", "#7ec8e3", "#ffffff", 68],
  ["ecu_ore", "Orense", "ORE", "#0a7a3c", "#ffffff", 66],
  ["ecu_cue", "Deportivo Cuenca", "CUE", "#e30613", "#f5c400", 67],
  ["ecu_gua", "Guayaquil City", "GUA", "#7ec8e3", "#ffffff", 66],
  ["ecu_mac", "Macar\xE1", "MAC", "#7ec8e3", "#e30613", 66]
];
var PAR = [
  ["par_oli", "Olimpia", "OLI", "#ffffff", "#111111", 74],
  ["par_ccp", "Cerro Porte\xF1o", "CCP", "#1f4fa0", "#e30613", 73],
  ["par_lib", "Libertad", "LIB", "#111111", "#ffffff", 72],
  ["par_gua", "Guaran\xED", "GUA", "#f5c400", "#111111", 70],
  ["par_nac", "Nacional", "NAC", "#ffffff", "#e30613", 68],
  ["par_sol", "Sol de Am\xE9rica", "SOL", "#1f4fa0", "#ffffff", 67],
  ["par_luq", "Sportivo Luque\xF1o", "LUQ", "#1f4fa0", "#f5c400", 67],
  ["par_tac", "Tacuary", "TAC", "#111111", "#ffffff", 66],
  ["par_tri", "Sportivo Trinidense", "TRI", "#7ec8e3", "#ffffff", 66],
  ["par_gen", "General Caballero", "GEN", "#e30613", "#111111", 66],
  ["par_ame", "Sportivo Ameliano", "AME", "#1f4fa0", "#ffffff", 66],
  ["par_mai", "Deportivo Santan\xED", "SAN", "#111111", "#e30613", 65],
  ["par_rub", "Rubio \xD1u", "RUB", "#ffffff", "#0a7a3c", 65],
  ["par_fer", "Fernando de la Mora", "FDM", "#e30613", "#1f4fa0", 65]
];
var BOL = [
  ["bol_bol", "Bol\xEDvar", "BOL", "#7ec8e3", "#ffffff", 72],
  ["bol_str", "The Strongest", "STR", "#f5c400", "#111111", 72],
  ["bol_wil", "Jorge Wilstermann", "WIL", "#e30613", "#ffffff", 69],
  ["bol_blo", "Blooming", "BLO", "#7ec8e3", "#ffffff", 68],
  ["bol_oru", "Always Ready", "ALR", "#e30613", "#ffffff", 69],
  ["bol_ori", "Oriente Petrolero", "ORI", "#0a7a3c", "#ffffff", 68],
  ["bol_nac", "Nacional Potos\xED", "NAC", "#ffffff", "#e30613", 67],
  ["bol_tom", "Real Tomayapo", "TOM", "#0a7a3c", "#f5c400", 66],
  ["bol_gua", "Guabir\xE1", "GUB", "#e30613", "#ffffff", 66],
  ["bol_aur", "Aurora", "AUR", "#7ec8e3", "#ffffff", 66],
  ["bol_uni", "Universitario Vinto", "UNI", "#e30613", "#111111", 65],
  ["bol_rsc", "Real Santa Cruz", "RSC", "#ffffff", "#1f4fa0", 65],
  ["bol_saj", "San Antonio Bulo Bulo", "SAB", "#0a7a3c", "#ffffff", 65],
  ["bol_tot", "CD Totora Real Oruro", "TOT", "#f5820a", "#111111", 64]
];
var NGA = [
  ["nga_eny", "Enyimba", "ENY", "#1f4fa0", "#ffffff", 69],
  ["nga_ken", "Kano Pillars", "KAN", "#f5c400", "#0a7a3c", 67],
  ["nga_rem", "Remo Stars", "REM", "#1f4fa0", "#e30613", 68],
  ["nga_riv", "Rivers United", "RIV", "#e30613", "#ffffff", 68],
  ["nga_sho", "Shooting Stars", "SHO", "#7ec8e3", "#e30613", 66],
  ["nga_pla", "Plateau United", "PLA", "#f5c400", "#e30613", 66],
  ["nga_lob", "Lobi Stars", "LOB", "#e30613", "#ffffff", 66],
  ["nga_akr", "Akwa United", "AKW", "#e30613", "#1f4fa0", 65],
  ["nga_sun", "Sunshine Stars", "SUN", "#f5820a", "#1f4fa0", 65],
  ["nga_abw", "Abia Warriors", "ABW", "#e30613", "#f5c400", 65],
  ["nga_ens", "Enugu Rangers", "ENR", "#e30613", "#ffffff", 66],
  ["nga_hea", "Heartland", "HEA", "#e30613", "#f5c400", 65],
  ["nga_kwg", "Kwara United", "KWA", "#0a7a3c", "#f5c400", 65],
  ["nga_ben", "Bendel Insurance", "BEN", "#e30613", "#ffffff", 64]
];
var RSA = [
  ["rsa_sun", "Mamelodi Sundowns", "SUN", "#f5c400", "#1f4fa0", 76],
  ["rsa_pir", "Orlando Pirates", "PIR", "#111111", "#ffffff", 73],
  ["rsa_chi", "Kaizer Chiefs", "CHI", "#f5c400", "#111111", 72],
  ["rsa_sup", "SuperSport United", "SSU", "#1f4fa0", "#ffffff", 69],
  ["rsa_ctc", "Cape Town City", "CTC", "#1f4fa0", "#f5c400", 68],
  ["rsa_stl", "Stellenbosch", "STL", "#7a1020", "#ffffff", 68],
  ["rsa_ama", "AmaZulu", "AMA", "#0a7a3c", "#ffffff", 67],
  ["rsa_roy", "Royal AM", "ROY", "#f5820a", "#111111", 67],
  ["rsa_gol", "Lamontville Golden Arrows", "GOL", "#0a7a3c", "#f5c400", 66],
  ["rsa_chp", "Chippa United", "CHP", "#e30613", "#111111", 66],
  ["rsa_pol", "Polokwane City", "PLK", "#f5820a", "#0a7a3c", 66],
  ["rsa_sek", "Sekhukhune United", "SEK", "#e30613", "#f5c400", 66],
  ["rsa_tsg", "TS Galaxy", "TSG", "#e30613", "#7ec8e3", 65],
  ["rsa_ric", "Richards Bay", "RIC", "#1f4fa0", "#f5820a", 65]
];
var MAR = [
  ["mar_wyd", "Wydad Casablanca", "WYD", "#e30613", "#ffffff", 74],
  ["mar_raj", "Raja Casablanca", "RAJ", "#0a7a3c", "#ffffff", 74],
  ["mar_far", "AS FAR", "FAR", "#111111", "#e30613", 72],
  ["mar_ber", "RS Berkane", "BER", "#f5820a", "#111111", 71],
  ["mar_fus", "FUS Rabat", "FUS", "#e30613", "#ffffff", 68],
  ["mar_itt", "Ittihad Tanger", "ITT", "#7ec8e3", "#ffffff", 67],
  ["mar_ocs", "Olympic Safi", "SAF", "#1f4fa0", "#ffffff", 66],
  ["mar_has", "Hassania Agadir", "HAS", "#e30613", "#ffffff", 67],
  ["mar_mco", "Mouloudia Oujda", "MCO", "#0a7a3c", "#ffffff", 67],
  ["mar_scc", "Chabab Mohamm\xE9dia", "SCC", "#e30613", "#111111", 66],
  ["mar_jss", "Jeunesse Soualem", "SOU", "#1f4fa0", "#f5c400", 65],
  ["mar_utr", "Union Touarga", "TOU", "#0a7a3c", "#f5c400", 66],
  ["mar_mag", "Maghreb F\xE8s", "FES", "#f5c400", "#111111", 66],
  ["mar_dch", "Difa\xE2 El Jadida", "JAD", "#1f4fa0", "#0a7a3c", 65]
];
var QAT = [
  ["qat_sad", "Al-Sadd", "SAD", "#111111", "#ffffff", 75],
  ["qat_duh", "Al-Duhail", "DUH", "#e30613", "#ffffff", 74],
  ["qat_ray", "Al-Rayyan", "RAY", "#111111", "#e30613", 72],
  ["qat_ara", "Al-Arabi", "ARA", "#e30613", "#ffffff", 71],
  ["qat_gha", "Al-Gharafa", "GHA", "#f5c400", "#7ec8e3", 70],
  ["qat_wak", "Al-Wakrah", "WAK", "#7ec8e3", "#ffffff", 68],
  ["qat_ahl", "Al-Ahli", "AHL", "#0a7a3c", "#ffffff", 68],
  ["qat_sha", "Al-Shahania", "SHA", "#e30613", "#111111", 66],
  ["qat_umm", "Umm Salal", "UMM", "#f5820a", "#111111", 66],
  ["qat_kho", "Al-Khor", "KHO", "#1f4fa0", "#ffffff", 65],
  ["qat_mua", "Muaither", "MUA", "#f5820a", "#0a7a3c", 64],
  ["qat_mes", "Mesaimeer", "MES", "#1f4fa0", "#f5c400", 64],
  ["qat_sha2", "Al-Shamal", "SHM", "#e30613", "#ffffff", 65],
  ["qat_qsc", "Qatar SC", "QSC", "#f5c400", "#111111", 67]
];
var UAE = [
  ["uae_ain", "Al-Ain", "AIN", "#5b2d8e", "#ffffff", 74],
  ["uae_wah", "Al-Wahda", "WAH", "#7a1020", "#ffffff", 73],
  ["uae_jaz", "Al-Jazira", "JAZ", "#ffffff", "#1f4fa0", 72],
  ["uae_shj", "Sharjah", "SHJ", "#ffffff", "#1f4fa0", 70],
  ["uae_nas", "Al-Nasr", "NAS", "#1f4fa0", "#ffffff", 69],
  ["uae_was", "Al-Wasl", "WAS", "#f5c400", "#111111", 71],
  ["uae_shb", "Shabab Al-Ahli", "SHB", "#e30613", "#ffffff", 72],
  ["uae_ban", "Baniyas", "BAN", "#7ec8e3", "#ffffff", 67],
  ["uae_kal", "Ittihad Kalba", "KAL", "#e30613", "#ffffff", 67],
  ["uae_kho", "Khorfakkan", "KHF", "#0a7a3c", "#ffffff", 65],
  ["uae_ajm", "Ajman", "AJM", "#f5820a", "#111111", 66],
  ["uae_fuj", "Al-Fujairah", "FUJ", "#0a7a3c", "#111111", 64],
  ["uae_hrt", "Hatta", "HAT", "#7ec8e3", "#1f4fa0", 64],
  ["uae_dib", "Dibba Al-Hisn", "DIB", "#f5c400", "#1f4fa0", 64]
];
var THA = [
  ["tha_bur", "Buriram United", "BUR", "#1f2a5a", "#f5820a", 71],
  ["tha_bkk", "Bangkok United", "BKK", "#e30613", "#111111", 70],
  ["tha_mua", "Muangthong United", "MUA", "#e30613", "#111111", 68],
  ["tha_por", "Port FC", "POR", "#1f4fa0", "#f5820a", 67],
  ["tha_chb", "Chonburi", "CHB", "#7ec8e3", "#ffffff", 66],
  ["tha_rac", "Ratchaburi", "RAC", "#f5820a", "#111111", 66],
  ["tha_bgp", "BG Pathum United", "BGP", "#7ec8e3", "#f5c400", 69],
  ["tha_pol", "Police Tero", "POL", "#e30613", "#ffffff", 65],
  ["tha_nak", "Nakhon Ratchasima", "NAK", "#f5820a", "#111111", 65],
  ["tha_lam", "Lamphun Warriors", "LAM", "#e30613", "#ffffff", 64],
  ["tha_uth", "Uthai Thani", "UTH", "#0a7a3c", "#f5c400", 64],
  ["tha_kra", "Kasetsart", "KAS", "#0a7a3c", "#f5c400", 63],
  ["tha_suk", "Sukhothai", "SUK", "#f5c400", "#1f4fa0", 64],
  ["tha_pra", "Prachuap", "PRA", "#f5820a", "#ffffff", 65]
];
var IDN = [
  ["idn_pers", "Persib Bandung", "PERS", "#1f4fa0", "#ffffff", 68],
  ["idn_perj", "Persija Jakarta", "PERJ", "#f5820a", "#ffffff", 68],
  ["idn_bali", "Bali United", "BALI", "#e30613", "#ffffff", 69],
  ["idn_are", "Arema", "ARE", "#1f4fa0", "#ffffff", 66],
  ["idn_psm", "PSM Makassar", "PSM", "#e30613", "#ffffff", 66],
  ["idn_bor", "Borneo Samarinda", "BOR", "#f5820a", "#111111", 66],
  ["idn_dew", "Dewa United", "DEW", "#f5c400", "#111111", 66],
  ["idn_psis", "PSIS Semarang", "PSIS", "#1f4fa0", "#7ec8e3", 65],
  ["idn_mad", "Madura United", "MAD", "#e30613", "#ffffff", 65],
  ["idn_bar", "Barito Putera", "BAR", "#f5c400", "#1f4fa0", 64],
  ["idn_pby", "Persebaya Surabaya", "PBY", "#0a7a3c", "#ffffff", 66],
  ["idn_pss", "PSS Sleman", "PSS", "#0a7a3c", "#ffffff", 64],
  ["idn_persik", "Persik Kediri", "KED", "#5b2d8e", "#ffffff", 64],
  ["idn_semen", "Semen Padang", "SPD", "#e30613", "#f5c400", 63]
];
var CAN = [
  ["can_for", "Forge FC", "FOR", "#f5820a", "#111111", 67],
  ["can_cav", "Cavalry FC", "CAV", "#e30613", "#ffffff", 66],
  ["can_hfx", "HFX Wanderers", "HFX", "#7ec8e3", "#1f2a5a", 64],
  ["can_ott", "Atl\xE9tico Ottawa", "OTT", "#e30613", "#ffffff", 65],
  ["can_pac", "Pacific FC", "PAC", "#0a7a3c", "#7ec8e3", 64],
  ["can_val", "Valour FC", "VAL", "#111111", "#f5c400", 63],
  ["can_yor", "York United", "YOR", "#1f4fa0", "#0a7a3c", 63],
  ["can_van", "Vancouver FC", "VAN", "#7ec8e3", "#ffffff", 62]
];
function build3(id, name, country, flag, raw) {
  const clubs = raw.map(([cid, cname, short, primary, secondary, strength]) => ({
    id: cid,
    name: cname,
    short,
    league: id,
    primary,
    secondary,
    strength
  }));
  return { id, name, country, flag, clubs };
}
var BASE_LEAGUES = [
  build3("bra", "Brasileir\xE3o S\xE9rie A", "Brasil", "\u{1F1E7}\u{1F1F7}", BRA),
  build3("bra2", "Brasileir\xE3o S\xE9rie B", "Brasil", "\u{1F1E7}\u{1F1F7}", BRA2),
  build3("eng", "Premier League", "Inglaterra", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", ENG),
  build3("eng2", "EFL Championship", "Inglaterra", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", ENG2),
  build3("esp", "LaLiga", "Espanha", "\u{1F1EA}\u{1F1F8}", ESP),
  build3("ita", "Serie A", "It\xE1lia", "\u{1F1EE}\u{1F1F9}", ITA),
  build3("ger", "Bundesliga", "Alemanha", "\u{1F1E9}\u{1F1EA}", GER),
  build3("fra", "Ligue 1", "Fran\xE7a", "\u{1F1EB}\u{1F1F7}", FRA),
  build3("por", "Liga Portugal", "Portugal", "\u{1F1F5}\u{1F1F9}", POR),
  build3("ned", "Eredivisie", "Holanda", "\u{1F1F3}\u{1F1F1}", NED),
  build3("bel", "Pro League", "B\xE9lgica", "\u{1F1E7}\u{1F1EA}", BEL),
  build3("tur", "S\xFCper Lig", "Turquia", "\u{1F1F9}\u{1F1F7}", TUR),
  build3("sco", "Scottish Premiership", "Esc\xF3cia", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", SCO),
  build3("arg", "Liga Profesional", "Argentina", "\u{1F1E6}\u{1F1F7}", ARG),
  build3("mex", "Liga MX", "M\xE9xico", "\u{1F1F2}\u{1F1FD}", MEX),
  build3("usa", "Major League Soccer", "Estados Unidos", "\u{1F1FA}\u{1F1F8}", USA),
  build3("sau", "Saudi Pro League", "Ar\xE1bia Saudita", "\u{1F1F8}\u{1F1E6}", SAU),
  build3("jpn", "J1 League", "Jap\xE3o", "\u{1F1EF}\u{1F1F5}", JPN),
  build3("esp2", "LaLiga Hypermotion", "Espanha", "\u{1F1EA}\u{1F1F8}", ESP2),
  build3("ita2", "Serie B", "It\xE1lia", "\u{1F1EE}\u{1F1F9}", ITA2),
  build3("ger2", "2. Bundesliga", "Alemanha", "\u{1F1E9}\u{1F1EA}", GER2),
  build3("fra2", "Ligue 2", "Fran\xE7a", "\u{1F1EB}\u{1F1F7}", FRA2),
  build3("gre", "Super League", "Gr\xE9cia", "\u{1F1EC}\u{1F1F7}", GRE),
  build3("sui", "Super League Su\xED\xE7a", "Su\xED\xE7a", "\u{1F1E8}\u{1F1ED}", SUI),
  build3("aut", "Bundesliga Austr\xEDaca", "\xC1ustria", "\u{1F1E6}\u{1F1F9}", AUT),
  build3("den", "Superliga", "Dinamarca", "\u{1F1E9}\u{1F1F0}", DEN),
  build3("nor", "Eliteserien", "Noruega", "\u{1F1F3}\u{1F1F4}", NOR),
  build3("swe", "Allsvenskan", "Su\xE9cia", "\u{1F1F8}\u{1F1EA}", SWE),
  build3("pol", "Ekstraklasa", "Pol\xF4nia", "\u{1F1F5}\u{1F1F1}", POL),
  build3("ukr", "Premier Liha", "Ucr\xE2nia", "\u{1F1FA}\u{1F1E6}", UKR),
  build3("chi", "Primera Divisi\xF3n", "Chile", "\u{1F1E8}\u{1F1F1}", CHI),
  build3("col", "Liga BetPlay", "Col\xF4mbia", "\u{1F1E8}\u{1F1F4}", COL),
  build3("uru", "Primera Divisi\xF3n", "Uruguai", "\u{1F1FA}\u{1F1FE}", URU),
  build3("aus", "A-League", "Austr\xE1lia", "\u{1F1E6}\u{1F1FA}", AUS),
  build3("kor", "K League 1", "Coreia do Sul", "\u{1F1F0}\u{1F1F7}", KOR),
  build3("egy", "Premier League Eg\xEDpcia", "Egito", "\u{1F1EA}\u{1F1EC}", EGY),
  build3("hrv", "SuperSport HNL", "Cro\xE1cia", "\u{1F1ED}\u{1F1F7}", HRV),
  build3("srb", "SuperLiga", "S\xE9rvia", "\u{1F1F7}\u{1F1F8}", SRB),
  build3("cze", "Fortuna Liga", "Tch\xE9quia", "\u{1F1E8}\u{1F1FF}", CZE),
  build3("rou", "SuperLiga", "Rom\xEAnia", "\u{1F1F7}\u{1F1F4}", ROU),
  build3("per", "Liga 1", "Peru", "\u{1F1F5}\u{1F1EA}", PER),
  build3("ecu", "LigaPro", "Equador", "\u{1F1EA}\u{1F1E8}", ECU),
  build3("par", "Primera Divisi\xF3n", "Paraguai", "\u{1F1F5}\u{1F1FE}", PAR),
  build3("bol", "Divisi\xF3n Profesional", "Bol\xEDvia", "\u{1F1E7}\u{1F1F4}", BOL),
  build3("nga", "NPFL", "Nig\xE9ria", "\u{1F1F3}\u{1F1EC}", NGA),
  build3("rsa", "Betway Premiership", "\xC1frica do Sul", "\u{1F1FF}\u{1F1E6}", RSA),
  build3("mar", "Botola Pro", "Marrocos", "\u{1F1F2}\u{1F1E6}", MAR),
  build3("qat", "Stars League", "Catar", "\u{1F1F6}\u{1F1E6}", QAT),
  build3("uae", "Pro League", "Emirados \xC1rabes", "\u{1F1E6}\u{1F1EA}", UAE),
  build3("tha", "Thai League 1", "Tail\xE2ndia", "\u{1F1F9}\u{1F1ED}", THA),
  build3("idn", "Liga 1", "Indon\xE9sia", "\u{1F1EE}\u{1F1E9}", IDN),
  build3("can", "Premier League", "Canad\xE1", "\u{1F1E8}\u{1F1E6}", CAN),
  ...EXTRA_LEAGUES,
  ...WORLD_LEAGUES,
  ...API_LEAGUES,
  ...ACCESS_LEAGUES
];
var LEGACY_LEAGUES = BASE_LEAGUES.map((l) => ({
  ...l,
  clubs: applyLeagueFill(l.id, l.clubs)
}));
var legacyClubs = Object.fromEntries(
  LEGACY_LEAGUES.flatMap((l) => l.clubs).map((c) => [c.id, c])
);
var current = LEGACY_LEAGUES.filter((l) => !CATALOG_ALIASES[l.id]).map(
  (l) => applyMembership(l, legacyClubs)
);
for (const id of SERIE_D_IDS.slice(3))
  current.push(
    applyMembership(
      {
        id,
        name: `Brasileir\xE3o S\xE9rie D \xB7 Grupo A${SERIE_D_IDS.indexOf(id) + 1}`,
        country: "Brasil",
        flag: "\u{1F1E7}\u{1F1F7}",
        clubs: LEGACY_LEAGUES.find((l) => l.id === "y5079a").clubs
      },
      legacyClubs
    )
  );
current.push(
  applyMembership(
    { id: "x4683", name: "Danish 1st Division", country: "Dinamarca", flag: "\u{1F1E9}\u{1F1F0}", clubs: [] },
    legacyClubs
  )
);
var LEAGUES = current;
var CLUBS = {
  ...legacyClubs,
  ...Object.fromEntries(LEAGUES.flatMap((l) => l.clubs).map((c) => [c.id, c]))
};

// src/game/economy.ts
function valueFor(ovr, age) {
  const base = Math.pow(Math.max(0, ovr - 52), 2.15) / 55;
  const ageFactor = age <= 21 ? 1.5 : age <= 27 ? 1.35 : age <= 30 ? 1 : age <= 33 ? 0.55 : 0.25;
  return Math.round(Math.max(0.3, base * ageFactor) * 10) / 10;
}
function wageFor(ovr) {
  return Math.round(Math.max(2, Math.pow(Math.max(1, ovr - 48), 1.85) * 0.55));
}

// src/game/club-reference.ts
function safeClub(clubId) {
  return CLUBS[clubId] ?? {
    id: clubId,
    name: "Clube convidado",
    short: "CVD",
    league: "bra",
    primary: "#c9d2dc",
    secondary: "#1d2733",
    strength: 68
  };
}

// src/game/data/squads.ts
var NAMED_SQUADS = {
  fla: "GK|Rossi|30|84;DF|Varela|31|80;DF|L\xE9o Ortiz|29|82;DF|L\xE9o Pereira|29|81;DF|Ayrton Lucas|28|81;MF|Erick Pulgar|31|81;MF|Jorginho|34|83;MF|De La Cruz|28|84;MF|Arrascaeta|31|87;FW|Pedro|28|85;FW|Bruno Henrique|35|82;FW|Luiz Ara\xFAjo|29|80;MF|Everton Ribeiro|36|80;DF|Danilo|34|82",
  pal: "GK|Weverton|37|82;DF|Marcos Rocha|36|78;DF|Gustavo G\xF3mez|32|85;DF|Murilo|28|82;DF|Piquerez|27|82;MF|An\xEDbal Moreno|26|81;MF|Richard R\xEDos|25|82;MF|Raphael Veiga|30|83;FW|Est\xEAv\xE3o|18|84;FW|Vitor Roque|20|81;FW|Flaco L\xF3pez|24|81;MF|Maur\xEDcio|24|79;DF|Bruno Fuchs|26|78;GK|Marcelo Lomba|38|74",
  bot: "GK|John|29|80;DF|Vitinho|26|78;DF|Bastos|30|80;DF|Barboza|29|81;DF|Alex Telles|33|81;MF|Marlon Freitas|30|79;MF|Gregore|31|79;MF|Almada|24|84;FW|Savarino|28|81;FW|Igor Jesus|24|81;FW|Luiz Henrique|24|83;MF|Eduardo|29|78;DF|Jair|21|77;FW|J\xFAnior Santos|30|78",
  sao: "GK|Rafael|36|82;DF|Rafinha|40|76;DF|Arboleda|33|81;DF|Alan Franco|28|79;DF|Wendell|32|79;MF|Pablo Maia|23|80;MF|Alisson|32|79;MF|Oscar|34|82;MF|Lucas Moura|33|83;FW|Calleri|32|82;FW|Ferreirinha|28|79;MF|Bobadilla|22|77;DF|Sabino|28|77;GK|Jandrei|32|74",
  cor: "GK|Hugo Souza|26|81;DF|Matheuzinho|25|78;DF|Cac\xE1|26|78;DF|Andr\xE9 Ramalho|33|79;DF|Hugo|29|77;MF|Jos\xE9 Mart\xEDnez|31|79;MF|Raniele|29|78;MF|Rodrigo Garro|27|82;FW|Memphis Depay|32|85;FW|Yuri Alberto|24|82;FW|Talles Magno|23|78;MF|Maycon|28|77;DF|F\xE9lix Torres|28|78;GK|Matheus Donelli|23|72",
  mgo: "GK|Everson|35|81;DF|Saravia|33|77;DF|Lyanco|28|79;DF|Junior Alonso|32|80;DF|Guilherme Arana|28|82;MF|Ot\xE1vio|30|79;MF|Alan Franco|27|79;MF|Bernard|33|80;MF|Scarpa|31|81;FW|Hulk|39|84;FW|Rony|30|79;FW|Paulinho|25|81;DF|Battaglia|33|77;GK|Matheus Mendes|25|71",
  liv: "GK|Alisson|33|89;DF|Bradley|22|79;DF|Van Dijk|34|89;DF|Konat\xE9|26|85;DF|Kerkez|22|81;MF|Gravenberch|23|85;MF|Mac Allister|27|86;MF|Szoboszlai|25|85;FW|Salah|33|89;FW|Ekitik\xE9|23|83;FW|Gakpo|26|84;FW|Wirtz|22|87;DF|Robertson|31|84;GK|Mamardashvili|25|82",
  ars: "GK|Raya|30|85;DF|Timber|24|83;DF|Saliba|24|87;DF|Gabriel|28|86;DF|Calafiori|23|82;MF|Zubimendi|26|85;MF|\xD8degaard|27|87;MF|Rice|27|88;FW|Saka|24|87;FW|Gy\xF6keres|27|86;FW|Martinelli|24|83;MF|Merino|29|83;DF|White|28|83;GK|Kepa|31|79",
  mci: "GK|Ederson|32|86;DF|Nunes|27|80;DF|R\xFAben Dias|28|88;DF|Gvardiol|23|85;DF|Ak\xE9|30|82;MF|Rodri|29|90;MF|Bernardo Silva|31|86;MF|Reijnders|27|84;FW|Savinho|21|82;FW|Haaland|25|91;FW|Doku|23|83;MF|Foden|25|86;DF|Stones|31|84;GK|Ortega|32|78",
  che: "GK|S\xE1nchez|28|80;DF|Gusto|22|81;DF|Colwill|23|82;DF|Chalobah|26|80;DF|Cucurella|27|83;MF|Caicedo|24|86;MF|Fern\xE1ndez|25|84;MF|Palmer|23|87;FW|Neto|26|81;FW|Jo\xE3o Pedro|24|82;FW|Est\xEAv\xE3o|18|82;FW|Garnacho|21|81;DF|James|26|82;GK|J\xF6rgensen|24|76",
  tot: "GK|Vicario|29|83;DF|Porro|26|82;DF|Romero|27|85;DF|Van de Ven|24|83;DF|Udogie|23|81;MF|Bentancur|28|81;MF|Bergvall|19|79;MF|Sarr|23|80;FW|Kudus|25|83;FW|Richarlison|28|81;FW|Son|33|84;FW|Solanke|28|81;DF|Spence|25|78;GK|Kinsky|22|74",
  mun: "GK|Bay\u0131nd\u0131r|27|76;DF|Mazraoui|28|81;DF|De Ligt|26|84;DF|Yoro|20|80;DF|Shaw|30|80;MF|Casemiro|33|82;MF|Bruno Fernandes|31|87;MF|Mainoo|20|80;FW|Mbeumo|26|83;FW|\u0160e\u0161ko|22|82;FW|Cunha|26|83;FW|Amad|23|81;DF|Dalot|26|81;GK|Onana|29|79",
  rma: "GK|Courtois|33|89;DF|Trent|27|86;DF|Milit\xE3o|27|85;DF|Huijsen|20|82;DF|Carreras|23|80;MF|Tchouam\xE9ni|25|85;MF|Valverde|27|88;MF|Bellingham|22|89;FW|Mbapp\xE9|27|91;FW|Vin\xEDcius Jr|25|90;FW|Rodrygo|25|85;MF|G\xFCler|20|83;MF|Camavinga|23|84;GK|Lunin|26|79",
  bar: "GK|Joan Garc\xEDa|24|82;DF|Kound\xE9|27|85;DF|Cubars\xED|18|83;DF|Ara\xFAjo|26|84;DF|Balde|22|83;MF|De Jong|28|85;MF|Pedri|23|88;MF|Olmo|27|85;FW|Lamine Yamal|18|89;FW|Lewandowski|37|86;FW|Raphinha|29|88;FW|Ferran Torres|25|82;DF|Mart\xEDn|22|80;GK|Szcz\u0119sny|35|79",
  atm: "GK|Oblak|33|86;DF|Llorente|31|83;DF|Le Normand|29|83;DF|Gim\xE9nez|30|83;DF|Hancko|28|82;MF|Koke|34|81;MF|Barrios|22|82;MF|Baena|24|83;FW|Griezmann|34|86;FW|Juli\xE1n \xC1lvarez|26|87;FW|S\xF8rloth|30|82;MF|Simeone|30|80;DF|Molina|27|81;GK|Musso|31|76",
  ath_b: "GK|Sim\xF3n|31|85;DF|Gorosabel|29|78;DF|Vivian|26|82;DF|Paredes|26|80;DF|Yuri Berchiche|35|79;MF|Ruiz de Galarreta|32|79;MF|Jauregizar|22|80;MF|Sancet|25|83;FW|Nico Williams|23|85;FW|Guruzeta|26|79;FW|Berenguer|30|79;MF|I\xF1aki Williams|31|82;DF|Lekue|31|76;GK|Padilla|24|74",
  bet: "GK|Valles|27|78;DF|Beller\xEDn|30|78;DF|Natan|24|79;DF|Bartra|34|78;DF|Ricardo Rodr\xEDguez|33|76;MF|Marc Roca|29|79;MF|Fornals|29|80;MF|Lo Celso|29|82;FW|Antony|25|84;FW|Cucho Hern\xE1ndez|26|80;FW|Abde|23|80;MF|Isco|33|84;DF|Firpo|29|77;GK|Adri\xE1n|38|72",
  // A chave precisa ser o id real do clube em `leagues.ts` (`vil_e`). Com `vil`
  // o elenco ficava órfão e o Villarreal jogava com nomes gerados.
  vil_e: "GK|Luiz J\xFAnior|24|80;DF|Kiko Femen\xEDa|34|76;DF|Mar\xEDn|22|79;DF|Foyth|27|81;DF|Cardona|24|77;MF|Comesa\xF1a|26|80;MF|Parejo|36|82;MF|Buchanan|26|79;FW|P\xE9p\xE9|30|81;FW|Mikautadze|25|81;FW|Ayoze P\xE9rez|32|82;FW|Gerard Moreno|33|82;DF|Mouri\xF1o|22|77;GK|Tenas|26|72",
  int_i: "GK|Sommer|37|84;DF|Pavard|29|82;DF|Acerbi|37|82;DF|Bastoni|26|86;MF|Dumfries|29|83;MF|Barella|28|86;MF|\xC7alhano\u011Flu|31|85;MF|Mkhitaryan|36|82;MF|Dimarco|28|85;FW|Lautaro Mart\xEDnez|28|88;FW|Thuram|28|86;FW|Bonny|22|79;DF|de Vrij|33|80;GK|Mart\xEDnez|33|76",
  nap: "GK|Meret|28|82;DF|Di Lorenzo|32|84;DF|Rrahmani|31|83;DF|Buongiorno|26|83;DF|Olivera|28|81;MF|Lobotka|31|85;MF|Anguissa|30|84;MF|De Bruyne|34|87;FW|Politano|32|82;FW|Lukaku|32|84;FW|Neres|28|84;FW|H\xF8jlund|22|80;DF|Spinazzola|32|79;GK|Milinkovi\u0107-Savi\u0107|28|80",
  mil: "GK|Maignan|30|86;DF|Tomori|27|82;DF|Gabbia|26|79;DF|Pavlovi\u0107|24|80;MF|Saelemaekers|26|80;MF|Modri\u0107|40|83;MF|Fofana|26|83;MF|Ricci|24|80;MF|Bartesaghi|20|76;FW|Pulisic|27|85;FW|Le\xE3o|26|86;FW|Nkunku|28|83;DF|Estupi\xF1\xE1n|27|80;GK|Terracciano|22|71",
  juv_i: "GK|Di Gregorio|28|81;DF|Kalulu|25|81;DF|Bremer|28|85;DF|Kelly|27|79;MF|Cambiaso|25|82;MF|Locatelli|27|82;MF|Thuram|24|82;MF|McKennie|27|80;FW|Y\u0131ld\u0131z|20|84;FW|Vlahovi\u0107|25|84;FW|David|25|83;FW|Openda|25|81;DF|Cabal|24|77;GK|Perin|33|76",
  ata: "GK|Carnesecchi|25|82;DF|Hien|26|81;DF|Djimsiti|32|80;DF|Kola\u0161inac|32|79;MF|Bellanova|25|81;MF|de Roon|34|81;MF|\xC9derson|26|84;MF|Zappacosta|33|79;FW|Lookman|28|85;FW|De Ketelaere|24|83;FW|Scamacca|27|81;FW|Krstovi\u0107|25|80;DF|Scalvini|22|80;GK|Sportiello|33|73",
  rom: "GK|Svilar|26|84;DF|Mancini|29|81;DF|N'Dicka|26|82;DF|Hermoso|30|79;MF|Wesley|22|79;MF|Kon\xE9|24|84;MF|Cristante|30|80;MF|Angeli\xF1o|28|81;FW|Soul\xE9|22|81;FW|Dybala|32|84;FW|Ferguson|21|79;FW|Pellegrini|29|82;DF|\xC7elik|28|77;GK|Gollini|30|72"
};
var NAME_POOLS = {
  bra: {
    first: [
      "Lucas",
      "Gabriel",
      "Matheus",
      "Rafael",
      "Bruno",
      "Thiago",
      "Vin\xEDcius",
      "Pedro",
      "Jo\xE3o",
      "Felipe",
      "Caio",
      "Douglas",
      "Everton",
      "Wesley",
      "Igor",
      "Diego",
      "Marcelo",
      "Rodrigo",
      "Andr\xE9",
      "Kaio"
    ],
    last: [
      "Silva",
      "Santos",
      "Oliveira",
      "Souza",
      "Pereira",
      "Costa",
      "Almeida",
      "Ribeiro",
      "Carvalho",
      "Barbosa",
      "Rocha",
      "Nascimento",
      "Moreira",
      "Cardoso",
      "Teixeira",
      "Gomes",
      "Lima",
      "Ara\xFAjo",
      "Freitas",
      "Martins"
    ]
  },
  eng: {
    first: [
      "Harry",
      "Jack",
      "Callum",
      "Tyler",
      "Reece",
      "Ollie",
      "Conor",
      "Ethan",
      "Lewis",
      "Mason",
      "Josh",
      "Kyle",
      "Ryan",
      "Dominic",
      "Jordan",
      "Sam",
      "Nathan",
      "Elliot",
      "Charlie",
      "Aaron"
    ],
    last: [
      "Walker",
      "Bennett",
      "Ainsley",
      "Cartwright",
      "Hughes",
      "Doyle",
      "Marsden",
      "Whitmore",
      "Ellison",
      "Radford",
      "Kirby",
      "Sinclair",
      "Prescott",
      "Holloway",
      "Fenton",
      "Barlow",
      "Trescott",
      "Nolan",
      "Gale",
      "Rowntree"
    ]
  },
  esp: {
    first: [
      "\xC1lvaro",
      "Sergio",
      "Iker",
      "Marcos",
      "Javi",
      "Rub\xE9n",
      "Pablo",
      "Adri\xE1n",
      "Unai",
      "Aitor",
      "Hugo",
      "Dani",
      "Mateo",
      "Nacho",
      "\xD3scar",
      "Jorge",
      "Iv\xE1n",
      "Bruno",
      "Manu",
      "Gonzalo"
    ],
    last: [
      "Herrera",
      "Navarro",
      "Cabrera",
      "Iglesias",
      "Ferrer",
      "Cuenca",
      "Salazar",
      "Otero",
      "Vidal",
      "Bermejo",
      "Lozano",
      "Aranda",
      "Peralta",
      "Ib\xE1\xF1ez",
      "Rueda",
      "Segura",
      "Villar",
      "Montero",
      "Escudero",
      "Nieto"
    ]
  },
  ita: {
    first: [
      "Marco",
      "Luca",
      "Andrea",
      "Matteo",
      "Davide",
      "Simone",
      "Alessio",
      "Federico",
      "Nicol\xF2",
      "Giacomo",
      "Lorenzo",
      "Tommaso",
      "Riccardo",
      "Filippo",
      "Emanuele",
      "Pietro",
      "Samuele",
      "Cristian",
      "Manuel",
      "Gian"
    ],
    last: [
      "Ferrari",
      "Rinaldi",
      "Bellotti",
      "Marchetti",
      "Costanzo",
      "Palmieri",
      "Baldini",
      "Fontana",
      "Serra",
      "Gallo",
      "Mancuso",
      "Rizzo",
      "Vitale",
      "Grassi",
      "Bianco",
      "Sartori",
      "Perrone",
      "Zanetti",
      "Caruso",
      "Neri"
    ]
  }
};

// src/game/data/names.ts
var P = (first, last) => ({
  first: first.split(","),
  last: last.split(",")
});
var POOLS = {
  ...NAME_POOLS,
  ger: P(
    "Lukas,Jonas,Niklas,Maximilian,Felix,Tim,Leon,Moritz,Fabian,Julian,Marvin,Sven,Kai,Tobias,Jannik",
    "M\xFCller,Schneider,Wagner,Becker,Hoffmann,Schulz,Kr\xFCger,Neumann,Brandt,Keller,Vogel,Hartmann,Ziegler,B\xF6hm,Reuter"
  ),
  fra: P(
    "Lucas,Th\xE9o,Enzo,Hugo,Nathan,Mathis,Yanis,Cl\xE9ment,Baptiste,Corentin,Amine,Kylian,Noah,Antoine,Rayan",
    "Dubois,Lef\xE8vre,Moreau,Girard,Bonnet,Rousseau,Perrin,Fontaine,Chevalier,Barbier,Renard,Marchand,Leroy,Dumont,Colin"
  ),
  por: P(
    "Jo\xE3o,Diogo,R\xFAben,Tom\xE1s,Gon\xE7alo,Rafael,Miguel,Andr\xE9,Francisco,Duarte,Afonso,Tiago,Vasco,Bernardo,Salvador",
    "Ferreira,Sousa,Fonseca,Marques,Machado,Neves,Cardoso,Faria,Baptista,Antunes,Matias,Ramos,Pinto,Coelho,Tavares"
  ),
  ned: P(
    "Daan,Sven,Bram,Lars,Jesse,Thijs,Ruben,Stijn,Joris,Milan,Sem,Teun,Koen,Jurri\xEBn,Rik",
    "de Vries,van Dijk,Bakker,Jansen,Visser,Smit,Meijer,de Boer,Mulder,Bos,Vermeulen,van Leeuwen,Hendriks,Dekker,Willems"
  ),
  bel: P(
    "Arthur,Louis,Victor,Matteo,Jules,Wout,Senne,Lander,Siebe,Thibaut,Maxime,Gilles,Aster,Lucas,Noa",
    "Peeters,Janssens,Maes,Willems,Claes,Goossens,Wouters,De Smet,Declercq,Vandenberghe,Lambert,Dupont,Mertens,Segers,Coppens"
  ),
  tur: P(
    "Emre,Burak,Kerem,Yusuf,Mert,Ozan,Halil,Berkay,Enes,Arda,Cengiz,Bar\u0131\u015F,Tolga,Serdar,Umut",
    "Y\u0131lmaz,Kaya,Demir,\xC7elik,\u015Eahin,Y\u0131ld\u0131z,Ayd\u0131n,\xD6zt\xFCrk,Arslan,Do\u011Fan,K\u0131l\u0131\xE7,Aslan,Ko\xE7,Polat,Erdem"
  ),
  sco: P(
    "Callum,Ryan,Kieran,Lewis,Scott,Fraser,Grant,Blair,Euan,Struan,Angus,Rory,Cameron,Craig,Murray",
    "MacLeod,Fraser,Campbell,Ferguson,Stewart,MacKay,Robertson,Murray,Hendry,Gallacher,Boyle,Douglas,Kinnear,Rankin,Sinclair"
  ),
  arg: P(
    "Santiago,Juli\xE1n,Facundo,Lautaro,Franco,Agust\xEDn,Tom\xE1s,Nicol\xE1s,Valent\xEDn,Joaqu\xEDn,Ezequiel,Mat\xEDas,Bruno,Ignacio,Thiago",
    "Gonz\xE1lez,Rodr\xEDguez,Fern\xE1ndez,Dom\xEDnguez,Sosa,Acosta,Ben\xEDtez,Quiroga,Ibarra,Ojeda,Cabrera,Peralta,Villalba,C\xE1ceres,Aguirre"
  ),
  mex: P(
    "Diego,\xC1ngel,Emilio,Kevin,Iker,Erick,Alexis,Uriel,Jes\xFAs,Roberto,Marco,\xD3scar,Israel,Rodolfo,Brian",
    "Hern\xE1ndez,Ram\xEDrez,Torres,V\xE1zquez,Reyes,Mendoza,Guzm\xE1n,Salazar,Cervantes,Zamora,Ibarra,Alvarado,Rivas,Escobar,N\xE1jera"
  ),
  usa: P(
    "Tyler,Brandon,Cole,Aidan,Caleb,Preston,Miles,Jaden,Chase,Dylan,Grant,Hunter,Trevor,Bryce,Landon",
    "Miller,Johnson,Peterson,Brooks,Hayes,Nelson,Reynolds,Carter,Sullivan,Bishop,Foster,Gallagher,Whitaker,Sanders,Lowry"
  ),
  sau: P(
    "Mohammed,Abdullah,Faisal,Salem,Nasser,Turki,Khalid,Yasser,Sultan,Bandar,Ziyad,Hattan,Fahad,Majed,Rakan",
    "Al-Harbi,Al-Otaibi,Al-Qahtani,Al-Ghamdi,Al-Dawsari,Al-Shehri,Al-Zahrani,Al-Mutairi,Al-Amri,Al-Buraikan,Al-Najei,Al-Faraj,Al-Hassan,Al-Sulaiman,Al-Yami"
  ),
  jpn: P(
    "Sota,Ren,Haruto,Yuto,Kaito,Riku,Sora,Takumi,Daiki,Hiroto,Kenta,Yuki,Shota,Ryo,Asahi",
    "Tanaka,Suzuki,Sato,Watanabe,Nakamura,Yamamoto,Kobayashi,Kato,Yoshida,Matsumoto,Inoue,Kimura,Hayashi,Saito,Ito"
  ),
  gre: P(
    "Giorgos,Dimitris,Nikos,Kostas,Christos,Vasilis,Panagiotis,Thanasis,Stelios,Manolis,Alexis,Petros,Andreas,Ilias,Sotiris",
    "Papadopoulos,Nikolaidis,Georgiou,Vlachos,Karagiannis,Samaras,Fotiadis,Michailidis,Stavrou,Antoniou,Dimitriou,Katsaros,Pappas,Rallis,Zafeiris"
  ),
  sui: P(
    "Noah,Elias,Levin,Nico,Yannick,Silvan,Loris,Dario,Andrin,Timo,Cedric,Joel,Robin,Nevio,Gian",
    "Meier,Steiner,Baumann,Frei,Zimmermann,Aebischer,Schmid,Widmer,Kobel,Rieder,Furrer,Marchand,Sierro,Amdouni,Stergiou"
  ),
  aut: P(
    "Marcel,Stefan,Manuel,Patrick,Christoph,Florian,Dominik,Andreas,Lukas,Matthias,Sascha,Thomas,Nico,Raphael,Simon",
    "Gruber,Huber,Wimmer,Steinbauer,Lechner,Reiter,Fuchs,Pichler,Hofer,Berger,Egger,Moser,Wieser,Baumgartner,Schlager"
  ),
  den: P(
    "Mikkel,Rasmus,Frederik,Emil,Magnus,Anders,Jonas,Nikolaj,Oliver,Kasper,Victor,Lasse,Tobias,Alexander,Mathias",
    "Nielsen,Jensen,Hansen,Andersen,Pedersen,Kristensen,Larsen,S\xF8rensen,Poulsen,Mortensen,Bech,Skov,Vestergaard,Holm,Damsgaard"
  ),
  nor: P(
    "Sander,Kristian,Ole,H\xE5kon,J\xF8rgen,Mathias,Sondre,Andreas,Emil,Fredrik,Martin,Erling,Tobias,Isak,Aron",
    "Hansen,Johansen,Olsen,Larsen,Andersen,Nilsen,Berg,Haugen,Solberg,Lund,Dahl,Strand,Moe,Bakken,Vetlesen"
  ),
  swe: P(
    "Oskar,Elias,Viktor,Anton,Hugo,Filip,Axel,Melker,Isak,Gustav,Emil,Linus,Alfons,Ludvig,Noel",
    "Andersson,Johansson,Karlsson,Nilsson,Eriksson,Larsson,Olsson,Persson,Svensson,Lindberg,Bergstr\xF6m,Holmgren,Falk,Wahlstr\xF6m,Sundgren"
  ),
  pol: P(
    "Jakub,Bartosz,Kacper,Mateusz,Szymon,Filip,Micha\u0142,Piotr,Kamil,Damian,Krzysztof,Adrian,Tomasz,Wojciech,Dawid",
    "Kowalski,Nowak,Wi\u015Bniewski,Zieli\u0144ski,Lewandowski,Wo\u017Aniak,Kami\u0144ski,Kaczmarek,Grabowski,Pawlak,Jankowski,Szyma\u0144ski,Adamczyk,Sikora,Marciniak"
  ),
  ukr: P(
    "Oleksandr,Andriy,Danylo,Bohdan,Ivan,Mykola,Yehor,Vitalii,Serhii,Roman,Taras,Artem,Vladyslav,Denys,Maksym",
    "Shevchenko,Kovalenko,Bondarenko,Tkachenko,Melnyk,Kravchuk,Rudenko,Sydorenko,Zinchenko,Lysenko,Petrenko,Havrylenko,Moroz,Yaremchuk,Bondar"
  ),
  chi: P(
    "Mat\xEDas,Benjam\xEDn,Crist\xF3bal,Vicente,Ignacio,Felipe,Basti\xE1n,Nicol\xE1s,Diego,Maximiliano,Renato,Gonzalo,Esteban,Camilo,Luciano",
    "Mu\xF1oz,Contreras,Fuentes,Vargas,Aravena,Sep\xFAlveda,Cort\xE9s,Bravo,Riquelme,Vald\xE9s,Tapia,Z\xFA\xF1iga,Palacios,N\xFA\xF1ez,Galdames"
  ),
  col: P(
    "Juan,Santiago,Andr\xE9s,Camilo,Sebasti\xE1n,Yerson,Jhon,Daniel,Luis,Kevin,\xD3scar,Steven,Cristian,Wilmar,Duv\xE1n",
    "Rodr\xEDguez,Moreno,Cuadrado,Arias,Mosquera,Rinc\xF3n,Zapata,Palacios,Borja,Uribe,Cardona,Quintero,Murillo,Barrios,Sinisterra"
  ),
  uru: P(
    "Facundo,Rodrigo,Mauro,Nicol\xE1s,Bruno,Federico,Emiliano,Agust\xEDn,Sebasti\xE1n,Diego,Maximiliano,Gast\xF3n,Santiago,Manuel,Cristian",
    "Rodr\xEDguez,Silva,Pereira,Cavani,N\xFA\xF1ez,Olivera,Bentancur,Vi\xF1a,C\xE1ceres,Ugarte,Rossi,G\xF3mez,P\xEDriz,Amaral,De la Cruz"
  ),
  aus: P(
    "Jack,Riley,Cooper,Lachlan,Zac,Connor,Harrison,Jayden,Mitchell,Angus,Bailey,Declan,Kai,Josh,Nathaniel",
    "Wilson,Thompson,Anderson,Baxter,Ryan,Coleman,Kennedy,Grant,Hudson,Fletcher,Marshall,Barnes,O'Neill,Tilio,Metcalfe"
  ),
  kor: P(
    "Min-jae,Ji-sung,Hee-chan,Seung-ho,Woo-young,Jae-sung,Kang-in,Young-jun,Tae-hwan,Dong-gyeong,Hyun-woo,Sang-ho,Jun-ho,Ui-jo,Chan-hee",
    "Kim,Lee,Park,Choi,Jung,Kang,Cho,Yoon,Jang,Lim,Han,Oh,Seo,Shin,Hwang"
  ),
  egy: P(
    "Mohamed,Ahmed,Mahmoud,Omar,Youssef,Karim,Hossam,Ramadan,Mostafa,Amr,Tarek,Emam,Zizo,Marwan,Islam",
    "Salah,Hegazi,Elneny,Abdelmonem,Fathi,Trezeguet,Sobhi,Kahraba,Shenawy,Attia,Magdy,Gabaski,Fatouh,Sherif,Zaki"
  ),
  hrv: P(
    "Luka,Marko,Ivan,Petar,Josip,Ante,Filip,Domagoj,Bruno,Lovro,Nikola,Tin,Fran,Mateo,Dario",
    "Modri\u0107,Kova\u010D,Peri\u0161i\u0107,Brozovi\u0107,Vida,Livakovi\u0107,Gvardiol,Petkovi\u0107,Bari\u0161i\u0107,Juranovi\u0107,Su\u010Di\u0107,\u0106aleta,Vla\u0161i\u0107,Or\u0161i\u0107,Budimir"
  ),
  srb: P(
    "Luka,Nikola,Du\u0161an,Filip,Nemanja,Sergej,Strahinja,Milo\u0161,Aleksa,Veljko,Stefan,Ivan,Marko,Uro\u0161,Dejan",
    "Jovi\u0107,Ili\u0107,Tadi\u0107,Kosti\u0107,Gudelj,Pavlovi\u0107,Milinkovi\u0107,Stojanovi\u0107,Terzi\u0107,Birman\u010Devi\u0107,Mitrovi\u0107,Risti\u0107,Gruji\u0107,Zivkovi\u0107,Ristanovi\u0107"
  ),
  cze: P(
    "Jan,Tom\xE1\u0161,Patrik,Luk\xE1\u0161,Adam,Ond\u0159ej,Michal,Jakub,David,Filip,Mat\u011Bj,V\xE1clav,Anton\xEDn,Pavel,Marek",
    "Nov\xE1k,Svoboda,Dvo\u0159\xE1k,Proch\xE1zka,\u010Cern\xFD,Ku\u010Dera,Vesel\xFD,Posp\xED\u0161il,Jel\xEDnek,Kr\xE1l,H\xE1jek,Bene\u0161,Krej\u010D\xED,Hlav\xE1\u010Dek,Sedl\xE1\u010Dek"
  ),
  rou: P(
    "Andrei,Alexandru,Darius,Ianis,Florin,Denis,Radu,George,Nicolae,Claudiu,Marius,Daniel,R\u0103zvan,Octavian,Valentin",
    "Popescu,Ionescu,Popa,Stan,Dumitrescu,Marin,Constantin,Gheorghe,Munteanu,Stanciu,Man,Dr\u0103gu\u0219,Olaru,B\xEErligea,Mih\u0103il\u0103"
  ),
  per: P(
    "Jos\xE9,Paolo,Andr\xE9,Christian,Edison,Luis,Yoshimar,Alex,Jefferson,Renato,Christofer,Carlos,Miguel,Andy,Bernardo",
    "Flores,Guerrero,Carrillo,Cueva,Yot\xFAn,Tapia,Valera,Farf\xE1n,Cuesta,Trauco,Gonzales,Corzo,Loyola,Polo,Abram"
  ),
  ecu: P(
    "Enner,Gonzalo,\xC1ngel,Mois\xE9s,Jhegson,Alan,Piero,Mois\xE9s,Kendry,Jordy,Jos\xE9,Dener,An\xEDbal,F\xE9lix,Janner",
    "Valencia,Plata,Mena,Caicedo,M\xE9ndez,Franco,Hincapi\xE9,Ram\xEDrez,P\xE1ez,Caicedo,Cifuentes,Valencia,Chal\xE1,Torres,Corozo"
  ),
  par: P(
    "Miguel,\xD3scar,\xC1ngel,Diego,Cecilio,Julio,Antonio,Braian,Robert,Dar\xEDo,Gabriel,Math\xEDas,Blas,Dami\xE1n,Rodney",
    "Almir\xF3n,Cardozo,Romero,G\xF3mez,Dom\xEDnguez,Enciso,Sanabria,Samudio,Piris,Lezcano,\xC1valos,Villasanti,Riveros,Bobadilla,Redes"
  ),
  bol: P(
    "Marcelo,Ramiro,Juan Carlos,Mois\xE9s,Leonel,Carmelo,Bruno,Jos\xE9,Henry,Diego,Gabriel,Boris,Robson,Miguel,Leonardo",
    "Martins,Vaca,Arce,Villarroel,Justiniano,Algara\xF1az,Miranda,Sagredo,Fern\xE1ndez,Bejarano,Villam\xEDl,Cespedes,Matheus,Terceros,Ursino"
  ),
  nga: P(
    "Victor,Kelechi,Samuel,Moses,Ahmed,Alex,Wilfred,Joe,Ademola,Paul,Ola,Taiwo,Cyriel,Chidera,Gift",
    "Osimhen,Iheanacho,Chukwueze,Simon,Musa,Iwobi,Ndidi,Aribo,Lookman,Onuachu,Aina,Awoniyi,Dessers,Ejuke,Orban"
  ),
  rsa: P(
    "Percy,Themba,Teboho,Keagan,Lyle,Bongani,Ronwen,Thapelo,Aubrey,Bathusi,Sphephelo,Oswin,Katlego,Mihlali,Evidence",
    "Tau,Zwane,Mokoena,Dolly,Foster,Zungu,Williams,Morena,Modiba,Aubaas,Sithole,Appollis,Makgopa,Mayambela,Makgopa"
  ),
  mar: P(
    "Achraf,Hakim,Youssef,Sofyan,Noussair,Azzedine,Brahim,Selim,Abde,Yassine,Eliesse,Sofiane,Bilal,Ayoub,Walid",
    "Hakimi,Ziyech,En-Nesyri,Amrabat,Mazraoui,Ounahi,Diaz,Amallah,Ezzalzouli,Bounou,Ben Seghir,Boufal,El Khannouss,El Kaabi,Regragui"
  ),
  qat: P(
    "Akram,Almoez,Boualem,Karim,Yusuf,Assim,Edmilson,Mohammed,Bassam,Salem,Tarek,Pedro,R\xF3-R\xF3,Lucas,Ismail",
    "Afif,Ali,Khoukhi,Boudiaf,Abdurisag,Madibo,Junior,Waad,Al-Rawi,Al-Hajri,Salman,Miguel,Mendes,Mohamad"
  ),
  uae: P(
    "Ali,F\xE1bio,Caio,Yahya,Harib,Khalil,Majed,Band Ali,Abdullah,Tahnoon,Sultan,Khalifa,Saeed,Ali,Ahmed",
    "Mabkhout,Lima,Canedo,Al-Ghassani,Abdalla,Al-Hammadi,Hassan,Al-Ahbabi,Ramadan,Al-Zaabi,Adel,Al-Hammadi,Easa,Saleh,Khalil"
  ),
  tha: P(
    "Chanathip,Teerasil,Theerathon,Sarach,Supachai,Ekanit,Ben,Peeradol,Nicholas,Elias,Suphanat,Channarong,Jonathan,Manuel,Patrik",
    "Songkrasin,Dangda,Bunmathan,Yenramyan,Chaided,Panya,Davis,Chamrasamee,Mickelson,Dolah,Mueanta,Promsrikaew,Khemdee,Bihr,Gustafsson"
  ),
  idn: P(
    "Egy,Witan,Asnawi,Pratama,Rizky,Marc,Saddil,Marselino,Rafael,Elkan,Sandy,Alfeandra,Ragnar,Ivar,Justin",
    "Maulana,Sulaeman,Mangkualam,Arhan,Ridho,Klok,Ramdhani,Ferdinan,Struick,Baggott,Walsh,Dewangga,Oratmangoen,Jenner,Hubner"
  ),
  can: P(
    "Alphonso,Jonathan,Cyle,Stephen,Tajon,Promise,Isma\xEBl,Samuel,Alistair,Richie,Liam,Junior,Cyle,Mathieu,Ayo",
    "Davies,David,Larin,Eust\xE1quio,Buchanan,David,Kon\xE9,Piette,Johnston,Laryea,Millar,Hoilett,Choini\xE8re,Akinola"
  )
};
var LEAGUE_TO_POOL = {
  bra2: "bra",
  eng2: "eng",
  esp2: "esp",
  ita2: "ita",
  ger2: "ger",
  fra2: "fra"
};
function poolForLeague(leagueId) {
  const key = LEAGUE_TO_POOL[leagueId] ?? leagueId;
  return POOLS[key] ?? POOLS["bra"];
}

// src/game/squad.ts
var SHAPE = [
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "MF",
  "DF",
  "GK",
  "FW",
  "MF"
];
var POSITIONS = /* @__PURE__ */ new Set(["GK", "DF", "MF", "FW"]);
var SQUAD_SIZE = 26;
var MIN_GOALKEEPERS = 3;
var LEGACY_SQUAD_SIZE = 18;
var LEGACY_STRENGTH = {
  fla: 88,
  pal: 87,
  bot: 84,
  cru: 83,
  mgo: 82,
  sao: 81,
  flu: 80,
  int: 79,
  gre: 79,
  cor: 79,
  bah: 78,
  vas: 77,
  for: 76,
  san: 76,
  rbb: 75,
  mir: 73,
  cea: 72,
  spt: 71,
  vit: 71,
  juv: 69,
  cor_pr: 71,
  ath: 73,
  cha: 67,
  rem: 65
};
var clamp4 = (v, min, max) => Math.min(max, Math.max(min, v));
function shirtNumbers(count, gkIndexes) {
  const pool = [];
  pool.push(1, 12);
  for (let n = 2; n <= 11; n++) pool.push(n);
  for (let n = 13; n <= 40; n++) pool.push(n);
  const out = new Array(count).fill(0);
  const taken = /* @__PURE__ */ new Set();
  for (const i of [...gkIndexes].sort((a, b) => a - b)) {
    const n = pool.find((candidate) => !taken.has(candidate));
    taken.add(n);
    out[i] = n;
  }
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (gkIndexes.has(i)) continue;
    while (cursor < pool.length && taken.has(pool[cursor])) cursor++;
    const n = pool[cursor] ?? 40 + i;
    taken.add(n);
    out[i] = clamp4(n, 1, 99);
  }
  return out;
}
function attrsFor(pos, ovr, rnd) {
  const j = (v) => clamp4(Math.round(v + (rnd() * 8 - 4)), 35, 99);
  switch (pos) {
    case "GK":
      return {
        pace: j(ovr - 20),
        shooting: j(ovr - 40),
        passing: j(ovr - 12),
        defending: j(ovr),
        physical: j(ovr - 4)
      };
    case "DF":
      return {
        pace: j(ovr - 4),
        shooting: j(ovr - 25),
        passing: j(ovr - 8),
        defending: j(ovr + 4),
        physical: j(ovr + 3)
      };
    case "MF":
      return {
        pace: j(ovr - 2),
        shooting: j(ovr - 6),
        passing: j(ovr + 4),
        defending: j(ovr - 5),
        physical: j(ovr - 2)
      };
    default:
      return {
        pace: j(ovr + 3),
        shooting: j(ovr + 4),
        passing: j(ovr - 4),
        defending: j(ovr - 22),
        physical: j(ovr - 2)
      };
  }
}
function draftFromCatalog(clubId, legacy = false) {
  const raw = legacy && clubId === "ath" ? NAMED_SQUADS["ath_b"] : legacy && clubId === "ath_b" ? void 0 : NAMED_SQUADS[clubId];
  if (!raw) return [];
  const out = [];
  for (const entry of raw.split(";")) {
    const parts = entry.split("|");
    if (parts.length !== 4) continue;
    const [pos, name, age, ovr] = parts;
    if (!POSITIONS.has(pos)) continue;
    if (!name || !name.trim()) continue;
    const a = Number(age);
    const o = Number(ovr);
    if (!Number.isFinite(a) || !Number.isFinite(o)) continue;
    out.push({
      name: name.trim(),
      pos,
      age: clamp4(Math.round(a), 16, 45),
      ovr: clamp4(Math.round(o), 40, 99),
      named: true
    });
  }
  return out;
}
function calibrateDraft(draft, strength) {
  const best = (pos, count) => draft.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, count);
  const starters = [...best("GK", 1), ...best("DF", 4), ...best("MF", 3), ...best("FW", 3)];
  if (!starters.length) return;
  const mean = starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length;
  const delta = Math.round(clamp4(strength - 2, 40, 94) - mean);
  for (const p of draft) p.ovr = clamp4(p.ovr + delta, 40, 94);
}
function ensureGoalkeepers(draft, rnd) {
  let gks = draft.filter((d) => d.pos === "GK").length;
  if (gks >= 2) return draft;
  const candidates = draft.map((d, i) => ({ d, i })).filter(({ d }) => !d.named && d.pos !== "GK").sort((a, b) => a.d.ovr - b.d.ovr || a.i - b.i);
  for (const { d } of candidates) {
    if (gks >= 2) break;
    d.pos = "GK";
    d.ovr = clamp4(d.ovr - 2, 40, 99);
    d.age = clamp4(d.age, 17, 40);
    gks++;
  }
  void rnd;
  return draft;
}
function dedupeNames(draft) {
  const seen = /* @__PURE__ */ new Set();
  for (const d of draft) {
    if (!seen.has(d.name)) {
      seen.add(d.name);
      continue;
    }
    const parts = d.name.split(" ");
    let candidate = d.name;
    for (let k = 0; k < 26 && seen.has(candidate); k++) {
      const initial = String.fromCharCode(65 + k % 26);
      candidate = parts.length > 1 ? `${parts[0]} ${initial}. ${parts.slice(1).join(" ")}` : `${d.name} ${initial}`;
    }
    d.name = candidate;
    seen.add(candidate);
  }
  return draft;
}
function makePlayer(club, draft, index, number, rnd) {
  const d = draft[index];
  return {
    id: `${club.id}-${index}`,
    clubId: club.id,
    name: d.name,
    pos: d.pos,
    age: d.age,
    number,
    ovr: d.ovr,
    ...attrsFor(d.pos, d.ovr, rnd),
    condition: 88 + Math.floor(rnd() * 12),
    morale: 70 + Math.floor(rnd() * 25),
    goals: 0,
    assists: 0,
    apps: 0,
    wage: 0,
    value: 0,
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
    rosterSource: d.named ? "catalog" : "generated"
  };
}
function buildSquad(clubId) {
  return createSquad(clubId, false);
}
function createSquad(clubId, legacy) {
  const club = { ...safeClub(clubId) };
  if (legacy) club.strength = LEGACY_STRENGTH[clubId] ?? club.strength;
  const rnd = makeRng(`squad-${clubId}`);
  const draft = draftFromCatalog(clubId, legacy);
  const pool = poolForLeague(club.league);
  const used = new Set(draft.map((d) => d.name));
  while (draft.length < LEGACY_SQUAD_SIZE) {
    const pos = SHAPE[draft.length % SHAPE.length];
    let name = "";
    let guard = 0;
    do {
      name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
      guard++;
    } while (used.has(name) && guard < 60);
    used.add(name);
    const base = club.strength - (legacy ? 6 : 2) - Math.floor(rnd() * 9);
    draft.push({
      name,
      pos,
      age: clamp4(19 + Math.floor(rnd() * 15), 17, 40),
      ovr: legacy ? clamp4(Math.max(58, base), 40, 99) : clamp4(base, 40, 94),
      named: false
    });
  }
  ensureGoalkeepers(draft, rnd);
  if (!legacy) calibrateDraft(draft, club.strength);
  dedupeNames(draft);
  const gkIndexes = /* @__PURE__ */ new Set();
  draft.forEach((d, i) => {
    if (d.pos === "GK") gkIndexes.add(i);
  });
  const numbers = shirtNumbers(draft.length, gkIndexes);
  return appendReserves(
    club,
    draft.map((_, i) => makePlayer(club, draft, i, numbers[i], rnd)),
    SQUAD_SIZE
  );
}
function appendReserves(club, existing, minimum) {
  const clubId = club.id;
  const squad = [...existing];
  const rnd = makeRng(`squad-reserves-${clubId}`);
  const pool = poolForLeague(club.league);
  const ids = new Set(squad.map((p) => p.id));
  const names = new Set(squad.map((p) => p.name));
  const numbers = new Set(squad.map((p) => p.number));
  const targets = { GK: 3, DF: 8, MF: 8, FW: 7 };
  let index = 0;
  while (squad.length < minimum || squad.filter((p) => p.pos === "GK").length < MIN_GOALKEEPERS) {
    const id = `${clubId}-reserve-${index++}`;
    if (ids.has(id)) continue;
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    squad.forEach((p) => counts[p.pos]++);
    const pos = Object.keys(targets).sort(
      (a, b) => targets[b] - counts[b] - (targets[a] - counts[a])
    )[0];
    let name = `${pool.first[Math.floor(rnd() * pool.first.length)]} ${pool.last[Math.floor(rnd() * pool.last.length)]}`;
    if (names.has(name)) name = `${name} ${index}`;
    const d = {
      name,
      pos,
      age: 18 + Math.floor(rnd() * 13),
      ovr: clamp4(club.strength - 10 - Math.floor(rnd() * 9), 40, 85),
      named: false
    };
    const number = Array.from({ length: 99 }, (_, i) => i + 1).find((n) => !numbers.has(n));
    if (!number) break;
    const player = { ...makePlayer(club, [d], 0, number, rnd), id };
    squad.push(player);
    ids.add(id);
    names.add(name);
    numbers.add(number);
  }
  return squad;
}

// src/game/career.ts
var COVER_ORDER = {
  GK: ["GK"],
  DF: ["DF", "MF", "FW"],
  MF: ["MF", "DF", "FW"],
  FW: ["FW", "MF", "DF"]
};
function pickLineup(players, formation) {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const available = [...players].filter((p) => !p.suspended && p.injuryWeeks === 0).sort((a, b) => selectionRating(b) - selectionRating(a) || a.id.localeCompare(b.id));
  const taken = /* @__PURE__ */ new Set();
  const picks = new Array(slots.length).fill(void 0);
  const keepers = available.filter((p) => p.pos === "GK");
  let keeperCursor = 0;
  slots.forEach((slot, i) => {
    if (slot.pos !== "GK") return;
    const keeper = keepers[keeperCursor++];
    if (!keeper) return;
    taken.add(keeper.id);
    picks[i] = keeper;
  });
  const cover = (pos) => {
    for (const candidatePos of COVER_ORDER[pos] ?? ["DF", "MF", "FW"]) {
      const found = available.find((p) => !taken.has(p.id) && p.pos === candidatePos);
      if (found) return found;
    }
    return void 0;
  };
  slots.forEach((slot, i) => {
    if (slot.pos === "GK" || picks[i]) return;
    const found = cover(slot.pos) ?? available.find((p) => !taken.has(p.id) && p.pos !== "GK") ?? available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
  });
  slots.forEach((slot, i) => {
    if (picks[i]) return;
    const found = available.find((p) => !taken.has(p.id) && p.pos !== "GK") ?? available.find((p) => !taken.has(p.id));
    if (!found) return;
    taken.add(found.id);
    picks[i] = found;
    void slot;
  });
  const lineup = picks.filter(Boolean).map((p) => p.id);
  const rest = available.filter((p) => !taken.has(p.id));
  const benchIds = rest.slice(0, 7).map((p) => p.id);
  if (!benchIds.some((id) => rest.find((p) => p.id === id)?.pos === "GK")) {
    const spareKeeper = rest.find((p) => p.pos === "GK");
    if (spareKeeper) {
      const weakestOutfield = [...benchIds].reverse().find((id) => {
        const p = rest.find((q) => q.id === id);
        return Boolean(p) && p.pos !== "GK";
      });
      if (weakestOutfield) {
        benchIds.splice(benchIds.indexOf(weakestOutfield), 1);
        benchIds.unshift(spareKeeper.id);
      }
    }
  }
  return { lineup, bench: benchIds };
}
var PERSONALITIES = [
  "l\xEDder",
  "profissional",
  "ambicioso",
  "temperamental",
  "caseiro",
  "determinado"
];
function buildReadySquad(clubId) {
  return buildSquad(clubId).map(enrichPlayer);
}
function enrichPlayer(p) {
  const rnd = makeRng(`pl-${p.id}`);
  return {
    ...p,
    wage: p.wage > 0 ? p.wage : wageFor(p.ovr),
    value: p.value > 0 ? p.value : valueFor(p.ovr, p.age),
    yellows: p.yellows ?? 0,
    suspended: p.suspended ?? false,
    injuryWeeks: p.injuryWeeks ?? 0,
    potential: p.potential ?? Math.min(
      99,
      p.ovr + (p.age <= 20 ? 6 + Math.floor(rnd() * 8) : p.age <= 24 ? 3 + Math.floor(rnd() * 6) : Math.floor(rnd() * 3))
    ),
    personality: p.personality ?? PERSONALITIES[Math.floor(rnd() * PERSONALITIES.length)],
    form: p.form ?? Math.round((p.morale + p.condition) / 2),
    contractYears: p.contractYears ?? 1 + Math.floor(rnd() * 4),
    releaseClause: p.releaseClause ?? Math.round(valueFor(p.ovr, p.age) * (1.8 + rnd() * 1.4) * 10) / 10,
    unhappy: p.unhappy ?? false
  };
}

// src/game/quickMatch.ts
function buildTeamSetup(clubId, formation = "4-3-3", mentality = 2, pressing = 1, opts) {
  const club = safeClub(clubId);
  const squad = buildReadySquad(clubId);
  const { lineup } = pickLineup(squad, formation);
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  const chosen = lineup.map((id) => byId[id]).filter(Boolean);
  const lineupIds = new Set(lineup);
  const bench = squad.filter((p) => !lineupIds.has(p.id));
  const morale = opts?.morale ?? Math.round(squad.reduce((s, p) => s + (p.morale ?? 70), 0) / Math.max(1, squad.length));
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: chosen,
    tactics: { formation, mentality, pressing, width: 1, tempo: 1 },
    bench,
    morale,
    cpu: opts?.cpu ?? true
  };
}
export {
  MatchSim,
  buildTeamSetup
};
