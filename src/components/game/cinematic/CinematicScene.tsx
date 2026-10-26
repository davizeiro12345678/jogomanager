import { Environment, Lightformer } from "@react-three/drei";
import { Component, lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { CinematicDirector as Director } from "../CinematicDirector";
import type { Cutscene, SceneArt, Speaker } from "@/content/cutscenes";
import type { LineLight, ShotSize } from "@/game/cutscene-director";
import { cinematicStageActorFor, type CinematicSet } from "@/game/cinematic-blocking";
import { hashSeed } from "@/game/rng";
import type { QualityLevel } from "@/game/device";
import { useT } from "@/i18n/provider";
import { CinematicAtmosphere } from "./CinematicAtmosphere";
import { CinematicSpecialSet } from "./CinematicSpecialSet";
import { CinematicPortraitLight } from "./CinematicPortraitLight";
import { CinematicActor as Figure } from "./CinematicActor";
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./CinematicSetBatch";
import { CinematicSetFinish } from "./CinematicSetFinish";
import { CinematicStoryDressing } from "./CinematicStoryDressing";
import { CinematicBusinessDressing } from "./CinematicBusinessDressing";
import { CinematicMotivatedLight } from "./CinematicMotivatedLight";
import { resolveCinematicSetLoader } from "./sets/registry";

type SetKind = CinematicSet;

class CinematicSetErrorBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onUnavailable();
  }

  override render() {
    return this.state.failed ? <group /> : this.props.children;
  }
}

/** Editing cuts establish geography before a face; cameras never fly through actors. */
/** Luz da fala vinda da direção: o humor pinta o cenário a cada fala. */
const LINE_TINT: Record<LineLight, { sky: string; rim: string; amb: number }> = {
  neutra: { sky: "#effff4", rim: "#ffffff", amb: 1 },
  quente: { sky: "#ffe3c0", rim: "#ffb46a", amb: 1.1 },
  fria: { sky: "#c3d9ff", rim: "#7fa8ff", amb: 0.95 },
  dramatica: { sky: "#d8c9ff", rim: "#ff4d5e", amb: 0.8 },
  festa: { sky: "#fff3d6", rim: "#ffe066", amb: 1.25 },
};

