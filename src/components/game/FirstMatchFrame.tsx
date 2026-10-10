import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { subscribeRenderedFrames } from "./graphics-probe";
import { rendererMetadata } from "@/game/graphics-renderer-metadata";

/** Measures mount through the first completed draw, including renderer setup
 * and procedural geometry. It does not claim network navigation or full LOD
 * readiness; those are separate loading phases. */
export function FirstMatchFrame({
  startedAt,
  quality,
  backend,
  onFirstFrame,
}: {
  startedAt: number;
  quality: string;
  backend: string;
  onFirstFrame?: (() => void) | undefined;
}) {
  const gl = useThree((state) => state.gl);
  const notified = useRef(false);
  const firstFrameCallback = useRef(onFirstFrame);
  firstFrameCallback.current = onFirstFrame;
  useEffect(() => {
    let sent = false;
    return subscribeRenderedFrames(gl, (frame) => {
      if (sent) return;
      sent = true;
      const elapsedMs = frame.now - startedAt;
      window.dispatchEvent(
        new CustomEvent("graphics-ready", {
          detail: {
            elapsedMs,
            targetMs: 1000,
            meetsTarget: elapsedMs <= 1000,
            scope: "Stadium3D mount to first completed draw",
            quality,
            requestedBackend: backend,
            ...rendererMetadata(gl),
            ...frame,
          },
        }),
      );
      if (!notified.current) {
        notified.current = true;
        firstFrameCallback.current?.();
      }
    });
  }, [gl, startedAt, quality, backend]);
  return null;
}
