import {
  lookWithPhysique,
  type PlayerLook,
  type HairStyle,
  type BeardStyle,
  type BodyType,
} from "./player-model";

export interface StudioAppearanceSelection {
  hairStyle: HairStyle | "original";
  beard: BeardStyle | "original";
  physique: BodyType | "original";
  height?: number | undefined;
  weight?: number | undefined;
}

/** A local bridge between the DOM and Canvas React roots. Structural edits
 * notify the mounted scene synchronously, including a paused demand canvas. */
export function createStudioAppearanceStore(initial: PlayerLook, id = "local") {
  let current = initial;
  let notifications = 0;
  const listeners = new Set<() => void>();
  return {
    diagnostics: () => ({
      id,
      subscribers: listeners.size,
      notifications,
      revision: studioAppearanceRevision(current),
    }),
    getSnapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: PlayerLook) {
      if (studioAppearanceRevision(next) === studioAppearanceRevision(current)) return;
      current = next;
      [...listeners].forEach((listener) => {
        notifications++;
        listener();
      });
    },
  };
}

/** Single resolver used by the authoring controls and both rendering tiers.
 * A headband is an accessory over medium hair, as in seeded lookFor records;
 * it must never become an unrecognised geometry style of its own. */
export function resolveStudioAppearance(
  look: PlayerLook,
  selection: StudioAppearanceSelection,
): PlayerLook {
  return lookWithPhysique(
    {
      ...look,
      hairStyle:
        selection.hairStyle === "original"
          ? look.hairStyle
          : selection.hairStyle === "headband"
            ? "medium"
            : selection.hairStyle,
      headband:
        selection.hairStyle === "headband" || (selection.hairStyle === "original" && look.headband),
      beard: selection.beard === "original" ? look.beard : selection.beard,
      bodyType: selection.physique === "original" ? look.bodyType : selection.physique,
      girth:
        selection.physique === "original"
          ? look.girth
          : selection.physique === "strong"
            ? 1.16
            : selection.physique === "slim"
              ? 0.88
              : 1,
    },
    { height: selection.height, weight: selection.weight },
  );
}

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
