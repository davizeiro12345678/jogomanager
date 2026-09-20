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
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
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
  intensity = 1,
}: {
  quality: PostQuality;
  replay?: boolean;
  moment?: PostMoment;
  time?: PostTime;
  intensity?: number;
}) {
  const m: PostMoment = moment ?? (replay ? "replay" : "match");
  const p = useMemo(() => postPreset(quality, m, time, intensity), [quality, m, time, intensity]);
  const ab = useMemo(() => new THREE.Vector2(p.aberration, p.aberration * 1.4), [p.aberration]);

  if (quality === "baixa") return null;

  if (quality === "media") {
    return (
      <EffectComposer key="media" enableNormalPass={false} multisampling={0} resolutionScale={0.62}>
        <Bloom
          intensity={Math.max(0.04, p.bloom * 0.55)}
          luminanceThreshold={0.92}
          luminanceSmoothing={0.18}
          mipmapBlur
        />
        <HueSaturation saturation={p.saturation} hue={p.hue} />
        <BrightnessContrast brightness={p.brightness} contrast={p.contrast} />
        <Vignette offset={0.34} darkness={p.vignette * 0.55} />
        <SMAA />
      </EffectComposer>
    );
  }

  const cinema = m !== "match";

  return (
      <EffectComposer key={`alta-${m}`} enableNormalPass={cinema} multisampling={0} resolutionScale={cinema ? 0.82 : 0.72}>
      {cinema ? (
        <N8AO
          color="#0b1016"
          aoRadius={0.6}
          distanceFalloff={0.85}
          intensity={1.55 * (time === "noite" ? 1.1 : 1)}
          halfRes
          screenSpaceRadius={false}
        />
      ) : <></>}
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
      {cinema ? <ChromaticAberration offset={ab} radialModulation modulationOffset={0.35} /> : <></>}
      <HueSaturation saturation={p.saturation} hue={p.hue} />
      <BrightnessContrast brightness={p.brightness} contrast={p.contrast} />
      {cinema ? <Noise opacity={p.grain} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      <Vignette offset={cinema ? 0.15 : 0.26} darkness={p.vignette} />
      {/* O renderer já aplica ACES; uma segunda curva aqui esmagava médios e realces. */}
      <SMAA />
    </EffectComposer>
  );
}
