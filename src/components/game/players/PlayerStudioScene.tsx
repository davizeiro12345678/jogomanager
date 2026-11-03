import { CLIP_NAMES, type ClipName } from "@/game/animation";
import { gkKitFor, kitFor } from "@/game/kits";
import { type PlayerLook } from "@/game/player-model";
import { studioAppearanceRevision } from "@/game/player-studio-appearance";
import { studioCameraFit } from "@/game/player-studio-camera";
import { studioBallFocusDistanceFor } from "@/game/player-studio-presentation";
import type { RigSkin } from "@/game/rig-skin";
import { useAccessibility } from "@/hooks/useAccessibility";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { isCoarsePointer } from "@/game/device";
import { LowPlayers } from "./LowPlayers";
import { PlayerRig } from "./PlayerRig";
import { type CameraCommand, MOVEMENTS, fixture } from "./player-studio-setup";

export function StudioScene({
  preview,
  movement,
  light,
  detail,
  paused,
  framing,
  stamina,
  previewAt,
  appearance,
  viewReset,
  viewAngle,
  cameraCommand,
  clothPhysics,
}: {
  preview: ReturnType<typeof fixture>;
  movement: (typeof MOVEMENTS)[number];
  light: string;
  detail: boolean;
  paused: boolean;
  framing: string;
  stamina: number;
  previewAt?: number | undefined;
  appearance: PlayerLook;
  viewReset: number;
  viewAngle: string;
  cameraCommand: CameraCommand;
  clothPhysics: boolean;
}) {
  const pulse = useRef(0);
  const actionClock = useRef(0);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const { reducedMotion } = useAccessibility();
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !cameraCommand) return;
    if (cameraCommand.action === "left" || cameraCommand.action === "right") {
      orbit.setAzimuthalAngle(
        orbit.getAzimuthalAngle() + (cameraCommand.action === "left" ? -0.26 : 0.26),
      );
    } else {
      const offset = camera.position.clone().sub(orbit.target);
      const next = THREE.MathUtils.clamp(
        offset.length() * (cameraCommand.action === "in" ? 0.84 : 1.18),
        orbit.minDistance,
        orbit.maxDistance,
      );
      camera.position.copy(orbit.target).add(offset.setLength(next));
    }
    orbit.update();
    camera.updateMatrixWorld();
    invalidate();
  }, [cameraCommand, camera, invalidate]);
  const height = appearance.height * 1.8;
  const inspection = useMemo(
    () => ({
      target: new THREE.Vector3(),
      second: new THREE.Vector3(),
      delta: new THREE.Vector3(),
    }),
    [],
  );
  const inspectPose = useMemo(
    () => (skin: RigSkin) => {
      if (framing === "body" || !controls.current) return;
      const bones = skin.boneOf;
      if (framing === "hands") {
        bones.handL.getWorldPosition(inspection.target);
        bones.handR.getWorldPosition(inspection.second);
        inspection.target.add(inspection.second).multiplyScalar(0.5);
      } else if (framing === "face") {
        bones.face.getWorldPosition(inspection.target);
        inspection.target.y -= height * 0.012;
      } else if (framing === "kit") {
        bones.chest.getWorldPosition(inspection.target);
        inspection.target.y += height * 0.04;
      } else {
        const left = framing === "boots" ? bones.ankleL : bones.kneeL;
        const right = framing === "boots" ? bones.ankleR : bones.kneeR;
        left.getWorldPosition(inspection.target);
        right.getWorldPosition(inspection.second);
        inspection.target.add(inspection.second).multiplyScalar(0.5);
      }
      inspection.delta.copy(inspection.target).sub(controls.current.target);
      camera.position.add(inspection.delta);
      controls.current.target.copy(inspection.target);
      controls.current.update();
    },
    [camera, framing, height, inspection],
  );
  const overrides = useMemo(
    () => new Map([[preview.player.id, appearance]]),
    [preview, appearance],
  );
  // R3F primitives own the Three.js scene object outside React's ordinary
  // DOM lifecycle.  Appearance edits change the skinned geometry itself, so
  // give the rig a semantic revision key and never leave an old hair/beard
  // shell attached after a Studio select changes.
  const appearanceRevision = useMemo(() => studioAppearanceRevision(appearance), [appearance]);
  // An idle inspection stays idle instead of randomly selecting a team
  // gesture from the match state machine. Actions still use their phases.
  const previewClip =
    !movement.action && CLIP_NAMES.includes(movement.id as ClipName)
      ? (movement.id as ClipName)
      : undefined;
  const ballFocusDistance = studioBallFocusDistanceFor(movement);
  useLayoutEffect(() => {
    const ball = preview.view.ball;
    // This fixture target is presentation-only. PlayerRig still owns the
    // shared gaze calculation, so match play and action clips stay untouched.
    ball.x = 0;
    ball.z = ballFocusDistance;
    ball.height = 0.12;
    ball.holder = movement.hasBall ? preview.player.id : null;
  }, [ballFocusDistance, movement.hasBall, preview]);
  const overhead = /^(throwIn|saveHigh|diveLeft|diveRight|header|celebrate)$/.test(
    movement.action ?? "",
  );
  const groundAction = movement.action === "slide";
  const cameraFit = useMemo(
    () =>
      studioCameraFit(
        height,
        size.width / Math.max(1, size.height),
        32,
        framing,
        overhead,
        groundAction,
      ),
    [height, size.width, size.height, framing, overhead, groundAction],
  );
  // A real wide studio viewport left the hero visually small, with unused
  // floor and side space. Preserve the camera-fit envelope for actions and
  // narrow displays, but spend part of its standing-body safety margin on
  // presence where width is available.
  const bodyPresenceScale =
    size.width / Math.max(1, size.height) >= 0.9
      ? 0.89
      : size.width / Math.max(1, size.height) >= 0.6
        ? 0.92
        : 0.96;
  const presentationDistance =
    framing === "body" && !overhead && !groundAction
      ? cameraFit.distance * bodyPresenceScale
      : cameraFit.distance;
  const targetY =
    framing === "face"
      ? height - 0.12
      : framing === "kit"
        ? height * 0.68
        : framing === "legs"
          ? height * 0.34
          : framing === "hands"
            ? height * 0.41
            : framing === "boots"
              ? 0.15
              : height * (overhead ? 0.66 : groundAction ? 0.32 : 0.5);
  useEffect(() => {
    const close = framing === "face",
      shirt = framing === "kit",
      feet = framing === "boots",
      hands = framing === "hands",
      legs = framing === "legs";
    camera.position.set(
      close
        ? 0.32
        : shirt
          ? 0.65
          : legs
            ? 0.8
            : hands
              ? 0.7
              : feet
                ? 0.55
                : overhead
                  ? 3.2
                  : groundAction
                    ? 2.2
                    : 1.8,
      close
        ? height - 0.08
        : shirt
          ? height * 0.75
          : legs
            ? height * 0.4
            : hands
              ? height * 0.44
              : feet
                ? 0.48
                : overhead
                  ? 1.9
                  : groundAction
                    ? 1.35
                    : 1.55,
      close
        ? 0.68
        : shirt
          ? 1.5
          : legs
            ? 2.1
            : hands
              ? 0.85
              : feet
                ? 0.85
                : overhead
                  ? 4.8
                  : groundAction
                    ? 3.8
                    : 3.2,
    );
    // Preserve the inspection angle while fitting the physical athlete to the
    // available canvas, including height changes and narrow, tall screens.
    camera.position.y -= targetY;
    camera.position.normalize().multiplyScalar(presentationDistance);
    camera.position.y += targetY;
    if (viewAngle !== "threeQuarter") {
      const radius = Math.hypot(camera.position.x, camera.position.z);
      camera.position.x = viewAngle === "profile" ? radius : 0;
      camera.position.z = viewAngle === "profile" ? 0 : viewAngle === "back" ? -radius : radius;
    }
    camera.lookAt(0, targetY, 0);
    camera.updateMatrixWorld();
    controls.current?.target.set(0, targetY, 0);
    controls.current?.update();
    invalidate();
  }, [
    framing,
    height,
    targetY,
    overhead,
    groundAction,
    camera,
    invalidate,
    size.width,
    size.height,
    viewReset,
    viewAngle,
    cameraFit,
    presentationDistance,
  ]);
  const kit = useMemo(
    () => kitFor(preview.view.home.clubId, preview.view.home.primary, preview.view.home.secondary),
    [preview],
  );
  const keeperKit = useMemo(() => gkKitFor(preview.view.home.clubId), [preview]);
  useLayoutEffect(() => {
    if (previewAt === undefined || !movement.action) return;
    const player = preview.player;
    player.vx = player.vz = 0;
    player.action = movement.action;
    player.actionDur = 1.5;
    player.actionT = (1 - previewAt) * player.actionDur;
    player.stamina = stamina;
    actionClock.current = previewAt * player.actionDur;
    preview.view.time = actionClock.current;
    invalidate();
  }, [previewAt, movement, preview, stamina, invalidate]);
  useFrame((_, dt) => {
    if (paused) return;
    actionClock.current += Math.min(dt, 0.25);
    const player = preview.player;
    const tempo = (actionClock.current % 6) / 6;
    const ramp = THREE.MathUtils.smoothstep(tempo, 0.15, 0.72);
    const pace =
      movement.profile === "accelerate"
        ? 0.2 + ramp * movement.speed
        : movement.profile === "brake"
          ? movement.speed * (1 - ramp)
          : movement.speed;
    const curve = movement.profile === "curve" ? Math.sin(actionClock.current * 0.7) * 0.85 : 0;
    player.vx = movement.lateral ?? Math.sin(curve) * pace;
    player.vz = movement.lateral ? 0 : Math.cos(curve) * pace * (movement.reverse ? -1 : 1);
    player.stamina = stamina;
    preview.view.ball.holder = movement.hasBall ? player.id : null;
    preview.view.possession = movement.lateral || movement.reverse ? "away" : "home";
    preview.view.time = actionClock.current;
    player.actionDur = 1.5;
    const cycle = actionClock.current % 2.7;
    player.action = cycle < 1.5 ? movement.action : null;
    player.actionT = Math.max(0, 1.5 - cycle);
  });
  const warm = light === "entardecer";
  return (
    <>
      <color attach="background" args={[light === "noite" ? "#101922" : "#253441"]} />
      <fog attach="fog" args={[light === "noite" ? "#101922" : "#253441", 6, 15]} />
      <hemisphereLight args={["#e5edf2", "#29323a", light === "noite" ? 0.24 : 0.38]} />
      <directionalLight
        position={[-2.2, 7.5, 2.4]}
        color={warm ? "#ffd5aa" : "#fff4e9"}
        intensity={3.05}
        castShadow={!isCoarsePointer()}
        shadow-intensity={0.38}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      <directionalLight
        position={[2, 3.4, -3]}
        color={light === "noite" ? "#8cbce8" : "#c5dded"}
        intensity={2.2}
      />
      <directionalLight position={[3.5, 2.3, 4]} color="#e4edf4" intensity={1.05} />
      <spotLight
        position={[-2.4, 3.1, -2.8]}
        color={light === "noite" ? "#87b8ff" : warm ? "#ffc99f" : "#d7ebff"}
        intensity={22}
        angle={0.56}
        penumbra={0.72}
        distance={9}
        decay={2}
      />
      <Environment key={light} frames={1} resolution={128}>
        <Lightformer
          position={[-2, 3, 4]}
          scale={[5, 4, 1]}
          intensity={1.4}
          color={warm ? "#ffe5cc" : "#eef4ff"}
        />
        <Lightformer
          position={[-3, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[3, 3, 1]}
          intensity={0.65}
          color="#d6e4f0"
        />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#283641" roughness={0.87} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.003, 0]} receiveShadow>
        <circleGeometry args={[1.65, 64]} />
        <meshStandardMaterial color="#354753" roughness={0.76} metalness={0.05} />
      </mesh>
      {detail ? (
        <PlayerRig
          key={appearanceRevision}
          player={preview.player}
          sim={preview.view}
          kit={preview.player.pos === "GK" ? keeperKit : kit}
          goalPulse={pulse}
          quality="alta"
          clothPhysics={clothPhysics}
          portrait
          respectVisualSettings={false}
          paused={paused}
          previewAt={previewAt}
          lookOverride={appearance}
          previewClip={previewClip}
          onPoseReady={framing === "body" ? undefined : inspectPose}
        />
      ) : (
        <LowPlayers
          sim={preview.view}
          homeKit={kit}
          awayKit={kit}
          homeGkKit={keeperKit}
          awayGkKit={keeperKit}
          paused={paused}
          previewAt={previewAt}
          lookOverrides={overrides}
          previewClip={previewClip}
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, targetY, 0]}
        enablePan={false}
        enableZoom
        enableDamping={!reducedMotion}
        minDistance={cameraFit.minDistance}
        maxDistance={cameraFit.maxDistance}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </>
  );
}
