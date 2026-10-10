import type { PlayerLook } from "./player-model";

/**
 * Geometry in the Player Studio is intentionally rebuilt when an authoring
 * control changes its visible contract.  A stable revision separates that
 * rare structural update from camera/animation changes and prevents a stale
 * skinned primitive from retaining hair, beard or clothing from the prior
 * selection.
 */
export function studioAppearanceRevision(look: PlayerLook): string {
  return [
    look.seed,
    look.height.toFixed(4),
    look.girth.toFixed(4),
    look.bodyType,
    look.skin,
    look.hairColor,
    look.hairStyle,
    look.hairVolume.toFixed(4),
    look.beard,
    look.eyeColor,
    look.sleeves,
    look.collar,
    look.gloves,
    look.gloveColor,
    look.headband,
    look.headbandColor,
    look.captain,
    look.undershirt,
    look.undershirtColor,
    look.bootColor,
    look.bootAccent,
    look.sockTape,
    look.sockHeight,
    look.wristTape,
    look.tattoo,
    look.earring,
    look.sweat.toFixed(4),
    look.role,
  ].join("|");
}
