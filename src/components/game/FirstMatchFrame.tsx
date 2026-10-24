import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

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
    return addAfterEffect(() => {
      if (sent || gl.info.render.calls === 0) return;
      sent = true;
      const elapsedMs = performance.now() - startedAt;
      window.dispatchEvent(
        new CustomEvent("graphics-ready", {
          detail: {
            elapsedMs,
            targetMs: 1000,
            meetsTarget: elapsedMs <= 1000,
            scope: "Stadium3D mount to first completed draw",
            quality,
            backend,
            draws: gl.info.render.calls,
            triangles: gl.info.render.triangles,
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
