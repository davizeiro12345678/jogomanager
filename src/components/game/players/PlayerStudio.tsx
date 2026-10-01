import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { PlayerAction } from "@/game/animation";
import { kitFor, gkKitFor } from "@/game/kits";
import { WorkerMatchView } from "@/game/live-match";
import { lookFor } from "@/game/player-model";
import { getAnnotatedClip } from "@/game/register-animations";
import { footballContactAt } from "@/game/motion-metadata";
import { safeClub } from "@/game/squad";
import type { SimPlayer, TeamSetup } from "@/game/sim";
import { GraphicsBoundary } from "../GraphicsBoundary";
import { PlayerRig } from "./PlayerRig";
import { LowPlayers } from "./LowPlayers";

interface StudioMovement {
  id: string;
  label: string;
  speed: number;
  action: PlayerAction | null;
  lateral?: number;
  reverse?: boolean;
  profile?: "accelerate" | "brake" | "curve";
  hasBall?: boolean;
}

const MOVEMENTS: StudioMovement[] = [
  { id: "idle", label: "Em pé", speed: 0, action: null },
  { id: "walk", label: "Caminhada", speed: 1.6, action: null },
  { id: "run", label: "Corrida", speed: 5.5, action: null },
  { id: "sprint", label: "Sprint", speed: 8, action: null },
  {
    id: "accelerate",
    label: "Arranque e aceleração",
    speed: 8,
    profile: "accelerate",
    action: null,
  },
  { id: "decelerate", label: "Frenagem e retomada", speed: 8, profile: "brake", action: null },
  {
    id: "curveRunLeft",
    label: "Corrida com mudança de direção",
    speed: 5.5,
    profile: "curve",
    action: null,
  },
  { id: "dribble", label: "Condução da bola", speed: 3.4, hasBall: true, action: null },
  { id: "sideStep", label: "Deslocamento lateral", speed: 1.9, lateral: 1.9, action: null },
  { id: "backpedal", label: "Recuo defensivo", speed: 1.9, reverse: true, action: null },
  { id: "pass", label: "Passe", speed: 0, action: "pass" },
  { id: "cross", label: "Cruzamento", speed: 0, action: "cross" },
  { id: "shotPower", label: "Finalização", speed: 0, action: "shotPower" },
  { id: "trap", label: "Domínio da bola", speed: 0, action: "trap" },
  { id: "tackle", label: "Desarme", speed: 0, action: "tackle" },
  { id: "slide", label: "Carrinho", speed: 0, action: "slide" },
  { id: "block", label: "Bloqueio defensivo", speed: 0, action: "block" },
  { id: "duel", label: "Disputa de corpo", speed: 0, action: "duel" },
  { id: "feint", label: "Finta", speed: 0, action: "feint" },
  { id: "stepover", label: "Pedalada", speed: 0, action: "stepover" },
  { id: "throwIn", label: "Arremesso lateral", speed: 0, action: "throwIn" },
  { id: "header", label: "Cabeceio", speed: 0, action: "header" },
  { id: "diveLeft", label: "Defesa à esquerda", speed: 0, action: "diveLeft" },
  { id: "diveRight", label: "Defesa à direita", speed: 0, action: "diveRight" },
  { id: "saveHigh", label: "Defesa alta", speed: 0, action: "saveHigh" },
  { id: "catch", label: "Encaixe do goleiro", speed: 0, action: "catch" },
  { id: "celebrate", label: "Comemoração", speed: 0, action: "celebrate" },
];

