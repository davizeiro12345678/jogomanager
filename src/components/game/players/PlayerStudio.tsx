import AccessibilitySettings from "@/components/accessibility/AccessibilitySettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cinematicOverlayActive, subscribeCinematicOverlay } from "@/game/cinematic-overlay";
import { footballContactAt } from "@/game/motion-metadata";
import {
  athleteLookForAppearance,
  defaultAthleteAppearance,
  normalizeAthleteAppearance,
  type AthleteAppearanceV1,
} from "@/game/player-career/appearance";
import {
  lookFor,
  lookWithPhysique,
  type BeardStyle,
  type BodyType,
  type HairStyle,
} from "@/game/player-model";
import { getAnnotatedClip } from "@/game/register-animations";
import { useAccessibility } from "@/hooks/useAccessibility";
import { useT } from "@/i18n/provider";
import { studioMovementLabel } from "@/i18n/studio-movement-messages";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Scan,
  Shuffle,
  Sun,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { CanvasLifecycle } from "../CanvasLifecycle";
import { MobileFramebufferBudget } from "../MobileFramebufferBudget";
import { detectQuality } from "@/game/device";
import { GraphicsBoundary } from "../GraphicsBoundary";
import { Ktx2CanvasAssets } from "../Ktx2CanvasAssets";
import type { CanvasStatus } from "../canvas-lifecycle";
import "../cinematic/studio.css";
import { type CameraCommand, MOVEMENTS, fixture } from "./player-studio-setup";
import { StudioScene } from "./PlayerStudioScene";

/**
 * `value` turns the appearance controls into a controlled editor. Existing
 * studio callers may continue to omit it and keep their local preview state.
 */
export interface PlayerStudioProps {
  clubId?: string;
  position?: string;
  heightCm?: number;
  weightKg?: number;
  value?: AthleteAppearanceV1;
  onChange?: (value: AthleteAppearanceV1) => void;
}

