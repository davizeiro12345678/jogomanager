import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { kitFor } from "@/game/kits";
import { WorkerMatchView } from "@/game/live-match";
import {
  athleteAppearanceFromLegacy,
  athleteLookForAppearance,
  BODY_TYPE_FOR_BUILD,
  defaultAthleteAppearance,
  RIG_POSITION_FOR_CAREER,
  type AthleteAppearanceV1,
} from "@/game/player-career/appearance";
import type { Appearance, BodyBuild, PlayerPosition } from "@/game/player-career/types";
import { safeClub } from "@/game/squad";
import type { SimPlayer, TeamSetup } from "@/game/sim-types";
import { GraphicsBoundary } from "../GraphicsBoundary";
import { Ktx2CanvasAssets } from "../Ktx2CanvasAssets";
import { PortraitFrames } from "../PortraitFrames";
import { useVisibleGraphics } from "@/hooks/useVisibleGraphics";
import { useAccessibility } from "@/hooks/useAccessibility";
import { PlayerRig } from "./PlayerRig";

interface AthleteHeroData {
  seed: string;
  nickname: string;
  clubId: string;
  position: PlayerPosition;
  shirtNumber: number;
  heightCm: number;
  weightKg: number;
  build: BodyBuild;
  appearance: Appearance;
  appearanceV1?: AthleteAppearanceV1 | undefined;
}

interface AthleteHero3DProps {
  athlete: AthleteHeroData;
  className?: string;
}

function team(clubId: string): TeamSetup {
  const club = safeClub(clubId);
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: [],
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}

function portraitFixture(
  athlete: Pick<
    AthleteHeroData,
    "seed" | "clubId" | "nickname" | "position" | "shirtNumber" | "heightCm" | "weightKg"
  >,
) {
  const home = team(athlete.clubId);
  const away = team(athlete.clubId === "pal" ? "fla" : "pal");
  const view = new WorkerMatchView(home, away);
  const rigPosition = RIG_POSITION_FOR_CAREER[athlete.position];
  const player: SimPlayer = {
    id: `athlete-portrait-${athlete.seed}`,
    pid: athlete.seed,
    side: "home",
    name: athlete.nickname || "ATLETA",
    number: athlete.shirtNumber,
    pos: rigPosition,
    heightCm: athlete.heightCm,
    weightKg: athlete.weightKg,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    slotX: 0,
    slotZ: 0,
    pace: 80,
    shooting: 80,
    passing: 80,
    defending: 80,
    physical: 80,
    stamina: 100,
    action: null,
    actionT: 0,
    actionDur: 1.5,
    goals: 0,
    assists: 0,
    shots: 0,
    passes: 0,
    tackles: 0,
    saves: 0,
    onSince: 0,
    minutes: 0,
    yellows: 0,
    sentOff: false,
    injuryWeeks: 0,
    interceptions: 0,
    offsides: 0,
    foulsWon: 0,
    pensScored: 0,
    pensMissed: 0,
    xg: 0,
  };
  view.players = [player];
  view.ball.z = 40;
  return { view, player };
}

function appearanceFor(athlete: Omit<AthleteHeroData, "clubId" | "nickname">) {
  const role = RIG_POSITION_FOR_CAREER[athlete.position];
  const fallback = defaultAthleteAppearance(athlete.seed, role, BODY_TYPE_FOR_BUILD[athlete.build]);
  const appearance =
    athlete.appearanceV1 ?? athleteAppearanceFromLegacy(athlete.appearance, fallback);
  return athleteLookForAppearance({
    seed: athlete.seed,
    role,
    captain: athlete.shirtNumber === 10,
    appearance,
    heightCm: athlete.heightCm,
    weightKg: athlete.weightKg,
  });
}

