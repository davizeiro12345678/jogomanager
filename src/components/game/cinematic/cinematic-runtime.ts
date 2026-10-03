import { useFrame } from "@react-three/fiber";
import { createContext, useContext } from "react";
import { Vector3 } from "three";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import type { CinematicManner } from "@/game/cinematic-actor";
import type { CinematicCue } from "@/game/cinematic-cue";
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";

export interface CinematicRuntimeState {
  clock: { time: number; dt: number; lineTime: number };
  focus: Vector3;
  quality: QualityLevel;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  stopped: boolean;
  reduced: boolean;
  manner?: CinematicManner | undefined;
  cue?: CinematicCue | undefined;
  voiceClockRef?: CinematicVoiceClockRef | undefined;
}
export const CinematicContext = createContext<CinematicRuntimeState>({
  clock: { time: 0, dt: 0, lineTime: 0 },
  focus: new Vector3(0, 1.2, 0),
  quality: "media",
  stopped: false,
  reduced: false,
});
export const useCinematicRuntime = () => useContext(CinematicContext);

/** All actors, particles, lights and the lens share the same bounded clock. */
export function useCinematicFrame(callback: (time: number, dt: number) => void) {
  const runtime = useCinematicRuntime();
  useFrame(() => callback(runtime.clock.time, runtime.clock.dt));
}