export default function PlayerStudio({
  clubId = "fla",
  position: positionValue,
  heightCm: externalHeightCm,
  weightKg: externalWeightKg,
  value,
  onChange,
}: PlayerStudioProps) {
  const { t, dir, lang } = useT();
  const { reducedMotion } = useAccessibility();
  const [deviceQuality] = useState(detectQuality);
  const [localPosition, setLocalPosition] = useState("MF");
  const position = positionValue ?? localPosition;
  const [movementId, setMovementId] = useState("idle");
  const [variation, setVariation] = useState(1);
  const [light, setLight] = useState("dia");
  const [viewAngle, setViewAngle] = useState("threeQuarter");
  const [detail, setDetail] = useState(true);
  const [clothPhysics, setClothPhysics] = useState(true);
  const [paused, setPaused] = useState(false);
  const cinematicCovered = useSyncExternalStore(
    subscribeCinematicOverlay,
    cinematicOverlayActive,
    () => false,
  );
  const scenePaused = paused || cinematicCovered;
  const [framing, setFraming] = useState("body");
  const [stamina, setStamina] = useState(100);
  const [previewAt, setPreviewAt] = useState<number | undefined>(undefined);
  const [hairStyle, setHairStyle] = useState<HairStyle | "original">("original");
  const [beard, setBeard] = useState<BeardStyle | "original">("original");
  const [physique, setPhysique] = useState<BodyType | "original">("original");
  const [localHeightCm, setLocalHeightCm] = useState<number | undefined>(undefined);
  const [localWeightKg, setLocalWeightKg] = useState<number | undefined>(undefined);
  const [panel, setPanel] = useState(() => (value ? "look" : "motion"));
  const [viewReset, setViewReset] = useState(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>(null);
  const [sceneStatus, setSceneStatus] = useState<CanvasStatus>("loading");
  useEffect(() => {
    if (reducedMotion) setPaused(true);
  }, [reducedMotion]);
  const preview = useMemo(
    () => fixture(clubId, position, variation),
    [clubId, position, variation],
  );
  const movement = MOVEMENTS.find((m) => m.id === movementId) ?? MOVEMENTS[0]!;
  const fallbackAppearance = useMemo(
    () => defaultAthleteAppearance(preview.player.id, position),
    [preview.player.id, position],
  );
  const controlledAppearance = useMemo(
    () => (value ? normalizeAthleteAppearance(value, fallbackAppearance) : null),
    [value, fallbackAppearance],
  );
  const heightCm = externalHeightCm ?? localHeightCm;
  const weightKg = externalWeightKg ?? localWeightKg;
  const hasExternalMeasurements = externalHeightCm !== undefined || externalWeightKg !== undefined;
  const updateControlledAppearance = (patch: Partial<Omit<AthleteAppearanceV1, "version">>) => {
    if (!controlledAppearance || !onChange) return;
    onChange(normalizeAthleteAppearance({ ...controlledAppearance, ...patch }, fallbackAppearance));
  };
  const appearance = useMemo(() => {
    if (controlledAppearance) {
      return athleteLookForAppearance({
        seed: preview.player.id,
        role: position,
        captain: true,
        appearance: controlledAppearance,
        heightCm,
        weightKg,
      });
    }
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
  }, [preview, position, controlledAppearance, hairStyle, beard, physique, heightCm, weightKg]);
  const metadata = getAnnotatedClip(movement.id)?.metadata;
  const height = (appearance.height * 1.8).toFixed(2);
  const selectClass = "studio-select";
  return (
    <section
      aria-label={t("studio.preview")}
      className="studio-card"
      data-cinematic-covered={cinematicCovered}
      data-scene-status={sceneStatus}
    >
      <div className="studio-toolbar">
        <div className="studio-title">
          <p className="studio-kicker">{t("studio.kicker")}</p>
          <h2>{t("studio.title")}</h2>
        </div>
        <span className="studio-height">{height} m</span>
        <label className="studio-framing">
          <Scan size={15} aria-hidden />
          <span className="sr-only">{t("studio.frame")}</span>
          <select
            aria-label={t("studio.frame")}
            value={framing}
            onChange={(e) => setFraming(e.target.value)}
            className={selectClass}
          >
            <option value="body">{t("studio.body")}</option>
            <option value="face">{t("studio.face")}</option>
            <option value="kit">{t("studio.kit")}</option>
            <option value="legs">{t("studio.legs")}</option>
            <option value="boots">{t("studio.boots")}</option>
            <option value="hands">{t("studio.hands")}</option>
          </select>
        </label>
        <AccessibilitySettings />
      </div>
      <div className="studio-layout">
        <div className="studio-viewport">
          <div className="studio-canvas">
            <GraphicsBoundary>
              <Canvas
                camera={{ position: [1.8, 1.55, 3.2], fov: 32 }}
                dpr={[1, 1.5]}
                shadows={{ type: THREE.PCFShadowMap }}
                frameloop={scenePaused ? "demand" : "always"}
                gl={{ antialias: true, powerPreference: "high-performance" }}
                onCreated={({ gl }) => {
                  gl.toneMapping = THREE.ACESFilmicToneMapping;
                  gl.toneMappingExposure = 0.9;
                }}
                fallback={
                  <p role="status" className="p-8 text-center">
                    {t("studio.webgl")}
                  </p>
                }
              >
                <CanvasLifecycle onStatus={setSceneStatus} />
                <MobileFramebufferBudget tier={deviceQuality} requested={[1, 1.5]} />
                <Ktx2CanvasAssets enabled={detail} />
                <StudioScene
                  key={movementId}
                  preview={preview}
                  movement={movement}
                  light={light}
                  detail={detail}
                  paused={scenePaused}
                  framing={framing}
                  stamina={stamina}
                  previewAt={previewAt}
                  appearance={appearance}
                  viewReset={viewReset}
                  viewAngle={viewAngle}
                  cameraCommand={cameraCommand}
                  clothPhysics={clothPhysics}
                />
                {/* Keep Drei's capture resources alive for this Canvas. Its
                    one-frame counter resets on control rerenders; remounting
                    per pose leaked offscreen geometry/targets in Drei. */}
                <ContactShadows
                  position={[0, 0.002, 0]}
                  opacity={0.26}
                  scale={4}
                  blur={3.2}
                  far={1.3}
                  resolution={256}
                  frames={1}
                  color="#061018"
                />
              </Canvas>
            </GraphicsBoundary>
          </div>
          <div className="studio-keyboard-camera" role="group" aria-label={t("studio.frame")}>
            {(
              [
                ["left", "studio.left", ArrowLeft],
                ["right", "studio.right", ArrowRight],
                ["in", "studio.zoomIn", ZoomIn],
                ["out", "studio.zoomOut", ZoomOut],
              ] as const
            ).map(([action, key, Icon]) => (
              <button
                key={action}
                type="button"
                className="studio-button"
                aria-label={t(key)}
                title={t(key)}
                onClick={() =>
                  setCameraCommand((old) => ({ action, sequence: (old?.sequence ?? 0) + 1 }))
                }
              >
                <Icon size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
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
              {t(paused ? "common.play" : "common.pause")}
            </button>
            <button
              type="button"
              aria-label={t("studio.resetCamera")}
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
              {t(detail ? "studio.compare" : "studio.detailed")}
            </button>
          </div>
        </div>
        <aside className="studio-panel" aria-label={t("studio.settings")}>
          <Tabs value={panel} onValueChange={setPanel} dir={dir}>
            <TabsList className="studio-tabs" aria-label={t("studio.settings")}>
              {[
                { id: "motion", label: t("studio.motion"), icon: Activity },
                { id: "look", label: t("studio.look"), icon: UserRound },
                { id: "scene", label: t("studio.scene"), icon: Sun },
              ].map(({ id, label, icon: Icon }) => (
                <TabsTrigger value={id} key={id}>
                  <Icon size={14} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {panel === "motion" && (
              <TabsContent value="motion" className="studio-fields">
                <label>
                  {t("studio.position")}
                  <select
                    aria-label={t("studio.position")}
                    value={position}
                    disabled={positionValue !== undefined}
                    onChange={(e) => setLocalPosition(e.target.value)}
                    className={selectClass}
                  >
                    <option value="MF">{t("studio.mf")}</option>
                    <option value="DF">{t("studio.df")}</option>
                    <option value="FW">{t("studio.fw")}</option>
                    <option value="GK">{t("studio.gk")}</option>
                  </select>
                </label>
                <label>
                  {t("studio.motion")}
                  <select
                    aria-label={t("studio.motion")}
                    value={movementId}
                    onChange={(e) => {
                      setMovementId(e.target.value);
                      setPaused(reducedMotion);
                      setPreviewAt(undefined);
                      if (
                        !positionValue &&
                        /^(save|diveLeft|diveRight|saveHigh|catch)$/.test(e.target.value)
                      )
                        setLocalPosition("GK");
                    }}
                    className={selectClass}
                  >
                    {MOVEMENTS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {studioMovementLabel(lang, m.id, m.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="studio-wide">
                  {t("studio.condition")}
                  <select
                    aria-label={t("studio.condition")}
                    value={stamina}
                    onChange={(e) => {
                      setStamina(Number(e.target.value));
                      setPaused(false);
                      setPreviewAt(undefined);
                    }}
                    className={selectClass}
                  >
                    <option value={100}>{t("studio.rested")}</option>
                    <option value={45}>{t("studio.tired")}</option>
                    <option value={10}>{t("studio.exhausted")}</option>
                  </select>
                </label>
              </TabsContent>
            )}
            {panel === "look" && (
              <TabsContent value="look" className="studio-fields">
                <label>
                  Cabelo
                  <select
                    aria-label="Cabelo do atleta"
                    value={controlledAppearance?.hairStyle ?? hairStyle}
                    disabled={value !== undefined && !onChange}
                    onChange={(e) => {
                      const next = e.target.value as HairStyle | "original";
                      if (controlledAppearance) {
                        updateControlledAppearance({
                          hairStyle: next === "original" ? fallbackAppearance.hairStyle : next,
                        });
                      } else {
                        setHairStyle(next);
                      }
                    }}
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
                    value={controlledAppearance?.beardStyle ?? beard}
                    disabled={value !== undefined && !onChange}
                    onChange={(e) => {
                      const next = e.target.value as BeardStyle | "original";
                      if (controlledAppearance) {
                        updateControlledAppearance({
                          beardStyle: next === "original" ? fallbackAppearance.beardStyle : next,
                        });
                      } else {
                        setBeard(next);
                      }
                    }}
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
                    value={controlledAppearance?.bodyType ?? physique}
                    disabled={value !== undefined && !onChange}
                    onChange={(e) => {
                      const next = e.target.value as BodyType | "original";
                      if (controlledAppearance) {
                        updateControlledAppearance({
                          bodyType: next === "original" ? fallbackAppearance.bodyType : next,
                        });
                      } else {
                        setPhysique(next);
                        setLocalWeightKg(undefined);
                      }
                    }}
                    className={selectClass}
                  >
                    <option value="original">Original do atleta</option>
                    <option value="slim">Esguio</option>
                    <option value="normal">Atlético</option>
                    <option value="strong">Robusto</option>
                    <option value="tall">Alto</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="studio-button studio-wide"
                  onClick={() => {
                    if (controlledAppearance) {
                      onChange?.(fallbackAppearance);
                    } else {
                      setHairStyle("original");
                      setBeard("original");
                      setPhysique("original");
                      setLocalHeightCm(undefined);
                      setLocalWeightKg(undefined);
                    }
                  }}
                  disabled={value !== undefined && !onChange}
                >
                  Restaurar aparência
                </button>
                {hasExternalMeasurements ? (
                  <p className="studio-hint studio-wide">
                    Altura e peso acompanham os dados físicos definidos na criação.
                  </p>
                ) : (
                  <>
                    <label className="studio-wide">
                      Altura · {Math.round(appearance.height * 180)} cm
                      <input
                        type="range"
                        aria-label={t("studio.height")}
                        aria-valuetext={`${Math.round(appearance.height * 180)} cm`}
                        className="studio-timeline"
                        min={160}
                        max={205}
                        value={Math.round(appearance.height * 180)}
                        onChange={(e) => setLocalHeightCm(Number(e.target.value))}
                      />
                    </label>
                    <label className="studio-wide">
                      Peso ·{" "}
                      {weightKg ??
                        Math.round(76.788 * appearance.girth ** 2 * appearance.height ** 2)}{" "}
                      kg
                      <input
                        type="range"
                        aria-label={t("studio.weight")}
                        aria-valuetext={`${weightKg ?? Math.round(76.788 * appearance.girth ** 2 * appearance.height ** 2)} kg`}
                        className="studio-timeline"
                        min={55}
                        max={110}
                        value={
                          weightKg ??
                          Math.round(76.788 * appearance.girth ** 2 * appearance.height ** 2)
                        }
                        onChange={(e) => setLocalWeightKg(Number(e.target.value))}
                      />
                    </label>
                  </>
                )}
              </TabsContent>
            )}
            {panel === "scene" && (
              <TabsContent value="scene" className="studio-fields">
                <label className="studio-wide">
                  Ângulo da câmera
                  <select
                    aria-label="Ângulo da câmera"
                    value={viewAngle}
                    onChange={(e) => setViewAngle(e.target.value)}
                    className={selectClass}
                  >
                    <option value="threeQuarter">Três quartos</option>
                    <option value="front">Frente</option>
                    <option value="profile">Perfil</option>
                    <option value="back">Costas</option>
                  </select>
                </label>
                <label className="studio-wide">
                  {t("studio.light")}
                  <select
                    aria-label={t("studio.light")}
                    value={light}
                    onChange={(e) => setLight(e.target.value)}
                    className={selectClass}
                  >
                    <option value="dia">{t("studio.day")}</option>
                    <option value="entardecer">{t("studio.sunset")}</option>
                    <option value="noite">{t("studio.night")}</option>
                  </select>
                </label>
                <p className="studio-hint studio-wide">{t("studio.cameraHint")}</p>
                <label
                  className="studio-wide"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <input
                    type="checkbox"
                    checked={clothPhysics}
                    onChange={(e) => setClothPhysics(e.target.checked)}
                  />
                  {t("studio.clothMotion")}
                </label>
                <p className="studio-hint studio-wide">{t("studio.clothHint")}</p>
              </TabsContent>
            )}
          </Tabs>
          {movement.action && (
            <div className="studio-phase" aria-label="Inspeção do movimento">
              <p className="studio-kicker">{t("studio.phase")}</p>
              <div role="group" aria-label="Etapa do movimento" className="studio-phase-buttons">
                {[
                  { label: t("studio.prepare"), at: 0.12 },
                  ...(/^(diveLeft|diveRight|saveHigh)$/.test(movement.action)
                    ? [{ label: "Impulsão", at: 0.28 }]
                    : []),
                  { label: t("studio.contact"), at: footballContactAt(movement.action) },
                  {
                    label: t("studio.follow"),
                    at: Math.min(0.78, footballContactAt(movement.action) + 0.2),
                  },
                  { label: t("studio.recover"), at: 0.88 },
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
                {t("studio.timeline")} · {Math.round((previewAt ?? 0) * 100)}%
                <input
                  type="range"
                  aria-label={t("studio.timeline")}
                  aria-valuetext={`${Math.round((previewAt ?? 0) * 100)}%`}
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
              <p className="studio-hint">{t("studio.phaseHint")}</p>
            </div>
          )}
          <button
            type="button"
            className="studio-button mt-4 w-full"
            onClick={() => setVariation((n) => n + 1)}
          >
            <Shuffle size={15} />
            {t("studio.shuffle")}
          </button>
        </aside>
      </div>
      <div className="studio-footer" aria-live="polite">
        <strong>{studioMovementLabel(lang, movement.id, movement.label)}</strong>
        <span>{t(detail ? "studio.detailModel" : "studio.lightModel")}</span>
        <span>•</span>
        <span>
          {metadata?.support === "airborne"
            ? t("studio.airborne")
            : metadata?.support === "alternating"
              ? t("studio.support")
              : t("studio.cameraHint")}
        </span>
      </div>
    </section>
  );
}
