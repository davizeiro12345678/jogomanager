import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { onKtx2Ready, retainKtx2 } from "@/game/textures/ktx2";

/** A Canvas owns decoder lifetime. Asset arrival redraws demand-rendered
 * portraits and paused dialogue without changing their simulation clock. */
export function Ktx2CanvasAssets({ enabled = true }: { enabled?: boolean }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = onKtx2Ready(() => invalidate());
    let release = retainKtx2(gl);
    const lost = () => {
      release();
      release = () => undefined;
    };
    const restored = () => {
      release();
      release = retainKtx2(gl);
      invalidate();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    return () => {
      unsubscribe();
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
      release();
    };
  }, [gl, invalidate, enabled]);
  return null;
}