/** Cosmetic fixture: no simulation tick, career update or server progress. */
function fixture(clubId: string, position: string, variation: number) {
  const team = (id: string): TeamSetup => {
    const club = safeClub(id);
    return {
      clubId: id,
      name: club.name,
      short: club.short,
      primary: club.primary,
      secondary: club.secondary,
      players: [],
      tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
    };
  };
  const home = team(clubId);
  const away = team(clubId === "pal" ? "fla" : "pal");
  const view = new WorkerMatchView(home, away);
  const id = `studio-${clubId}-${position}-${variation}`;
  const player: SimPlayer = {
    id,
    pid: id,
    side: "home",
    name: "ATLETA",
    number: 10,
    pos: position,
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
  view.ball.z = 5;
  return { view, player };
}

function StudioScene({
  preview,
  movement,
  light,
  detail,
  paused,
  framing,
  stamina,
  previewAt,
}: {
  preview: ReturnType<typeof fixture>;
  movement: (typeof MOVEMENTS)[number];
  light: string;
  detail: boolean;
  paused: boolean;
  framing: string;
  stamina: number;
  previewAt?: number | undefined;
}) {
  const pulse = useRef(0);
  const actionClock = useRef(0);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const height = lookFor(preview.player.id, preview.player.pos).height * 1.8;
  const overhead = /^(throwIn|saveHigh|diveLeft|diveRight|header|celebrate)$/.test(
    movement.action ?? "",
  );
  const targetY =
    framing === "face"
      ? height - 0.12
      : framing === "kit"
        ? height * 0.68
        : framing === "boots"
          ? 0.15
          : height * (overhead ? 0.66 : 0.5);
  useEffect(() => {
    const close = framing === "face",
      shirt = framing === "kit",
      feet = framing === "boots";
    camera.position.set(
      close ? 0.42 : shirt ? 0.65 : feet ? 0.55 : overhead ? 3.2 : 2.6,
      close ? height - 0.08 : shirt ? height * 0.75 : feet ? 0.48 : overhead ? 1.9 : 1.55,
      close ? 0.76 : shirt ? 1.5 : feet ? 0.85 : overhead ? 4.8 : 3.7,
    );
    camera.lookAt(0, targetY, 0);
    camera.updateMatrixWorld();
    controls.current?.target.set(0, targetY, 0);
    controls.current?.update();
    invalidate();
  }, [framing, height, targetY, overhead, camera, invalidate]);
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
      <color attach="background" args={[light === "noite" ? "#091422" : "#142c36"]} />
      <hemisphereLight args={["#e7f2ff", "#264d39", 1.35]} />
      <directionalLight
        position={[3, 5, 4]}
        color={warm ? "#ffe0bd" : "#ffffff"}
        intensity={2.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, 2, -2]} color="#9ccfff" intensity={1.8} />
      <Environment frames={1} resolution={128}>
        <Lightformer position={[0, 3, 4]} scale={[5, 3, 1]} intensity={1.5} color="#e4f0ff" />
        <Lightformer
          position={[-3, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[3, 3, 1]}
          intensity={1}
          color="#c2ddff"
        />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} receiveShadow>
        <circleGeometry args={[3, 64]} />
        <meshStandardMaterial color="#2b5545" roughness={0.91} />
      </mesh>
      <gridHelper args={[6, 12, "#50776c", "#355e50"]} position={[0, 0.002, 0]} />
      {detail ? (
        <PlayerRig
          player={preview.player}
          sim={preview.view}
          kit={preview.player.pos === "GK" ? keeperKit : kit}
          goalPulse={pulse}
          quality="alta"
          respectVisualSettings={false}
          paused={paused}
          previewAt={previewAt}
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
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, targetY, 0]}
        enablePan={false}
        enableZoom={false}
        minDistance={framing === "body" ? 2.1 : 0.38}
        maxDistance={5.5}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </>
  );
}

