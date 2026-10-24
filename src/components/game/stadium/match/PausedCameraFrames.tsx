import { useFrame, useThree } from "@react-three/fiber";

import { useEffect, useRef } from "react";

import { type CameraMode } from "@/game/camera-modes";

/** Finish a camera transition in demand mode, then release the GPU while paused. */
export function PausedCameraFrames({
  paused,
  visible,
  mode,
}: {
  paused: boolean;
  visible: boolean;
  mode: CameraMode;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const remaining = useRef(0);
  useEffect(() => {
    remaining.current = paused && visible ? 1.2 : 0;
    if (remaining.current > 0) invalidate();
  }, [paused, visible, mode, invalidate]);
  useFrame((_, dt) => {
    if (remaining.current <= 0) return;
    remaining.current -= Math.min(dt, 0.1);
    if (remaining.current > 0) invalidate();
  });
  return null;
}