function AthletePortraitScene({ athlete, paused }: { athlete: AthleteHeroData; paused: boolean }) {
  const {
    seed,
    clubId,
    nickname,
    position,
    shirtNumber,
    heightCm,
    weightKg,
    build,
    appearance: legacyAppearance,
    appearanceV1,
  } = athlete;
  const fixture = useMemo(
    () => portraitFixture({ seed, clubId, nickname, position, shirtNumber, heightCm, weightKg }),
    [seed, clubId, nickname, position, shirtNumber, heightCm, weightKg],
  );
  const appearance = useMemo(
    () =>
      appearanceFor({
        seed,
        position,
        shirtNumber,
        heightCm,
        weightKg,
        build,
        appearance: legacyAppearance,
        appearanceV1,
      }),
    [seed, position, shirtNumber, heightCm, weightKg, build, legacyAppearance, appearanceV1],
  );
  const club = safeClub(athlete.clubId);
  const kit = useMemo(
    () => kitFor(club.id, club.primary, club.secondary),
    [club.id, club.primary, club.secondary],
  );
  const pulse = useRef(0);

  return (
    <>
      <color attach="background" args={["#111d26"]} />
      <fog attach="fog" args={["#111d26", 5.5, 12]} />
      <hemisphereLight args={["#e7f1f7", "#17232c", 0.72]} />
      <directionalLight
        position={[-2.6, 5.5, 3.5]}
        color="#fff3e5"
        intensity={3.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0002}
        shadow-normalBias={0.002}
      />
      <directionalLight position={[2.8, 3.8, -2.5]} color="#8fc9ff" intensity={2.1} />
      <Environment frames={1} resolution={128}>
        <Lightformer position={[-2, 3, 4]} scale={[5, 4, 1]} intensity={1.5} color="#edf7ff" />
        <Lightformer
          position={[3, 2, -1]}
          rotation-y={-Math.PI / 2}
          scale={[4, 3, 1]}
          intensity={1}
          color={club.primary}
        />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.008} receiveShadow>
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial color="#1c2b35" roughness={0.82} />
      </mesh>
      <ContactShadows
        position={[0, 0.003, 0]}
        opacity={0.32}
        scale={3.2}
        blur={3.1}
        far={1.2}
        resolution={256}
        frames={1}
        color="#050b10"
      />
      <PlayerRig
        player={fixture.player}
        sim={fixture.view}
        kit={kit}
        goalPulse={pulse}
        quality="alta"
        portrait
        clothPhysics
        respectVisualSettings={false}
        lookOverride={appearance}
        previewClip="idle"
        paused={paused}
        previewRevision={JSON.stringify(appearance)}
      />
    </>
  );
}

function PortraitCamera() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(1.35, 1.28, 4.25);
    camera.lookAt(0, 1.02, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/** A lightweight model stays visible while the detailed rig and its assets load. */
function LoadingPortrait({ athlete }: { athlete: AthleteHeroData }) {
  const club = safeClub(athlete.clubId);
  const look = appearanceFor(athlete);
  return (
    <>
      <color attach="background" args={["#111d26"]} />
      <hemisphereLight args={["#e7f1f7", "#17232c", 1.1]} />
      <directionalLight position={[-2, 4, 3]} intensity={2.4} color="#fff3e5" />
      <directionalLight position={[2, 3, -2]} intensity={1.2} color="#8fc9ff" />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <circleGeometry args={[1.45, 40]} />
        <meshStandardMaterial color="#1c2b35" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.73, 0]} castShadow>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color={look.skin} roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.82, 0]} castShadow>
        <sphereGeometry args={[0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={look.hairColor} roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <capsuleGeometry args={[0.31, 0.52, 6, 16]} />
        <meshStandardMaterial color={club.primary} roughness={0.72} />
      </mesh>
      <mesh position={[-0.39, 1.1, 0]} rotation-z={0.14} castShadow>
        <capsuleGeometry args={[0.085, 0.52, 5, 12]} />
        <meshStandardMaterial color={look.skin} roughness={0.82} />
      </mesh>
      <mesh position={[0.39, 1.1, 0]} rotation-z={-0.14} castShadow>
        <capsuleGeometry args={[0.085, 0.52, 5, 12]} />
        <meshStandardMaterial color={look.skin} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.56, 0]} castShadow>
        <boxGeometry args={[0.46, 0.31, 0.3]} />
        <meshStandardMaterial color={club.secondary} roughness={0.8} />
      </mesh>
      <mesh position={[-0.13, 0.2, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.46, 5, 12]} />
        <meshStandardMaterial color={look.skin} roughness={0.82} />
      </mesh>
      <mesh position={[0.13, 0.2, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.46, 5, 12]} />
        <meshStandardMaterial color={look.skin} roughness={0.82} />
      </mesh>
      <ContactShadows position={[0, 0.006, 0]} opacity={0.32} scale={2.5} blur={2.5} far={1.3} />
    </>
  );
}

export function AthleteHero3D({ athlete, className }: AthleteHero3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const visible = useVisibleGraphics(host);
  const { reducedMotion } = useAccessibility();
  const paused = !visible || reducedMotion;
  return (
    <div
      ref={host}
      data-graphics-active={visible ? "true" : "false"}
      className={className}
      aria-label={`Modelo 3D de ${athlete.nickname || "atleta"}`}
    >
      <GraphicsBoundary
        fallback={
          <p className="athlete-preview-fallback">Prévia 3D indisponível neste aparelho.</p>
        }
      >
        <Canvas
          frameloop="demand"
          camera={{ position: [1.5, 1.4, 3.15], fov: 30 }}
          dpr={[1, 1.5]}
          shadows={{ type: THREE.PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.94;
          }}
          fallback={
            <p className="athlete-preview-fallback">Prévia 3D indisponível neste aparelho.</p>
          }
        >
          <PortraitFrames paused={paused} />
          <PortraitCamera />
          <Ktx2CanvasAssets portrait />
          <Suspense fallback={<LoadingPortrait athlete={athlete} />}>
            <AthletePortraitScene athlete={athlete} paused={paused} />
          </Suspense>
        </Canvas>
      </GraphicsBoundary>
    </div>
  );
}
