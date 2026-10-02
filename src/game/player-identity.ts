import { makeRng } from "./rng";
import type { Player } from "./types";
import type { DetailedAttributes, PlayerProfile } from "./attributes";

function clamp(v: number) {
  return Math.max(20, Math.min(99, Math.round(v)));
}

function buildAttrs(p: Player, rnd: () => number): DetailedAttributes {
  const j = (base: number, spread = 7) => clamp(base + rnd() * spread - spread / 2);
  const { ovr, pos } = p;
  const pace = p.pace;
  const sho = p.shooting;
  const pas = p.passing;
  const def = p.defending;
  const phy = p.physical;

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
    };
  }

  const attack = pos === "FW";
  const mid = pos === "MF";
  const back = pos === "DF";

  return {
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
  };
}

export function profileIdentityFor(p: Player) {
  const rnd = makeRng(`profile-${p.id}-${p.name}`);
  const attrs = buildAttrs(p, rnd);
  const tall = p.pos === "GK" ? 8 : p.pos === "DF" ? 4 : 0;
  const foot: PlayerProfile["foot"] =
    rnd() < 0.72 ? "destro" : rnd() < 0.9 ? "canhoto" : "ambidestro";
  const height = Math.round(171 + tall + rnd() * 16);
  const weight = Math.round(65 + tall * 0.9 + rnd() * 18);
  return { rnd, attrs, foot, height, weight };
}

const physiques = new Map<string, Pick<PlayerProfile, "height" | "weight">>();

export function clearPhysiqueCache() {
  physiques.clear();
}

/** Matches the full profile's random stream without importing club history. */
export function physiqueFor(p: Player): Pick<PlayerProfile, "height" | "weight"> {
  const existing = physiques.get(p.id);
  if (existing) return existing;
  const { height, weight } = profileIdentityFor(p);
  const physique = { height, weight };
  physiques.set(p.id, physique);
  return physique;
}
