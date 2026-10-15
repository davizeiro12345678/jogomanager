import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { SceneArt } from "@/content/cutscenes";
import type { LineLight } from "@/game/cutscene-director";
import type { QualityLevel } from "@/game/device";
import type { CinematicSet } from "@/game/cinematic-blocking";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic-runtime";

const PLACEMENT: Record<
  CinematicSet,
  { position: [number, number, number]; distance: number; intensity: number }
> = {
  locker: { position: [-1.4, 3.62, -1.4], distance: 10, intensity: 4.2 },
  tunnel: { position: [0, 2.42, -8.6], distance: 15, intensity: 3.6 },
  press: { position: [-2.2, 3.65, -1.4], distance: 11, intensity: 3.8 },
  pitch: { position: [-8.2, 5.2, -6.2], distance: 23, intensity: 4.5 },
  stands: { position: [0, 6.4, -7.8], distance: 22, intensity: 3.8 },
  office: { position: [-2.38, 1.5, -1.72], distance: 7, intensity: 2.15 },
  arrival: { position: [-2.8, 1.8, 4.65], distance: 12, intensity: 3.1 },
};

const COLOR_BY_LINE: Record<LineLight, string> = {
  neutra: "#fff1dc",
  quente: "#ffc987",
  fria: "#a9c8ff",
  dramatica: "#ff8b94",
  festa: "#ffe29a",
};

/** One motivated accent light per set preserves depth when a shot cuts to a close-up. */
export function CinematicMotivatedLight({
  kind,
  art,
  mood,
  light,
  quality,
}: {
  kind: CinematicSet;
  art: SceneArt;
  mood: "good" | "bad" | "neutral";
  light: LineLight;
  quality: QualityLevel;
}) {
  const source = useRef<THREE.PointLight>(null);
  const spill = useRef<THREE.PointLight>(null);
  const runtime = useCinematicRuntime();
  const first = useRef(true);
  const setup = PLACEMENT[kind];
  const color = useMemo(() => {
    if (art === "medical") return "#9ad7cf";
    if (kind === "arrival") return "#ffd5a4";
    if (mood === "bad" && light === "neutra") return "#a8c5ff";
    return COLOR_BY_LINE[light];
  }, [art, kind, light, mood]);
  const targetColor = useMemo(() => new THREE.Color(color), [color]);
  useCinematicFrame((_, dt) => {
    if (!source.current) return;
    // Practical fixtures hold steady. Mood changes settle like exposure, while
    // photographer flashes remain driven by their own visible sources.
    const blend = first.current || runtime.reduced ? 1 : 1 - Math.exp(-3.6 * dt);
    first.current = false;
    source.current.color.lerp(targetColor, blend);
    // The locker strip is a neutral practical. Dramatic dialogue can tint
    // the accent, but should not turn every white fixture pink or blue.
  });
  if (quality === "baixa") return null;
  return (
    <>
      <pointLight
        ref={source}
        position={setup.position}
        color="#fff1dc"
        intensity={setup.intensity}
        distance={setup.distance}
        decay={2}
      />
      {kind === "locker" && art === "dressing" ? (
        <pointLight
          ref={spill}
          position={[4.6, 2.08, -3.18]}
          color="#fff0dc"
          intensity={1.05}
          distance={6.8}
          decay={2}
        />
      ) : null}
    </>
  );
}
