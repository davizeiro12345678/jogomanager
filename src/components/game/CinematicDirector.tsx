/** Independent cinematic camera director, authored scene logic only. */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Cutscene, SceneArt, Speaker } from "@/content/cutscene-types";
import type { ShotSize } from "@/game/cutscene-director";
import { cinematicIdleAt } from "@/game/cinematic-actor";
import {
  cinematicCameraTransition,
  type CinematicCameraTransitionInput,
} from "@/game/cinematic-camera-transition";
import { cinematicShotFor } from "@/game/cinematic-shot";
import { cinematicBusinessShot } from "@/game/cinematic-business-shot";
import { cinematicDrillFor } from "@/game/cinematic-action";
import {
  cinematicReactionReady,
  cinematicReactionSpeaker,
  cinematicStageActorFor,
  type CinematicSet,
} from "@/game/cinematic-blocking";
import { useCinematicRuntime } from "./cinematic/cinematic-runtime";

type SetKind = CinematicSet;

export function CinematicDirector({
  business,
  kind,
  art,
  beat,
  intensity = 0,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  speaker = null,
  festive = false,
}: {
  business?: Cutscene["business"];
  kind: SetKind;
  art?: SceneArt;
  beat: number;
  intensity?: number;
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  speaker?: Speaker | null;
  festive?: boolean;
}) {
  const runtime = useCinematicRuntime();
  const position = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lastFraming = useRef<CinematicCameraTransitionInput | null>(null);
  const lastCue = useRef<string | undefined>(undefined);
  const lastAspect = useRef(0);
  useFrame(({ camera }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    // Pausing audio must not accidentally trigger the end-of-line reaction cut.
    // A new dialogue cue still composes its first frame for static inspection.
    if (
      runtime.stopped &&
      lastFraming.current &&
      lastCue.current === runtime.cue?.id &&
      lastAspect.current === camera.aspect
    )
      return;
    lastCue.current = runtime.cue?.id;
    lastAspect.current = camera.aspect;
    const { time, lineTime } = runtime.clock;
    const opening = beat === 0 && lineTime < 1.45 && !runtime.reduced;
    const drill = cinematicDrillFor(runtime.cue?.id.split(":")[0]);
    const sceneArt = art ?? "dressing";
    const speakingActor = cinematicStageActorFor(sceneArt, speaker, festive, time, drill);
    const listener = cinematicReactionSpeaker(kind, speaker, art);
    const listenerActor = listener
      ? cinematicStageActorFor(sceneArt, listener, festive, time, drill)
      : null;
    const reaction =
      cinematicReactionReady(
        lineTime,
        runtime.cue?.duration ?? 5,
        runtime.voicePlayingRef?.current ?? false,
        Boolean(runtime.cue && !runtime.cue.decision && !opening && !festive),
      ) && listenerActor?.presence === "resident";
    const stagedActor = reaction ? listenerActor : speakingActor;
    const subject = stagedActor?.role ?? null;
    const shotSize = reaction ? "medio" : size;
    const insert = subject === null ? cinematicBusinessShot(business, camera.aspect) : null;
    const shot =
      insert ??
      cinematicShotFor(
        kind,
        subject,
        shotSize,
        camera.aspect,
        festive,
        opening,
        art,
        beat,
        time,
        drill,
      );
    position.fromArray(shot.position);
    target.fromArray(shot.target);
    const framing: CinematicCameraTransitionInput = {
      scene: sceneArt,
      framing: shot.framing,
      subject: subject ?? "environment",
      size: shotSize,
      reaction,
      opening,
    };
    const cut = cinematicCameraTransition(lastFraming.current, framing) === "cut";
    lastFraming.current = framing;
    const focus = shotSize !== "geral" && shot.framing === "dialogue";
    if (focus && kind === "locker" && art !== "gym" && art !== "medical" && subject === "captain") {
      const idle = cinematicIdleAt(time, 5, true);
      const rise = idle.kind === "rise" ? idle.weight * 0.45 : 0;
      position.y += rise;
      target.y += rise;
    }
    if (!runtime.reduced) {
      const u = Math.min(1, lineTime / Math.max(3, runtime.cue?.duration ?? 5));
      const eased = u * u * (3 - 2 * u);
      const travel = THREE.MathUtils.clamp((dollyTo - dollyFrom) * 0.18 * eased, -0.04, 0.13);
      position.lerp(target, travel);
      // Dolly on a small arc, with sub-centimetre handheld only on tense lines.
      const motion = focus ? 0.045 : 0.16;
      position.x += Math.sin(lineTime * 0.27) * motion;
      position.y += Math.sin(time * 1.3) * intensity * 0.003;
      position.z += Math.sin(lineTime * 0.2) * motion * 0.5;
    }
    // A cut snaps to a composed shot. Only the movement inside that shot drifts.
    if (cut || runtime.stopped || runtime.reduced) {
      camera.position.copy(position);
      runtime.focus.copy(target);
    } else {
      const k = 1 - Math.exp(-8 * runtime.clock.dt);
      camera.position.lerp(position, k);
      runtime.focus.lerp(target, k);
    }
    camera.lookAt(runtime.focus);
    const fov = shot.fov - (climax && focus ? 1 : 0);
    const nextFov =
      cut || runtime.stopped || runtime.reduced
        ? fov
        : THREE.MathUtils.damp(camera.fov, fov, 8, runtime.clock.dt);
    if (Math.abs(camera.fov - nextFov) > 0.01) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    camera.userData["cinematicFraming"] = shot.framing;
    camera.userData["cinematicSubject"] = stagedActor?.role ?? "environment";
    camera.userData["cinematicActorPresence"] = stagedActor?.presence ?? "environment";
    camera.userData["cinematicShotType"] =
      opening || shot.framing === "establishing" ? "master" : reaction ? "reaction" : "dialogue";
  });
  return null;
}