export function CinematicScene({
  business,
  language,
  kind,
  art,
  beat,
  primary,
  secondary,
  mood,
  quality,
  intensity = 0,
  speaker = null,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  light = "neutra",
  festive = false,
  enhanced = true,
  onBatch,
  onUnavailable,
}: {
  business?: Cutscene["business"];
  language?: string | undefined;
  kind: SetKind;
  art: SceneArt;
  beat: number;
  primary: string;
  secondary: string;
  mood: "good" | "bad" | "neutral";
  quality: QualityLevel;
  intensity?: number;
  speaker?: Speaker | null;
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  light?: LineLight;
  festive?: boolean;
  enhanced?: boolean;
  onBatch?: ((snapshot: CinematicBatchSnapshot) => void) | undefined;
  onUnavailable?: (() => void) | undefined;
}) {
  const { t } = useT();
  const SelectedSet = useMemo(() => {
    const loader = resolveCinematicSetLoader(kind);
    return loader ? lazy(loader) : null;
  }, [kind]);
  useEffect(() => {
    if (!SelectedSet) onUnavailable?.();
  }, [SelectedSet, onUnavailable]);
  const base = mood === "good" ? "#fff3e1" : mood === "bad" ? "#d8e3fa" : "#eef2f7";
  const tint = LINE_TINT[light];
  const warm = light === "neutra" ? base : tint.sky;
  const indoor = kind === "locker" || kind === "press" || kind === "office" || kind === "tunnel";
  const amb = (indoor ? 0.34 : 0.5) * tint.amb;
  // Existing fixtures retain their own detailed rigs. Every other authored
  // speaker receives one semantic overlay, shared by the camera resolver.
  const stagedActor = cinematicStageActorFor(art, speaker, festive);
  const residentSpeaker = stagedActor?.presence === "resident" ? stagedActor.role : null;
  const setScene = SelectedSet ? (
    <Suspense fallback={<group />}>
      <SelectedSet
        primary={primary}
        secondary={secondary}
        speaker={residentSpeaker}
        festive={festive}
        training={art === "training"}
      />
    </Suspense>
  ) : (
    <group />
  );
  return (
    <>
      <color
        attach="background"
        args={[art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#101b29"]}
      />
      <fog
        attach="fog"
        args={[
          art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#0a1310",
          indoor ? 8 : 22,
          indoor ? 34 : 70,
        ]}
      />
      <ambientLight intensity={amb} color={warm} />
      <hemisphereLight intensity={indoor ? 0.4 : 0.45} color="#dce8f4" groundColor="#30333a" />
      {indoor ? (
        <>
          <directionalLight position={[0, 2.5, 6]} intensity={0.38} color="#e8f0f7" />
          <directionalLight
            position={[-4, 3, -4]}
            intensity={kind === "press" ? 0.9 : 0.45}
            color="#d4e3ff"
          />
        </>
      ) : null}
      <directionalLight
        castShadow
        position={[5, 11, 6]}
        intensity={indoor ? 1.55 : 2.6}
        color={light === "neutra" ? "#fff8f2" : warm}
        shadow-mapSize={quality === "alta" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-camera-left={indoor ? -12 : -24}
        shadow-camera-right={indoor ? 12 : 24}
        shadow-camera-top={indoor ? 10 : 22}
        shadow-camera-bottom={indoor ? -10 : -22}
      />
      {/* Neutral rim preserves the complexion; club colour stays in the set. */}
      <spotLight
        position={[-5, 6, -5]}
        angle={0.7}
        penumbra={0.9}
        intensity={indoor ? 12 : 22}
        color={light === "neutra" ? "#d4e6ff" : tint.rim}
      />
      <CinematicMotivatedLight kind={kind} art={art} mood={mood} light={light} quality={quality} />
      {enhanced && quality !== "baixa" && (
        <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
          <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
          <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color="#d6e5f4" />
          <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={0.8} color="#e6dfd3" />
        </Environment>
      )}
      <Director
        business={business}
        kind={kind}
        art={art}
        beat={beat}
        intensity={intensity}
        size={size}
        dollyFrom={dollyFrom}
        dollyTo={dollyTo}
        climax={climax}
        speaker={speaker}
        festive={festive}
      />
      <CinematicAtmosphere kind={kind} art={art} mood={mood} quality={quality} />
      <CinematicPortraitLight />
      <CinematicSetBatch
        key={`${art}-${kind}-${primary}-${secondary}-${quality}-${t("cinemaStudio.title")}`}
        onReady={onBatch}
      >
        {art !== "medical" && art !== "gym" && <CinematicSetFinish kind={kind} primary={primary} />}
        {business ? (
          <CinematicBusinessDressing
            business={business}
            primary={primary}
            secondary={secondary}
            quality={quality}
            language={language ?? "pt-BR"}
          />
        ) : null}
        <CinematicStoryDressing
          kind={kind}
          art={art}
          primary={primary}
          secondary={secondary}
          quality={quality}
        />
        {art === "medical" || art === "gym" ? (
          <CinematicSpecialSet
            medical={art === "medical"}
            primary={primary}
            speaker={residentSpeaker}
          />
        ) : null}
        {onUnavailable ? (
          <CinematicSetErrorBoundary key={kind} onUnavailable={onUnavailable}>
            {setScene}
          </CinematicSetErrorBoundary>
        ) : (
          setScene
        )}
        {stagedActor?.presence === "overlay" ? (
          <Figure
            key={`speaker-${art}-${stagedActor.role}`}
            x={stagedActor.mark[0]}
            z={stagedActor.mark[1]}
            color={
              stagedActor.role === "captain" || stagedActor.role === "fan"
                ? primary
                : stagedActor.role === "referee"
                  ? "#222d36"
                  : secondary
            }
            shorts="#19232b"
            seed={hashSeed(`cinematic-speaker:${stagedActor.role}`)}
            role={stagedActor.role}
            costume={
              stagedActor.role === "captain" || stagedActor.role === "fan" ? "player" : "staff"
            }
            clipboard={
              stagedActor.role === "assistant" ||
              stagedActor.role === "doctor" ||
              stagedActor.role === "scout"
            }
            acting
          />
        ) : null}
      </CinematicSetBatch>
    </>
  );
}
