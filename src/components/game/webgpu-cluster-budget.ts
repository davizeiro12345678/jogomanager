export type ClusterBudget = Readonly<{
  maxLights: number;
  tileSize: number;
  zSlices: number;
  maxLightsPerCluster: number;
}>;

/** Bounded light lists save work when a scene has many point lights. */
export function clusteredLightingBudget(quality: "alta" | "media" | "baixa"): ClusterBudget {
  if (quality === "alta")
    return { maxLights: 96, tileSize: 32, zSlices: 16, maxLightsPerCluster: 12 };
  if (quality === "media")
    return { maxLights: 48, tileSize: 48, zSlices: 12, maxLightsPerCluster: 8 };
  return { maxLights: 16, tileSize: 64, zSlices: 8, maxLightsPerCluster: 4 };
}
