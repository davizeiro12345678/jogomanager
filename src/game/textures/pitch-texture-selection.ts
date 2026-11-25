import type { MowPattern } from "@/components/game/stadium/textures/grass";
import type { TextureName } from "./ktx2";

type PitchMaps = { albedo: TextureName | null; roughness: TextureName | null };

/** Never substitute a different mowing pattern merely because it is compressed. */
export function pitchTextureSelection(pattern: MowPattern, high: boolean): PitchMaps {
  if (!high) return { albedo: null, roughness: null };
  switch (pattern) {
    case "checker":
      return { albedo: "grassAlbedo", roughness: "grassRough" };
    case "stripes":
      return { albedo: "grass_stripes_albedo", roughness: null };
    case "diagonal":
      return { albedo: "grass_diagonal_albedo", roughness: null };
    case "wide":
      return { albedo: "grass_wide_albedo", roughness: null };
    default:
      return { albedo: null, roughness: null };
  }
}
