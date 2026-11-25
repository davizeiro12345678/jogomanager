import { expect, it } from "vitest";
import { pitchTextureSelection } from "./pitch-texture-selection";

it("keeps each custom mowing pattern instead of silently showing flat grass in high quality", () => {
  for (const pattern of ["rings", "diamond", "fine", "spiral", "bands"] as const) {
    expect(pitchTextureSelection(pattern, true)).toEqual({ albedo: null, roughness: null });
  }
});
it("only streams compressed maps authored for the selected pattern", () => {
  expect(pitchTextureSelection("checker", true)).toEqual({
    albedo: "grassAlbedo",
    roughness: "grassRough",
  });
  expect(pitchTextureSelection("stripes", true)).toEqual({
    albedo: "grass_stripes_albedo",
    roughness: null,
  });
  expect(pitchTextureSelection("diagonal", true)).toEqual({
    albedo: "grass_diagonal_albedo",
    roughness: null,
  });
  expect(pitchTextureSelection("wide", true)).toEqual({
    albedo: "grass_wide_albedo",
    roughness: null,
  });
  expect(pitchTextureSelection("checker", false)).toEqual({ albedo: null, roughness: null });
});
