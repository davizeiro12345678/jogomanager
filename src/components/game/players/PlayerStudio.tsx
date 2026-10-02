import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { CLIP_NAMES, type ClipName, type PlayerAction } from "@/game/animation";
import { kitFor, gkKitFor } from "@/game/kits";
import { WorkerMatchView } from "@/game/live-match";
import {
  lookFor,
  lookWithPhysique,
  type PlayerLook,
  type HairStyle,
  type BeardStyle,
  type BodyType,
} from "@/game/player-model";
import { getAnnotatedClip } from "@/game/register-animations";
import { footballContactAt } from "@/game/motion-metadata";
import { safeClub } from "@/game/squad";
import type { SimPlayer, TeamSetup } from "@/game/sim";
import { GraphicsBoundary } from "../GraphicsBoundary";
import { PlayerRig } from "./PlayerRig";
import { LowPlayers } from "./LowPlayers";
import { Pause, Play, RotateCcw, Shuffle, Scan, UserRound, Sun, Activity } from "lucide-react";
import "../cinematic/studio.css";

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
  { id: "passLong", label: "Passe longo", speed: 0, action: "passLong" },
  { id: "cross", label: "Cruzamento", speed: 0, action: "cross" },
  { id: "shotPower", label: "Finalização", speed: 0, action: "shotPower" },
  { id: "shotPlaced", label: "Finalização colocada", speed: 0, action: "shotPlaced" },
  { id: "chip", label: "Cavadinha", speed: 0, action: "chip" },
  { id: "volley", label: "Voleio", speed: 0, action: "volley" },
  { id: "firstTime", label: "Finalização de primeira", speed: 0, action: "firstTime" },
  { id: "trap", label: "Domínio da bola", speed: 0, action: "trap" },
  { id: "tackle", label: "Desarme", speed: 0, action: "tackle" },
  { id: "slide", label: "Carrinho", speed: 0, action: "slide" },
  { id: "block", label: "Bloqueio defensivo", speed: 0, action: "block" },
  { id: "duel", label: "Disputa de corpo", speed: 0, action: "duel" },
  { id: "feint", label: "Finta", speed: 0, action: "feint" },
  { id: "stepover", label: "Pedalada", speed: 0, action: "stepover" },
  { id: "cut", label: "Corte de direção", speed: 0, action: "cut" },
  { id: "elastico", label: "Elástico", speed: 0, action: "elastico" },
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
  appearance,
  viewReset,
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
}) {
  const pulse = useRef(0);
  const actionClock = useRef(0);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const height = appearance.height * 1.8;
  const overrides = useMemo(
    () => new Map([[preview.player.id, appearance]]),
    [preview, appearance],
  );
  // An idle inspection stays idle instead of randomly selecting a team
  // gesture from the match state machine. Actions still use their phases.
  const previewClip =
    !movement.action && CLIP_NAMES.includes(movement.id as ClipName)
      ? (movement.id as ClipName)
      : undefined;
  const overhead = /^(throwIn|saveHigh|diveLeft|diveRight|header|celebrate)$/.test(
    movement.action ?? "",
  );
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
              : height * (overhead ? 0.66 : 0.5);
  useEffect(() => {
    const close = framing === "face",
      shirt = framing === "kit",
      feet = framing === "boots",
      hands = framing === "hands",
      legs = framing === "legs";
    const fit = Math.max(1, (framing === "body" ? 0.8 : 0.68) / (size.width / size.height));
    camera.position.set(
      (close
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
                  : 1.8) * fit,
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
                  : 1.55,
      (close
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
                  : 3.2) * fit,
    );
    camera.lookAt(0, targetY, 0);
    camera.updateMatrixWorld();
    controls.current?.target.set(0, targetY, 0);
    controls.current?.update();
    invalidate();
  }, [framing, height, targetY, overhead, camera, invalidate, size.width, size.height, viewReset]);
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
      <hemisphereLight args={["#dce7f2", "#353b43", 0.95]} />
      <directionalLight
        position={[-3, 4.5, 4]}
        color={warm ? "#ffe0bd" : "#ffffff"}
        intensity={2.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      <directionalLight position={[3, 3, -2]} color="#b1cee8" intensity={2.4} />
      <directionalLight position={[2, 2, 4]} color="#e4edf6" intensity={0.45} />
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
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#283641" roughness={0.87} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.003, 0]} receiveShadow>
        <circleGeometry args={[1.65, 64]} />
        <meshStandardMaterial color="#354753" roughness={0.76} metalness={0.05} />
      </mesh>
      <ContactShadows
        key={`${appearance.seed}:${movement.id}:${previewAt ?? "live"}:${detail}`}
        position={[0, 0.002, 0]}
        opacity={0.38}
        scale={4}
        blur={2.5}
        far={2}
        resolution={256}
        frames={1}
        color="#061018"
      />
      {detail ? (
        <PlayerRig
          player={preview.player}
          sim={preview.view}
          kit={preview.player.pos === "GK" ? keeperKit : kit}
          goalPulse={pulse}
          quality="alta"
          portrait
          respectVisualSettings={false}
          paused={paused}
          previewAt={previewAt}
          lookOverride={appearance}
          previewClip={previewClip}
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
  const [movementId, setMovementId] = useState("idle");
  const [variation, setVariation] = useState(1);
  const [light, setLight] = useState("dia");
  const [detail, setDetail] = useState(true);
  const [paused, setPaused] = useState(false);
  const [framing, setFraming] = useState("body");
  const [stamina, setStamina] = useState(100);
  const [previewAt, setPreviewAt] = useState<number | undefined>(undefined);
  const [hairStyle, setHairStyle] = useState<HairStyle | "original">("original");
  const [beard, setBeard] = useState<BeardStyle | "original">("original");
  const [physique, setPhysique] = useState<BodyType | "original">("original");
  const [heightCm, setHeightCm] = useState<number | undefined>(undefined);
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const [panel, setPanel] = useState("motion");
  const [viewReset, setViewReset] = useState(0);
  const preview = useMemo(
    () => fixture(clubId, position, variation),
    [clubId, position, variation],
  );
  const movement = MOVEMENTS.find((m) => m.id === movementId) ?? MOVEMENTS[0]!;
  const appearance = useMemo(() => {
    const look = lookFor(preview.player.id, position, true);
    return lookWithPhysique(
      {
        ...look,
        hairStyle: hairStyle === "original" ? look.hairStyle : hairStyle,
        beard: beard === "original" ? look.beard : beard,
        bodyType: physique === "original" ? look.bodyType : physique,
        girth:
          physique === "original"
            ? look.girth
            : physique === "strong"
              ? 1.16
              : physique === "slim"
                ? 0.88
                : 1,
        headband: hairStyle === "headband" || (hairStyle === "original" && look.headband),
      },
      { height: heightCm, weight: weightKg },
    );
  }, [preview, position, hairStyle, beard, physique, heightCm, weightKg]);
  const metadata = getAnnotatedClip(movement.id)?.metadata;
  const height = (appearance.height * 1.8).toFixed(2);
  const selectClass = "studio-select";
  return (
    <section aria-label="Prévia 3D dos jogadores" className="studio-card">
      <div className="studio-toolbar">
        <div className="studio-title">
          <p className="studio-kicker">Laboratório de atletas</p>
          <h2>O jogador, em cada detalhe.</h2>
        </div>
        <span className="studio-height">{height} m</span>
        <label className="studio-framing">
          <Scan size={15} aria-hidden />
          <span className="sr-only">Enquadramento</span>
          <select
            aria-label="Enquadramento"
            value={framing}
            onChange={(e) => setFraming(e.target.value)}
            className={selectClass}
          >
            <option value="body">Corpo inteiro</option>
            <option value="face">Rosto e cabelo</option>
            <option value="kit">Uniforme</option>
            <option value="legs">Bermuda e pernas</option>
            <option value="boots">Chuteiras</option>
            <option value="hands">Mãos e luvas</option>
          </select>
        </label>
      </div>
      <div className="studio-layout">
        <div className="studio-viewport">
          <GraphicsBoundary>
            <Canvas
              camera={{ position: [1.8, 1.55, 3.2], fov: 32 }}
              dpr={[1, 1.5]}
              shadows={{ type: THREE.PCFShadowMap }}
              frameloop={paused ? "demand" : "always"}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 0.9;
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
                appearance={appearance}
                viewReset={viewReset}
              />
            </Canvas>
          </GraphicsBoundary>
          <div className="studio-view-actions">
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => {
                setPreviewAt(undefined);
                setPaused(!paused);
              }}
              className="studio-button"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
              {paused ? "Reproduzir" : "Pausar"}
            </button>
            <button
              type="button"
              aria-label="Restaurar câmera"
              onClick={() => setViewReset((n) => n + 1)}
              className="studio-button"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              aria-pressed={!detail}
              onClick={() => setDetail(!detail)}
              className="studio-button"
            >
              {detail ? "Comparar modelo leve" : "Ver modelo detalhado"}
            </button>
          </div>
        </div>
        <aside className="studio-panel" aria-label="Ajustes do atleta">
          <div className="studio-tabs" role="group" aria-label="Categorias de ajustes">
            {[
              { id: "motion", label: "Movimento", icon: Activity },
              { id: "look", label: "Aparência", icon: UserRound },
              { id: "scene", label: "Cena", icon: Sun },
            ].map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          {panel === "motion" && (
            <div className="studio-fields">
              <label>
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
              <label>
                Movimento
                <select
                  aria-label="Movimento"
                  value={movementId}
                  onChange={(e) => {
                    setMovementId(e.target.value);
                    setPaused(false);
                    setPreviewAt(undefined);
                    if (/^(diveLeft|diveRight|saveHigh|catch)$/.test(e.target.value))
                      setPosition("GK");
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
              <label className="studio-wide">
                Condição física
                <select
                  aria-label="Condição física"
                  value={stamina}
                  onChange={(e) => {
                    setStamina(Number(e.target.value));
                    setPaused(false);
                    setPreviewAt(undefined);
                  }}
                  className={selectClass}
                >
                  <option value={100}>Descansado</option>
                  <option value={45}>Cansado</option>
                  <option value={10}>Exausto</option>
                </select>
              </label>
            </div>
          )}
          {panel === "look" && (
            <div className="studio-fields">
              <label>
                Cabelo
                <select
                  aria-label="Cabelo do atleta"
                  value={hairStyle}
                  onChange={(e) => setHairStyle(e.target.value as HairStyle | "original")}
                  className={selectClass}
                >
                  <option value="original">Original do atleta</option>
                  {[
                    { id: "buzz", label: "Raspado" },
                    { id: "short", label: "Curto" },
                    { id: "medium", label: "Médio" },
                    { id: "curly", label: "Cacheado" },
                    { id: "afro", label: "Afro" },
                    { id: "mohawk", label: "Moicano" },
                    { id: "bun", label: "Coque" },
                    { id: "ponytail", label: "Rabo de cavalo" },
                    { id: "dreads", label: "Dreads" },
                    { id: "braids", label: "Tranças" },
                    { id: "headband", label: "Com faixa" },
                    { id: "bald", label: "Sem cabelo" },
                  ].map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Barba
                <select
                  aria-label="Barba do atleta"
                  value={beard}
                  onChange={(e) => setBeard(e.target.value as BeardStyle | "original")}
                  className={selectClass}
                >
                  <option value="original">Original do atleta</option>
                  <option value="none">Sem barba</option>
                  <option value="stubble">Por fazer</option>
                  <option value="goatee">Cavanhaque</option>
                  <option value="full">Completa</option>
                  <option value="moustache">Bigode</option>
                </select>
              </label>
              <label className="studio-wide">
                Constituição física
                <select
                  aria-label="Constituição física"
                  value={physique}
                  onChange={(e) => setPhysique(e.target.value as BodyType | "original")}
                  className={selectClass}
                >
                  <option value="original">Original do atleta</option>
                  <option value="slim">Esguio</option>
                  <option value="normal">Atlético</option>
                  <option value="strong">Robusto</option>
                </select>
              </label>
              <button
                type="button"
                className="studio-button studio-wide"
                onClick={() => {
                  setHairStyle("original");
                  setBeard("original");
                  setPhysique("original");
                  setHeightCm(undefined);
                  setWeightKg(undefined);
                }}
              >
                Restaurar aparência
              </button>
              <label className="studio-wide">
                Altura · {Math.round(appearance.height * 180)} cm
                <input
                  type="range"
                  aria-label="Altura do atleta"
                  className="studio-timeline"
                  min={160}
                  max={205}
                  value={Math.round(appearance.height * 180)}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                />
              </label>
              <label className="studio-wide">
                Peso ·{" "}
                {weightKg ?? Math.round(76.788 * appearance.girth ** 2 * appearance.height ** 2)} kg
                <input
                  type="range"
                  aria-label="Peso do atleta"
                  className="studio-timeline"
                  min={55}
                  max={110}
                  value={
                    weightKg ?? Math.round(76.788 * appearance.girth ** 2 * appearance.height ** 2)
                  }
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                />
              </label>
            </div>
          )}
          {panel === "scene" && (
            <div className="studio-fields">
              <label className="studio-wide">
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
              <p className="studio-hint studio-wide">
                Arraste para girar o jogador. Use a roda do mouse ou dois dedos para aproximar. O
                botão de câmera restaura o enquadramento.
              </p>
            </div>
          )}
          {movement.action && (
            <div className="studio-phase" aria-label="Inspeção do movimento">
              <p className="studio-kicker">Etapas da ação</p>
              <div role="group" aria-label="Etapa do movimento" className="studio-phase-buttons">
                {[
                  { label: "Preparação", at: 0.12 },
                  { label: "Contato", at: footballContactAt(movement.action) },
                  {
                    label: "Continuação",
                    at: Math.min(0.78, footballContactAt(movement.action) + 0.2),
                  },
                  { label: "Recuperação", at: 0.88 },
                ].map((stage) => (
                  <button
                    type="button"
                    key={stage.label}
                    aria-pressed={paused && previewAt === stage.at}
                    onClick={() => {
                      setPreviewAt(stage.at);
                      setPaused(true);
                    }}
                    className="studio-button"
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
              <label className="studio-hint">
                Quadro da ação · {Math.round((previewAt ?? 0) * 100)}%
                <input
                  type="range"
                  aria-label="Quadro da ação"
                  className="studio-timeline"
                  min={0}
                  max={100}
                  value={Math.round((previewAt ?? 0) * 100)}
                  onChange={(e) => {
                    setPreviewAt(Number(e.target.value) / 100);
                    setPaused(true);
                  }}
                />
              </label>
              <p className="studio-hint">
                Pause em qualquer momento para conferir o apoio e o contato.
              </p>
            </div>
          )}
          <button
            type="button"
            className="studio-button mt-4 w-full"
            onClick={() => setVariation((n) => n + 1)}
          >
            <Shuffle size={15} />
            Outro atleta
          </button>
        </aside>
      </div>
      <div className="studio-footer" aria-live="polite">
        <strong>{movement.label}</strong>
        <span>{detail ? "Modelo detalhado" : "Modelo leve"}</span>
        <span>•</span>
        <span>
          {metadata?.support === "airborne"
            ? "Impulsão e aterrissagem"
            : metadata?.support === "alternating"
              ? "Apoio alternado"
              : "Arraste para girar"}
        </span>
      </div>
    </section>
  );
}
