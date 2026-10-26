import { useFrame } from "@react-three/fiber";

import { useEffect, useMemo, useRef } from "react";

import { GRAPHICS_PROFILES, type GraphicsTier } from "@/game/contracts/graphics-profile";

import { QualityGovernor } from "@/game/quality-governor";
import { isCoarsePointer } from "@/game/device";
import { MOBILE_TARGET_P95_MS } from "@/game/mobile-render-budget";

export function RuntimeBudget({
  tier,
  enabled,
  suspended = false,
  onChange,
}: {
  tier: GraphicsTier;
  enabled: boolean;
  suspended?: boolean;
  onChange: (stage: number) => void;
}) {
  const governor = useMemo(
    () =>
      new QualityGovernor(
        isCoarsePointer() ? MOBILE_TARGET_P95_MS : GRAPHICS_PROFILES[tier].targetP95FrameMs,
      ),
    [tier],
  );
  const previous = useRef(0);
  const resume = useRef(false);
  useEffect(() => {
    previous.current = 0;
    onChange(0);
    if (!enabled) governor.resetWindow();
    const visibility = () => {
      governor.resetWindow();
      resume.current = true;
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [governor, onChange, enabled]);
  useEffect(() => {
    // Demand rendering has no regular frame cadence while a match is paused.
    // Keep its chosen budget, then begin a fresh window when play resumes.
    governor.resetWindow();
    resume.current = true;
  }, [governor, suspended]);
  useFrame((_, dt) => {
    if (!enabled || suspended || document.hidden) return;
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
