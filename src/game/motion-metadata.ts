import type { AnimationFamily, ClipMetadata } from "./animation-core";

/** Descriptive properties for the catalog and preview. Contact markers drive
 * presentation only; they never attest a goal or a career achievement. */
export function motionMetadata(name: string, family: AnimationFamily): Partial<ClipMetadata> {
  const aerial = /header|headClear|jump|bicycle|dive|saveHigh|volleyAir/i.test(name);
  const ground = /slide|fall|kneeSlide|prone/i.test(name);
  const locomotion = family === "locomotion";
  const contactAt =
    family === "shooting"
      ? 0.4
      : family === "passing"
        ? 0.45
        : family === "goalkeeper"
          ? 0.5
          : family === "defense"
            ? 0.35
            : 0.3;
  const support = aerial ? "airborne" : ground ? "ground" : locomotion ? "alternating" : "planted";
  const tags = new Set([family, support, "procedural", "anatomical-limits"]);
  if (locomotion) tags.add("speed-driven");
  if (/pass|shot|kick|cross|chip|volley|trap|dribble/i.test(name)) tags.add("ball-contact");
  if (/left|L$/i.test(name)) tags.add("left");
  if (/right|R$/i.test(name)) tags.add("right");
  if (/tired|exhaust|breath|limp/i.test(name)) tags.add("fatigue");
  if (/power|sprint|explosive|burst/i.test(name)) tags.add("explosive");
  if (/turn|pivot|curve|shuffle|backpedal/i.test(name)) tags.add("direction-change");
  if (family === "idle" || locomotion)
    return {
      tags: [...tags],
      support,
      markers: locomotion
        ? [
            { name: "footContactL", time: 0, contactType: "ground", phase: "contact" },
            { name: "footContactR", time: 0.5, contactType: "ground", phase: "contact" },
          ]
        : [],
    };
  return {
    tags: [...tags],
    support,
    contactAt,
    markers: [
      { name: "anticipation", time: 0, phase: "anticipation" },
      { name: "preparation", time: contactAt * 0.5, phase: "action" },
      {
        name: "contact",
        time: contactAt,
        phase: "contact",
        contactType: family === "defense" ? "player" : "ball",
      },
      { name: "followThrough", time: Math.min(0.78, contactAt + 0.2), phase: "followThrough" },
      { name: "recovery", time: 0.88, phase: "recovery" },
    ],
  };
}

export function footballContactAt(action: string): number {
  if (/^(pass|passLong|cross|corner|throwIn|distribute)$/.test(action)) return 0.45;
  if (/header|headClear|dive|catch|save/i.test(action)) return 0.5;
  if (/tackle|slide|intercept|duel|block/i.test(action)) return 0.35;
  return 0.4;
}
