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
import { AcesToneMapping } from "./AcesToneMapping";
import type { GradeMoment, GradeTime, GradeWeather } from "@/game/graphics/grade";

export type { PostMoment, PostQuality, PostTime };

/**
 * Pós-processamento estilo transmissão de TV.
 *
 * A calibração vive em `presets.ts`; aqui montamos as passagens conforme o
 * nível de qualidade:
 *  - baixa : nenhuma passagem (aparelho fraco desenha o quadro cru)
 *  - média : bloom, cor e vinheta
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

  const medium = quality === "media";
  const cinema = !medium && (cinematic || m !== "match");
  const grade = medium ? undefined : grading;

  return (
    <EffectComposer
      // Sem trocar a key por momento: remontar o compositor piscava a tela.
      // N8AO reconstructs its normals from depth; the remaining lens effects
      // also use depth/color. An unused NormalPass redrew the complete scene.
      enableNormalPass={false}
      multisampling={0}
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
        intensity={medium ? Math.max(0.04, p.bloom * 0.55) : Math.max(0.05, p.bloom)}
        luminanceThreshold={medium ? 0.92 : Math.max(0.82, p.bloomThreshold)}
        luminanceSmoothing={medium ? 0.18 : 0.22}
        radius={medium ? 0.85 : 0.72}
        mipmapBlur
      />
      {cinema ? (
        <ChromaticAberration offset={ab} radialModulation modulationOffset={0.35} />
      ) : (
        <></>
      )}
      <AcesToneMapping />
      {grade ? (
        <></>
      ) : (
        <HueSaturation saturation={p.saturation * (medium ? 1.25 : 1)} hue={p.hue} />
      )}
      {grade ? (
        <></>
      ) : (
        <BrightnessContrast
          brightness={p.brightness + (medium ? 0.012 : 0)}
          contrast={p.contrast * (medium ? 1.2 : 1)}
        />
      )}
      {cinema ? <Noise opacity={p.grain} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {/* Uma LUT 3D substitui brilho/contraste/saturação/temperatura de uma vez */}
      {grade ? <GradeLut time={grade.time} weather={grade.weather} moment={grade.moment} /> : <></>}
      <Vignette
        offset={medium ? 0.3 : cinema ? 0.15 : 0.26}
        darkness={p.vignette * (medium ? 0.7 : 1)}
      />
      {/* The composer disables renderer tone mapping; ACES precedes display grading. */}
      {antialias ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
