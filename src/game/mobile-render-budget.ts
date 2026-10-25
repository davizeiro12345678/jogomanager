import type { GraphicsTier } from "./contracts/graphics-profile";

/** Additional mobile ceilings; legacy release profiles remain binding. */
export function mobileRenderBudget(tier: GraphicsTier, mobile: boolean) {
  if (!mobile) return null;
  const basic = tier === "baixa";
  return {
    id: basic ? "mobile-basic-2020" : "mobile-mid-2020",
    longEdge: basic ? 960 : 1280,
    shortEdge: basic ? 540 : 720,
    maxDrawCalls: basic ? 75 : 110,
    maxTriangles: basic ? 130000 : 260000,
    studioDrawCalls: basic ? 40 : 50,
    studioTriangles: basic ? 90000 : 140000,
    targetP95FrameMs: 18,
  } as const;
}

export function mobileFramebufferRatio(
  width: number,
  height: number,
  requested: number,
  budget: NonNullable<ReturnType<typeof mobileRenderBudget>>,
) {
  const ratio = Number.isFinite(requested) && requested > 0 ? requested : 1;
  if (![width, height].every((v) => Number.isFinite(v) && v > 0)) return Math.min(1, ratio);
  return Math.min(
    ratio,
    budget.longEdge / Math.max(width, height),
    budget.shortEdge / Math.min(width, height),
  );
}
