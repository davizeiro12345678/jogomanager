import { useMemo } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  N8AO,
  SMAA,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  HueSaturation,
  Noise,
  TiltShift2,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { postPreset } from "./presets";
import type { PostMoment, PostQuality, PostTime } from "./presets";

export type { PostMoment, PostQuality, PostTime };

/**
 * Pós-processamento estilo transmissão de TV.
 *
 * A calibração vive em `presets.ts`; aqui montamos as passagens conforme o
 * nível de qualidade:
 *  - baixa : nenhuma passagem (aparelho fraco desenha o quadro cru)
 *  - média : bloom, cor e vinheta em meia resolução
 *  - alta  : oclusão de contato, bloom, foco seletivo em replay/gol, cor,
 *            granulado, vinheta e anti-serrilhado
 */
export function PostFX({
  quality,
  replay = false,
  moment,
  time = "dia",
}: {
  quality: PostQuality;
  replay?: boolean;
  moment?: PostMoment;
  time?: PostTime;
}) {
  const m: PostMoment = moment ?? (replay ? "replay" : "match");
  const p = useMemo(() => postPreset(quality, m, time), [quality, m, time]);
  const ab = useMemo(
    () => new THREE.Vector2(p.aberration, p.aberration * 1.4),
    [p.aberration],
  );

  if (quality === "baixa") return null;

  if (quality === "media") {
    return (
      <EffectComposer key="media" enableNormalPass={false} resolutionScale={0.75}>
        <Bloom
          intensity={Math.max(0.05, p.bloom)}
          luminanceThreshold={p.bloomThreshold}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <HueSaturation saturation={p.saturation} hue={p.hue} />
        <BrightnessContrast brightness={p.brightness} contrast={p.contrast} />
        <Vignette offset={0.3} darkness={p.vignette} />
      </EffectComposer>
    );
  }

  const cinema = m !== "match";

  return (
    <EffectComposer key={`alta-${m}`} enableNormalPass={!cinema} multisampling={0}>
      {/* oclusão de contato: sombra suave onde jogadores e estruturas encostam */}
      {!cinema ? (
        <N8AO
          color="#0b1016"
          aoRadius={1.1}
          distanceFalloff={0.85}
          intensity={2.6}
          halfRes
          screenSpaceRadius={false}
        />
      ) : (
        <></>
      )}
      {p.dof > 0 ? (
        <DepthOfField
          focusDistance={m === "drama" ? 0.012 : 0.02}
          focalLength={m === "drama" ? 0.05 : 0.08}
          bokehScale={p.dof}
        />
      ) : (
        <></>
      )}
      <Bloom
        intensity={Math.max(0.05, p.bloom)}
        luminanceThreshold={p.bloomThreshold}
        luminanceSmoothing={0.35}
        mipmapBlur
      />
      {p.tilt > 0 ? <TiltShift2 blur={p.tilt} /> : <></>}
      {/* aberração só nas bordas, como lente de transmissão real */}
      <ChromaticAberration offset={ab} radialModulation modulationOffset={0.35} />
      <HueSaturation saturation={p.saturation} hue={p.hue} />
      <BrightnessContrast brightness={p.brightness} contrast={p.contrast} />
      <Noise opacity={p.grain} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={cinema ? 0.15 : 0.26} darkness={p.vignette} />
      {/* curva de cor final: realces suaves em vez de estourados */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}
