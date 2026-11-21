import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { FpsMeasurementContext } from "@/game/fps-meter";
import { subscribeRenderedFrames, type RenderedFrameSample } from "../graphics-probe";

/** Opt-in bridge for this Canvas only. A ticking dialogue/portrait Canvas
 * cannot advance a suspended or unloaded match's measurement. */
export function RenderedFrameBridge({
  onFrame,
  context,
}: {
  onFrame: (frame: RenderedFrameSample, context: FpsMeasurementContext) => void;
  context: FpsMeasurementContext;
}) {
  const gl = useThree((state) => state.gl);
  const current = useRef({ onFrame, context });
  current.current = { onFrame, context };
  useEffect(() => {
    let previousKey = "";
    let width = 0,
      height = 0,
      dpr = 0;
    let measuredContext: FpsMeasurementContext | undefined;
    return subscribeRenderedFrames(gl, (frame) => {
      const state = current.current;
      if (
        !measuredContext ||
        previousKey !== state.context.key ||
        width !== frame.width ||
        height !== frame.height ||
        dpr !== frame.dpr
      ) {
        previousKey = state.context.key;
        width = frame.width;
        height = frame.height;
        dpr = frame.dpr;
        measuredContext = {
          ...state.context,
          key: `${previousKey}|${width}x${height}@${dpr}`,
        };
      }
      state.onFrame(frame, measuredContext);
    });
  }, [gl]);
  return null;
}
