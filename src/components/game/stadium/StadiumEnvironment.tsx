import { Environment, Lightformer } from "@react-three/drei";
import { memo } from "react";
import { matchLighting } from "@/game/match-lighting";
import type { TimeOfDay, Weather } from "@/game/matchday";
import type { Quality } from "./quality";

/** Keep the one-frame IBL capture independent of goal/replay state. Drei
 * recaptures when its children change, even when frames is fixed at one. */
export const StadiumEnvironment = memo(function StadiumEnvironment({
  time,
  weather,
  quality,
  textureScale,
}: {
  time: TimeOfDay;
  weather: Weather;
  quality: Quality;
  textureScale: number;
}) {
  if (quality === "baixa") return null;
  const lighting = matchLighting(time, weather, false);
  return (
    <Environment
      resolution={Math.round((quality === "alta" ? 384 : 192) * textureScale)}
      frames={1}
    >
      <color attach="background" args={[lighting.sky]} />
      <Lightformer
        intensity={
          quality === "media" && time === "dia" && (weather === "seco" || weather === "molhado")
            ? 1.75
            : lighting.environmentKey
        }
        color={lighting.keyColor}
        position={[0, 24, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[60, 60, 1]}
      />
      <Lightformer
        intensity={time === "noite" ? 2.4 : 1.2}
        color="#dceaff"
        position={[-30, 14, 0]}
        rotation-y={Math.PI / 2}
        scale={[60, 8, 1]}
      />
      <Lightformer
        intensity={time === "noite" ? 2.4 : 1.2}
        color="#dceaff"
        position={[30, 14, 0]}
        rotation-y={-Math.PI / 2}
        scale={[60, 8, 1]}
      />
      <Lightformer
        intensity={0.8}
        color={
          time === "entardecer" && weather !== "chuva" && weather !== "neve" ? "#ff9b5c" : "#d5e3ef"
        }
        position={[0, 6, -40]}
        scale={[60, 8, 1]}
      />
    </Environment>
  );
});
