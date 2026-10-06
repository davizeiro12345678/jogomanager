import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { kitFor } from "@/game/kits";
import { WorkerMatchView } from "@/game/live-match";
import {
  lookFor,
  lookWithPhysique,
  type BeardStyle,
  type BodyType,
  type HairStyle,
  type PlayerLook,
} from "@/game/player-model";
import type { Appearance, BodyBuild, PlayerPosition } from "@/game/player-career/types";
import { safeClub } from "@/game/squad";
import type { SimPlayer, TeamSetup } from "@/game/sim";
import { GraphicsBoundary } from "../GraphicsBoundary";
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
}

interface AthleteHero3DProps {
  athlete: AthleteHeroData;
  className?: string;
}

const SKIN_TONES = ["#f4d3b5", "#e2b48c", "#c68a5d", "#a0673f", "#7a4a2a", "#4e2e1a"];
const HAIR_COLORS = ["#1b1410", "#4a2f1d", "#8a5a2b", "#d8b46a", "#b5b5b5"];
const HAIR_STYLES: HairStyle[] = [
  "buzz",
  "short",
  "short",
  "curly",
  "afro",
  "braids",
  "bun",
  "mohawk",
  "medium",
  "ponytail",
];
const BEARDS: BeardStyle[] = ["none", "stubble", "goatee", "full"];
const POSITION_TO_RIG: Record<PlayerPosition, string> = {
  GOL: "GK",
  ZAG: "DF",
  LAT: "DF",
  VOL: "MF",
  MEI: "MF",
  PON: "FW",
  ATA: "FW",
};
const BUILD_TO_BODY: Record<BodyBuild, BodyType> = {
  leve: "slim",
  atletico: "normal",
  forte: "strong",
};

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

function portraitFixture(athlete: AthleteHeroData) {
  const home = team(athlete.clubId);
  const away = team(athlete.clubId === "pal" ? "fla" : "pal");
  const view = new WorkerMatchView(home, away);
  const rigPosition = POSITION_TO_RIG[athlete.position];
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

function appearanceFor(athlete: AthleteHeroData): PlayerLook {
  const base = lookFor(athlete.seed, POSITION_TO_RIG[athlete.position], athlete.shirtNumber === 10);
  const bodyType = BUILD_TO_BODY[athlete.build];
  return lookWithPhysique(
    {
      ...base,
      skin: SKIN_TONES[athlete.appearance.skin] ?? base.skin,
      hairColor: HAIR_COLORS[athlete.appearance.hairColor] ?? base.hairColor,
      hairStyle: HAIR_STYLES[athlete.appearance.hair] ?? base.hairStyle,
      beard: BEARDS[athlete.appearance.beard] ?? base.beard,
      bodyType,
      girth: bodyType === "strong" ? 1.08 : bodyType === "slim" ? 0.92 : 1,
      sleeves: "short",
    },
    { height: athlete.heightCm, weight: athlete.weightKg },
  );
}

function AthletePortraitScene({ athlete }: { athlete: AthleteHeroData }) {
  const fixture = useMemo(() => portraitFixture(athlete), [athlete.seed, athlete.clubId, athlete.nickname, athlete.position, athlete.shirtNumber, athlete.heightCm, athlete.weightKg]);
  const appearance = useMemo(() => appearanceFor(athlete), [athlete.seed, athlete.position, athlete.shirtNumber, athlete.heightCm, athlete.weightKg, athlete.build, athlete.appearance]);
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
        shadow-normalBias={0.02}
      />
      <directionalLight position={[2.8, 3.8, -2.5]} color="#8fc9ff" intensity={2.1} />
      <Environment frames={1} resolution={128}>
        <Lightformer position={[-2, 3, 4]} scale={[5, 4, 1]} intensity={1.5} color="#edf7ff" />
        <Lightformer position={[3, 2, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} intensity={1} color={club.primary} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.008} receiveShadow>
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial color="#1c2b35" roughness={0.82} />
      </mesh>
      <ContactShadows position={[0, 0.003, 0]} opacity={0.32} scale={3.2} blur={3.1} far={1.2} resolution={256} frames={1} color="#050b10" />
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
      />
    </>
  );
}

export function AthleteHero3D({ athlete, className }: AthleteHero3DProps) {
  return (
    <div className={className} aria-label={`Modelo 3D de ${athlete.nickname || "atleta"}`}>
      <GraphicsBoundary>
        <Canvas
          camera={{ position: [1.5, 1.4, 3.15], fov: 30 }}
          dpr={[1, 1.5]}
          shadows={{ type: THREE.PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.94;
          }}
          fallback={<p className="athlete-preview-fallback">Prévia 3D indisponível neste aparelho.</p>}
        >
          <AthletePortraitScene athlete={athlete} />
        </Canvas>
      </GraphicsBoundary>
    </div>
  );
}