import { useFrame } from "@react-three/fiber";
import { createContext, useContext } from "react";
import { Vector3 } from "three";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";

export interface CinematicRuntimeState {
  clock: { time: number; dt: number };
  focus: Vector3;
  quality: QualityLevel;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  reduced: boolean;
}
export const CinematicContext = createContext<CinematicRuntimeState>({
  clock: { time: 0, dt: 0 },
  focus: new Vector3(0, 1.2, 0),
  quality: "media",
  reduced: false,
});
export const useCinematicRuntime = () => useContext(CinematicContext);

/** All actors, particles, lights and the lens share the same bounded clock. */
export function useCinematicFrame(callback: (time: number, dt: number) => void) {
  const runtime = useCinematicRuntime();
  useFrame(() => callback(runtime.clock.time, runtime.clock.dt));
}