export default function PlayerStudio({ clubId = "fla" }: { clubId?: string }) {
  const [position, setPosition] = useState("MF");
  const [movementId, setMovementId] = useState("walk");
  const [variation, setVariation] = useState(1);
  const [light, setLight] = useState("dia");
  const [detail, setDetail] = useState(true);
  const [paused, setPaused] = useState(false);
  const [framing, setFraming] = useState("body");
  const [stamina, setStamina] = useState(100);
  const [previewAt, setPreviewAt] = useState<number | undefined>(undefined);
  const preview = useMemo(
    () => fixture(clubId, position, variation),
    [clubId, position, variation],
  );
  const movement = MOVEMENTS.find((m) => m.id === movementId) ?? MOVEMENTS[0]!;
  const metadata = getAnnotatedClip(movement.id)?.metadata;
  const height = (lookFor(preview.player.id, position).height * 1.8).toFixed(2);
  const selectClass =
    "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground";
  return (
    <section
      aria-label="Prévia 3D dos jogadores"
      className="mt-4 overflow-hidden rounded-2xl border border-border/60 surface-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg uppercase">Atletas em movimento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gire o jogador e confira o corpo, o uniforme e cada movimento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs tabular-nums text-primary">
            {height} m
          </span>
          <label className="text-xs text-muted-foreground">
            Enquadramento
            <select
              aria-label="Enquadramento"
              value={framing}
              onChange={(e) => setFraming(e.target.value)}
              className={selectClass}
            >
              <option value="body">Corpo inteiro</option>
              <option value="face">Rosto e cabelo</option>
              <option value="kit">Uniforme</option>
              <option value="boots">Chuteiras</option>
            </select>
          </label>
        </div>
      </div>
      <div className="relative h-[360px] w-full sm:h-[440px]">
        <GraphicsBoundary>
          <Canvas
            camera={{ position: [2.6, 1.55, 3.7], fov: 32 }}
            dpr={[1, 1.5]}
            shadows={{ type: THREE.PCFShadowMap }}
            frameloop={paused ? "demand" : "always"}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 0.85;
            }}
            fallback={
              <p role="status" className="p-8 text-center">
                A prévia 3D precisa de um navegador com WebGL.
              </p>
            }
          >
            <StudioScene
              key={movementId}
              preview={preview}
              movement={movement}
              light={light}
              detail={detail}
              paused={paused}
              framing={framing}
              stamina={stamina}
              previewAt={previewAt}
            />
          </Canvas>
        </GraphicsBoundary>
        <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={paused}
            onClick={() => {
              setPreviewAt(undefined);
              setPaused(!paused);
            }}
            className="min-h-11 rounded-lg bg-black/65 px-4 text-sm text-white"
          >
            {paused ? "Reproduzir" : "Pausar"}
          </button>
          <button
            type="button"
            aria-pressed={!detail}
            onClick={() => setDetail(!detail)}
            className="min-h-11 rounded-lg bg-black/65 px-4 text-sm text-white"
          >
            {detail ? "Comparar modelo leve" : "Ver modelo detalhado"}
          </button>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          Porte por posição
          <select
            aria-label="Porte por posição"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={selectClass}
          >
            <option value="MF">Meio-campista</option>
            <option value="DF">Defensor</option>
            <option value="FW">Atacante</option>
            <option value="GK">Goleiro</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Movimento
          <select
            aria-label="Movimento"
            value={movementId}
            onChange={(e) => {
              setMovementId(e.target.value);
              setPaused(false);
              setPreviewAt(undefined);
              if (/^(diveLeft|diveRight|saveHigh|catch)$/.test(e.target.value)) setPosition("GK");
            }}
            className={selectClass}
          >
            {MOVEMENTS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Iluminação
          <select
            aria-label="Iluminação da prévia"
            value={light}
            onChange={(e) => setLight(e.target.value)}
            className={selectClass}
          >
            <option value="dia">Dia</option>
            <option value="entardecer">Entardecer</option>
            <option value="noite">Noite</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setVariation((n) => n + 1)}
            className="min-h-11 w-full rounded-lg border border-border px-3 text-sm hover:bg-secondary"
          >
            Outro atleta
          </button>
        </div>
      </div>
      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-2 border-t border-border/50 px-5 py-3 text-xs text-muted-foreground"
      >
        <label className="mr-auto flex items-center gap-2">
          Condição física
          <select
            aria-label="Condição física"
            value={stamina}
            onChange={(e) => {
              setStamina(Number(e.target.value));
              setPaused(false);
              setPreviewAt(undefined);
            }}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value={100}>Descansado</option>
            <option value={45}>Cansado</option>
            <option value={10}>Exausto</option>
          </select>
        </label>
        <span className="rounded-full bg-secondary px-3 py-1 text-foreground">
          {movement.label}
        </span>
        {metadata?.support === "alternating" ? <span>Apoio alternado dos pés</span> : null}
        {metadata?.support === "airborne" ? <span>Impulsão e aterrissagem</span> : null}
        {movement.action ? <span>Preparação · contato · recuperação</span> : null}
        {movement.action ? (
          <div role="group" aria-label="Etapa do movimento" className="flex flex-wrap gap-1">
            {[
              { label: "Preparação", at: 0.12 },
              { label: "Contato", at: footballContactAt(movement.action) },
              { label: "Recuperação", at: 0.88 },
            ].map((stage) => (
              <button
                key={stage.label}
                type="button"
                aria-pressed={paused && previewAt === stage.at}
                onClick={() => {
                  setPreviewAt(stage.at);
                  setPaused(true);
                }}
                className="min-h-11 rounded-lg border border-border px-3 text-foreground aria-pressed:bg-primary/15 aria-pressed:text-primary"
              >
                {stage.label}
              </button>
            ))}
          </div>
        ) : null}
        {metadata?.tags?.includes("direction-change") ? (
          <span>Equilíbrio lateral e orientação</span>
        ) : null}
      </div>
    </section>
  );
}
