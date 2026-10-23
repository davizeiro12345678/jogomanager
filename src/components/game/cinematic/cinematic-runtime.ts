import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { Vector3 } from "three";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import type { CinematicManner } from "@/game/cinematic-actor";
import type { CinematicCue } from "@/game/cinematic-cue";
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";

export interface CinematicRuntimeState {
  clock: { time: number; dt: number; lineTime: number };
  frames: Set<CinematicFrameCallback>;
  focus: Vector3;
  quality: QualityLevel;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  stopped: boolean;
  reduced: boolean;
  manner?: CinematicManner | undefined;
  cue?: CinematicCue | undefined;
  voiceClockRef?: CinematicVoiceClockRef | undefined;
  voicePlayingRef?: { current: boolean } | undefined;
}

export type CinematicFrameCallback = (time: number, dt: number) => void;

export const CinematicContext = createContext<CinematicRuntimeState>({
  clock: { time: 0, dt: 0, lineTime: 0 },
  frames: new Set(),
  focus: new Vector3(0, 1.2, 0),
  quality: "media",
  stopped: false,
  reduced: false,
});
export const useCinematicRuntime = () => useContext(CinematicContext);

/** All cinematic updates share one R3F subscription and one bounded clock. */
export function useCinematicFrame(callback: CinematicFrameCallback) {
  const runtime = useCinematicRuntime();
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useLayoutEffect(() => {
    const dispatch: CinematicFrameCallback = (time, dt) => callbackRef.current(time, dt);
    runtime.frames.add(dispatch);
    return () => {
      runtime.frames.delete(dispatch);
    };
  }, [runtime.frames]);
}
