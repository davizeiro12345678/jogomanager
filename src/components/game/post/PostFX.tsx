import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
import { BlendFunction, type DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { postPreset } from "./presets";
import type { PostMoment, PostQuality, PostTime } from "./presets";
import { GradeLut } from "./GradeLut";
import type { GradeMoment, GradeTime, GradeWeather } from "@/game/graphics/grade";

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
  cinematic = false,
  grading,
  focusTarget,
  antialias = true,
}: {
  quality: PostQuality;
  replay?: boolean;
  moment?: PostMoment;
  time?: PostTime;
  intensity?: number;
  /** Ativa o tratamento de lente do modo Cinema/Diretor mesmo fora de um gol. */
  cinematic?: boolean;
  /**
   * Correção de cor por LUT 3D. Quando ausente, nenhum passe extra é montado —
   * é assim que o caminho WebGPU e a qualidade baixa ficam sem custo nenhum.
   */
  grading?: { time: GradeTime; weather: GradeWeather; moment: GradeMoment } | undefined;
  /** A live world-space target keeps cinematic dialogue faces in focus. */
  focusTarget?: THREE.Vector3 | undefined;
  /** A canvas with native MSAA does not need a second antialias pass or SMAA images. */
  antialias?: boolean;
}) {
  const m: PostMoment = moment ?? (replay ? "replay" : "match");
  const p = useMemo(() => postPreset(quality, m, time, intensity), [quality, m, time, intensity]);
  const ab = useMemo(() => new THREE.Vector2(p.aberration, p.aberration * 1.4), [p.aberration]);
  const depth = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    if (focusTarget && depth.current?.target) depth.current.target.copy(focusTarget);
  });

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
        <HueSaturation saturation={p.saturation * 1.25} hue={p.hue} />
        <BrightnessContrast brightness={p.brightness + 0.012} contrast={p.contrast * 1.2} />
        <Vignette offset={0.3} darkness={p.vignette * 0.7} />
        {antialias ? <SMAA /> : <></>}
      </EffectComposer>
    );
  }

  const cinema = cinematic || m !== "match";

  return (
    <EffectComposer
      key={`alta-${m}`}
      // N8AO reconstructs its normals from depth; the remaining lens effects
      // also use depth/color. An unused NormalPass redrew the complete scene.
      enableNormalPass={false}
      multisampling={0}
      resolutionScale={cinema ? 0.9 : 0.8}
    >
      {cinema ? (
        <N8AO
          color="#0b1016"
          aoRadius={0.6}
          distanceFalloff={0.85}
          intensity={1.55 * (time === "noite" ? 1.1 : 1)}
          halfRes
          screenSpaceRadius={false}
        />
      ) : (
        <></>
      )}
      {p.dof > 0 ? (
        <DepthOfField
          ref={depth}
          {...(focusTarget
            ? { target: focusTarget, worldFocusRange: 2.4 }
            : {
                focusDistance: m === "drama" ? 0.012 : 0.02,
                focalLength: m === "drama" ? 0.05 : 0.08,
              })}
          bokehScale={focusTarget ? Math.min(1.2, p.dof) : p.dof}
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
      {cinema ? (
        <ChromaticAberration offset={ab} radialModulation modulationOffset={0.35} />
      ) : (
        <></>
      )}
      {grading ? <></> : <HueSaturation saturation={p.saturation} hue={p.hue} />}
      {grading ? <></> : <BrightnessContrast brightness={p.brightness} contrast={p.contrast} />}
      {cinema ? <Noise opacity={p.grain} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {/* Uma LUT 3D substitui brilho/contraste/saturação/temperatura de uma vez */}
      {grading ? (
        <GradeLut time={grading.time} weather={grading.weather} moment={grading.moment} />
      ) : (
        <></>
      )}
      <Vignette offset={cinema ? 0.15 : 0.26} darkness={p.vignette} />
      {/* O renderer já aplica ACES; uma segunda curva aqui esmagava médios e realces. */}
      {antialias ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
