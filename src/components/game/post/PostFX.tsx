import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  SSAO,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  HueSaturation,
  Noise,
  TiltShift2,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

export type PostQuality = "alta" | "media" | "baixa";

/** Momento da partida: define o "clima" da imagem, como numa transmissão. */
export type PostMoment = "match" | "replay" | "drama";

const ABERRATION = new THREE.Vector2(0.0006, 0.0009);
const ABERRATION_STRONG = new THREE.Vector2(0.0016, 0.0022);

/**
 * Pós-processamento estilo transmissão de TV.
 *
 * Presets por nível de qualidade e por momento:
 *  - baixa            : sem passagens (aparelho fraco roda o quadro cru)
 *  - média            : bloom leve, cor e vinheta em meia resolução
 *  - alta / match     : oclusão de contato, bloom, cor de transmissão, SMAA
 *  - alta / replay    : cinema — foco raso, grão, vinheta forte, cor quente
 *  - drama (gol/fim)  : cinema exagerado com aberração de lente e tilt-shift
 */
export function PostFX({
  quality,
  replay = false,
  moment,
}: {
  quality: PostQuality;
  replay?: boolean;
  moment?: PostMoment;
}) {
  const m: PostMoment = moment ?? (replay ? "replay" : "match");

  if (quality === "baixa") return null;

  if (m === "drama" && quality !== "media") {
    return (
      <EffectComposer key="drama" enableNormalPass={false} multisampling={0}>
        <DepthOfField focusDistance={0.012} focalLength={0.05} bokehScale={5.5} />
        <Bloom intensity={1.25} luminanceThreshold={0.5} luminanceSmoothing={0.4} mipmapBlur />
        <ChromaticAberration offset={ABERRATION_STRONG} radialModulation={false} modulationOffset={0} />
        <HueSaturation saturation={0.3} hue={0.02} />
        <BrightnessContrast brightness={-0.03} contrast={0.28} />
        <Noise opacity={0.07} blendFunction={BlendFunction.OVERLAY} />
        <Vignette offset={0.12} darkness={0.95} />
      </EffectComposer>
    );
  }

  if (m === "replay" && quality !== "media") {
    return (
      <EffectComposer key="cinema" enableNormalPass={false} multisampling={0}>
        <DepthOfField focusDistance={0.02} focalLength={0.08} bokehScale={3.2} />
        <Bloom intensity={0.95} luminanceThreshold={0.58} luminanceSmoothing={0.35} mipmapBlur />
        <ChromaticAberration offset={ABERRATION} radialModulation={false} modulationOffset={0} />
        <HueSaturation saturation={0.24} />
        <BrightnessContrast brightness={-0.02} contrast={0.22} />
        <Noise opacity={0.055} blendFunction={BlendFunction.OVERLAY} />
        <Vignette offset={0.16} darkness={0.88} />
      </EffectComposer>
    );
  }

  if (quality === "media") {
    return (
      <EffectComposer key="media" enableNormalPass={false} resolutionScale={0.75}>
        <Bloom intensity={m === "match" ? 0.32 : 0.7} luminanceThreshold={0.78} luminanceSmoothing={0.25} mipmapBlur />
        <HueSaturation saturation={m === "match" ? 0.08 : 0.2} />
        <BrightnessContrast brightness={0} contrast={m === "match" ? 0.06 : 0.18} />
        <Vignette offset={0.3} darkness={m === "match" ? 0.5 : 0.72} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer key="alta" enableNormalPass multisampling={0}>
      {/* oclusão de contato: sombra suave onde jogadores e estruturas encostam */}
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={16}
        rings={4}
        distanceThreshold={0.6}
        distanceFalloff={0.12}
        rangeThreshold={0.008}
        rangeFalloff={0.008}
        luminanceInfluence={0.6}
        radius={0.06}
        intensity={16}
        bias={0.03}
        worldDistanceThreshold={40}
        worldDistanceFalloff={12}
        worldProximityThreshold={1}
        worldProximityFalloff={0.4}
      />
      <Bloom intensity={0.55} luminanceThreshold={0.7} luminanceSmoothing={0.3} mipmapBlur />
      {/* leve desfoque de miniatura só nas bordas: dá escala de estádio grande */}
      <TiltShift2 blur={0.09} />
      <ChromaticAberration offset={ABERRATION} radialModulation={false} modulationOffset={0} />
      <HueSaturation saturation={0.13} />
      <BrightnessContrast brightness={0.012} contrast={0.11} />
      <Vignette offset={0.26} darkness={0.58} />
      <SMAA />
    </EffectComposer>
  );
}
