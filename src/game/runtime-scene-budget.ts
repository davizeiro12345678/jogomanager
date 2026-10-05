import type { GraphicsTier } from "./contracts/graphics-profile";

/**
 * All adaptive rendering levers live in one resolved object.  A numeric
 * pressure stage is useful for the governor, but it is too easy to introduce
 * a stage that does not actually remove work from the scene.  Consumers use
 * this budget instead of inventing their own stage checks.
 */
export type RuntimeSceneBudget = Readonly<{
  tier: GraphicsTier;
  stage: number;
  resolutionScale: number;
  textureScale: number;
  grassDensity: number;
  grassChunks: number;
  crowdInstances: number;
  crowdVisibleTiles: number;
  crowdUpdateSeconds: number;
  flagCount: number;
  propRings: number;
  heroPlayers: number;
  replayHeroPlayers: number;
  weatherDensity: number;
  goalFxDensity: number;
  shadows: boolean;
  post: "off" | "balanced" | "cinema";
}>;

type BudgetBase = Omit<
  RuntimeSceneBudget,
  "tier" | "stage" | "resolutionScale" | "textureScale" | "shadows" | "post"
> & {
  post: "off" | "balanced" | "cinema";
};

const BASE: Record<GraphicsTier, BudgetBase> = {
  baixa: {
    grassDensity: 0.28,
    grassChunks: 4,
    crowdInstances: 768,
    crowdVisibleTiles: 6,
    crowdUpdateSeconds: 0.62,
    flagCount: 4,
    propRings: 4,
    heroPlayers: 0,
    replayHeroPlayers: 0,
    weatherDensity: 0.24,
    goalFxDensity: 0.28,
    post: "off",
  },
  media: {
    grassDensity: 0.54,
    grassChunks: 10,
    crowdInstances: 2_048,
    crowdVisibleTiles: 12,
    crowdUpdateSeconds: 0.42,
    flagCount: 12,
    propRings: 7,
    heroPlayers: 3,
    replayHeroPlayers: 4,
    weatherDensity: 0.54,
    goalFxDensity: 0.55,
    post: "balanced",
  },
  alta: {
    grassDensity: 1,
    grassChunks: 18,
    crowdInstances: 4_096,
    crowdVisibleTiles: 18,
    crowdUpdateSeconds: 0.3,
    flagCount: 24,
    propRings: 11,
    heroPlayers: 6,
    replayHeroPlayers: 10,
    weatherDensity: 1,
    goalFxDensity: 1,
    post: "balanced",
  },
  cinema: {
    grassDensity: 1.1,
    grassChunks: 20,
    crowdInstances: 5_120,
    crowdVisibleTiles: 18,
    crowdUpdateSeconds: 0.25,
    flagCount: 30,
    propRings: 13,
    heroPlayers: 8,
    replayHeroPlayers: 12,
    weatherDensity: 1.15,
    goalFxDensity: 1.15,
    post: "cinema",
  },
};

const clampStage = (stage: number) => Math.max(0, Math.min(8, Math.floor(stage)));

/** Resolve a visible, bounded scene at every quality-pressure stage. */
export function resolveRuntimeSceneBudget(tier: GraphicsTier, rawStage = 0): RuntimeSceneBudget {
  const stage = clampStage(rawStage);
  const base = BASE[tier];
  const resolutionScale = stage >= 3 ? 0.66 : stage >= 2 ? 0.76 : stage >= 1 ? 0.88 : 1;
  const textureScale = stage >= 7 ? 0.5 : stage >= 5 ? 0.75 : 1;
  const grassScale = stage >= 4 ? 0.32 : stage >= 3 ? 0.58 : 1;
  const crowdScale = stage >= 6 ? 0.42 : stage >= 5 ? 0.62 : stage >= 4 ? 0.78 : 1;
  const propScale = stage >= 6 ? 0.48 : stage >= 5 ? 0.7 : 1;
  const effectsScale = stage >= 7 ? 0.18 : stage >= 6 ? 0.46 : 1;
  // Heróis são a última alavanca: só caem quando o governador já espremeu o
  // resto da cena (estágio 7+). A quantidade inicial é derivada do orçamento
  // medido em `MatchPlayers` (`draw-budget.ts`).
  const heroScale = stage >= 8 ? 0.5 : stage >= 7 ? 0.66 : 1;

  return {
    tier,
    stage,
    resolutionScale,
    textureScale,
    grassDensity: base.grassDensity * grassScale,
    grassChunks: Math.max(0, Math.round(base.grassChunks * grassScale)),
    crowdInstances: Math.max(0, Math.round(base.crowdInstances * crowdScale)),
    crowdVisibleTiles: Math.max(2, Math.round(base.crowdVisibleTiles * crowdScale)),
    crowdUpdateSeconds: base.crowdUpdateSeconds * (stage >= 5 ? 1.75 : 1),
    flagCount: Math.max(0, Math.round(base.flagCount * propScale)),
    propRings: Math.max(3, Math.round(base.propRings * propScale)),
    heroPlayers: Math.max(0, Math.round(base.heroPlayers * heroScale)),
    replayHeroPlayers: Math.max(0, Math.round(base.replayHeroPlayers * heroScale)),
    weatherDensity: base.weatherDensity * effectsScale,
    goalFxDensity: base.goalFxDensity * effectsScale,
    // Dynamic shadows are the biggest GPU cost on phones; drop them before crowd/heroes.
    shadows: stage < 4,
    post: stage >= 7 ? "off" : stage >= 6 && base.post === "cinema" ? "balanced" : base.post,
  };
}
