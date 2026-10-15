import { describe, expect, it } from "vitest";

import { lookFor } from "./player-model";
import { studioAppearanceRevision } from "./player-studio-appearance";

describe("Player Studio appearance revision", () => {
  it("is stable for the same saved athlete and changes for a rebuilt visual rig", () => {
    const look = lookFor("studio-appearance-revision", "MF", true);
    expect(studioAppearanceRevision(look)).toBe(studioAppearanceRevision({ ...look }));
    expect(
      studioAppearanceRevision({
        ...look,
        hairStyle: look.hairStyle === "bald" ? "short" : "bald",
      }),
    ).not.toBe(studioAppearanceRevision(look));
    expect(
      studioAppearanceRevision({
        ...look,
        beard: look.beard === "none" ? "stubble" : "none",
      }),
    ).not.toBe(studioAppearanceRevision(look));
    expect(studioAppearanceRevision({ ...look, height: look.height + 0.02 })).not.toBe(
      studioAppearanceRevision(look),
    );
  });
});
