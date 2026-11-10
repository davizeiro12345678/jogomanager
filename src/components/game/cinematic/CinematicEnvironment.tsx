import { Environment, Lightformer } from "@react-three/drei";
import { memo } from "react";
import type { QualityLevel } from "@/game/device";

/** Dialogue cuts do not change the IBL. Recapture only for its actual colour
 * or resolution inputs; warm already includes the authored mood/line tint. */
export const CinematicEnvironment = memo(function CinematicEnvironment({
  quality,
  warm,
}: {
  quality: QualityLevel;
  warm: string;
}) {
  if (quality === "baixa") return null;
  return (
    <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
      <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
      <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color="#d6e5f4" />
      <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={0.8} color="#e6dfd3" />
    </Environment>
  );
});
