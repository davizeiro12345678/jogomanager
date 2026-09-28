import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { GRAPHICS_PROFILES, type GraphicsTier } from "@/game/contracts/graphics-profile";
import { QualityGovernor } from "@/game/quality-governor";
import {
  resolveRuntimeSceneBudget,
  type RuntimeSceneBudget as RuntimeSceneBudgetValue,
} from "@/game/runtime-scene-budget";

export const QualityPressure = createContext(0);
export const useQualityPressure = () => useContext(QualityPressure);
export const RuntimeSceneBudgetContext = createContext<RuntimeSceneBudgetValue>(
  resolveRuntimeSceneBudget("media"),
);
export const useRuntimeSceneBudget = () => useContext(RuntimeSceneBudgetContext);
export function RuntimeBudget({
  tier,
  enabled,
  onChange,
}: {
  tier: GraphicsTier;
  enabled: boolean;
  onChange: (stage: number) => void;
}) {
  const governor = useMemo(
    () => new QualityGovernor(GRAPHICS_PROFILES[tier].targetP95FrameMs),
    [tier, enabled],
  );
  const previous = useRef(0);
  const resume = useRef(false);
  useEffect(() => {
    previous.current = 0;
    onChange(0);
    const visibility = () => {
      governor.resetWindow();
      resume.current = true;
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [governor, onChange]);
  useFrame((_, dt) => {
    if (!enabled || document.hidden) return;
    if (resume.current) {
      resume.current = false;
      return;
    }
    const stage = governor.sample(dt);
    if (stage !== previous.current) {
      previous.current = stage;
      onChange(stage);
    }
  });
  return null;
}
