import { describe, expect, it } from "vitest";

import {
  createManagerProfile,
  DEFAULT_MANAGER_ATTRIBUTES,
  DEFAULT_MANAGER_LOOK,
  normalizeManagerLook,
} from "./manager-profile";

describe("manager profile contract", () => {
  it("creates the same bounded durable identity for every creation flow", () => {
    const profile = createManagerProfile({
      name: "  Marina Torres  ",
      country: "bra",
      age: 36.7,
      favClub: "my-atletico",
      look: { skin: 99, hair: -3, hairColor: "invalid", beard: 3, outfit: 8 },
      personality: "tatico",
      reputation: 4.6,
      attrs: { attack: 0, defense: 11, market: 8.7 },
    });

    expect(profile).toEqual({
      name: "Marina Torres",
      country: "bra",
      age: 37,
      favClub: "my-atletico",
      look: { skin: 5, hair: 0, hairColor: DEFAULT_MANAGER_LOOK.hairColor, beard: 3, outfit: 2 },
      personality: "tatico",
      reputation: 5,
      attrs: { ...DEFAULT_MANAGER_ATTRIBUTES, attack: 1, defense: 10, market: 9 },
      approval: 75,
    });
  });

  it("uses safe deterministic fallbacks without retaining caller references", () => {
    const look = normalizeManagerLook({ hairColor: "#112233" });
    const profile = createManagerProfile({
      name: "",
      country: "",
      age: Number.NaN,
      favClub: "",
      look,
      personality: "not-a-personality" as never,
    });
    look.hair = 6;

    expect(profile.name).toBe("Técnico");
    expect(profile.country).toBe("bra");
    expect(profile.look.hair).toBe(DEFAULT_MANAGER_LOOK.hair);
    expect(profile.look.hairColor).toBe("#112233");
    expect(profile.attrs).not.toBe(DEFAULT_MANAGER_ATTRIBUTES);
  });
});
