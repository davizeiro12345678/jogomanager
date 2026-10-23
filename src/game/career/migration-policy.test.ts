import { describe, expect, it } from "vitest";
import { initCareer } from "./setup";
import { migrateCareerShape } from "./migration";

describe("save upgrade compatibility", () => {
  it("preserves a future save instead of silently downgrading it", () => {
    const future = { ...initCareer("bra", "fla", "Compatibilidade"), version: 4 };
    const before = JSON.stringify(future);
    expect(() => migrateCareerShape(future)).toThrow(/versão|atualiz/i);
    expect(JSON.stringify(future)).toBe(before);
  });
  it("keeps supported version-two careers readable without resetting their finances", () => {
    const saved = {
      ...initCareer("bra", "fla", "Legado"),
      version: 2,
      finances: { budget: 17, spent: 3, income: 2 },
    };
    const migrated = migrateCareerShape(saved);
    expect(migrated.version).toBe(3);
    expect(migrated.finances).toEqual(saved.finances);
    expect(migrated.players).toEqual(saved.players);
  });
});
