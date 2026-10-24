import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { schedulePortraitFrames } from "./portrait-frame-budget";

export function PortraitFrames({ paused }: { paused: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => (paused ? undefined : schedulePortraitFrames(invalidate)), [paused, invalidate]);
  return null;
}
