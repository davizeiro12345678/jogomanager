import { describe, expect, it } from "vitest";
import { cinematicDetail } from "./cinematic-performance";
import { buildSculptedFace } from "./player-sculpt";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";

describe("budgeted cinematic facial anatomy", () => {
  it("allocates a smoother skull only to low-tier narrative actors", () => {
    const detail = cinematicDetail("baixa", true);
    expect(detail.headSampling).toEqual({ columns: 32, rows: 36 });
    expect(detail.portrait).toBe(false);
    expect(cinematicDetail("baixa", false).headSampling).toBeUndefined();
    expect(cinematicDetail("media", true).headSampling).toBeUndefined();
    expect(cinematicDetail("alta", true).headSampling).toBeUndefined();
  });

  it("refines the same seeded face without increasing facial part count", () => {
    const look = lookFor("cinematic-low-head", "MF");
    const p = proportionsFor(look);
    const kit = {
      base: "#b92334",
      detail: "#fff",
      shorts: "#202830",
      socks: "#b92334",
      pattern: "solid",
    } as const;
    const mats = playerMaterials(look, kit, null, "media");
    const basic = buildSculptedFace(p, look, mats, false, false);
    const refined = buildSculptedFace(
      p,
      look,
      mats,
      false,
      false,
      cinematicDetail("baixa", true).headSampling,
    );
    try {
      const before = basic.head[0]!.geometry;
      const after = refined.head[0]!.geometry;
      expect(before.index!.count / 3).toBe(720);
      expect(after.index!.count / 3).toBe(2304);
      expect(after.getAttribute("normal").count).toBe(after.getAttribute("position").count);
      expect(Array.from(after.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      expect(Array.from(after.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      expect(Object.values(refined).map((parts) => parts.length)).toEqual(
        Object.values(basic).map((parts) => parts.length),
      );
    } finally {
      for (const face of [basic, refined])
        for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
    }
  });
});
