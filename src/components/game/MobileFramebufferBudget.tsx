import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { GraphicsTier } from "@/game/contracts/graphics-profile";
import { isCoarsePointer } from "@/game/device";
import { mobileFramebufferRatio, mobileRenderBudget } from "@/game/mobile-render-budget";

/** Bound actual canvas pixels on resize/rotation, including high-DPR phones. */
export function MobileFramebufferBudget({
  tier,
  requested,
}: {
  tier: GraphicsTier;
  requested: number | [number, number];
}) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const initialDpr = useThree((state) => state.viewport.initialDpr);
  const setDpr = useThree((state) => state.setDpr);
  useLayoutEffect(() => {
    const budget = mobileRenderBudget(tier, isCoarsePointer());
    if (!budget) return;
    const target = Array.isArray(requested)
      ? Math.max(requested[0], Math.min(initialDpr, requested[1]))
      : requested;
    const next = mobileFramebufferRatio(size.width, size.height, target, budget);
    if (Math.abs(next - dpr) > 0.0001) setDpr(next);
  }, [tier, requested, size.width, size.height, initialDpr, dpr, setDpr]);
  return null;
}
