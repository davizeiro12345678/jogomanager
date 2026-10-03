import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import { Vector3 } from "three";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { QualityLevel } from "@/game/device";
import { cinematicDelta } from "@/game/cinematic-performance";
import type { CinematicManner } from "@/game/cinematic-actor";
import type { CinematicCue } from "@/game/cinematic-cue";
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";
import { CinematicContext } from "./cinematic-runtime";

export function CinematicRuntime({
  children,
  quality,
  look,
  cast,
  stopped,
  reduced,
  manner,
  previewTime = 0,
  cue,
  voiceClockRef,
}: {
  children: ReactNode;
  quality: QualityLevel;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  stopped: boolean;
  reduced: boolean;
  manner?: CinematicManner | undefined;
  previewTime?: number | undefined;
  cue?: CinematicCue | undefined;
  voiceClockRef?: CinematicVoiceClockRef | undefined;
}) {
  const clock = useRef({
    time: Number.isFinite(previewTime) ? Math.max(0, Math.min(60, previewTime)) : 0,
    dt: 0,
    lineTime: 0,
  });
  const previousCue = useRef(cue?.id);
  const focus = useMemo(() => new Vector3(0, 1.2, 0), []);
  const runtime = useMemo(
    () => ({
      clock: clock.current,
      focus,
      quality,
      look,
      cast,
      stopped,
      reduced,
      manner,
      cue,
      voiceClockRef,
    }),
    [quality, look, cast, stopped, reduced, focus, manner, cue, voiceClockRef],
  );
  useFrame((_, raw) => {
    clock.current.dt = cinematicDelta(raw, stopped || reduced);
    if (previousCue.current !== cue?.id) {
      previousCue.current = cue?.id;
      clock.current.lineTime = 0;
    }
    clock.current.time += clock.current.dt;
    clock.current.lineTime += clock.current.dt;
  }, -100);
  return <CinematicContext.Provider value={runtime}>{children}</CinematicContext.Provider>;
}
