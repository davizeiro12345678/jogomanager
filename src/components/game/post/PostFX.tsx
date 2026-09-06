import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  BrightnessContrast,
  HueSaturation,
  Noise,
} from "@react-three/postprocessing";

export type PostQuality = "alta" | "media" | "baixa";

/**
 * Pós-processamento estilo transmissão.
 *
 * Presets separados por nível e por momento do jogo:
 *  - alta  : correção de cor + bloom seletivo + vinheta + antisserrilhamento
 *  - média : correção de cor + bloom leve (sem SMAA, o MSAA do canvas cobre)
 *  - baixa : nenhuma passagem (celular fraco roda o quadro cru)
 *  - replay: preset cinema, com grão e vinheta forte
 *
 * Limite de projeto: no máximo 2 passagens caras (bloom + SMAA).
 */
export function PostFX({
  quality,
  replay = false,
}: {
  quality: PostQuality;
  replay?: boolean;
}) {
  if (quality === "baixa") return null;

  if (replay) {
    return (
      <EffectComposer key="cinema" enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.95} luminanceThreshold={0.58} luminanceSmoothing={0.35} mipmapBlur />
        <HueSaturation saturation={0.24} />
        <BrightnessContrast brightness={-0.02} contrast={0.22} />
        <Noise opacity={0.055} />
        <Vignette offset={0.16} darkness={0.88} />
      </EffectComposer>
    );
  }

  if (quality === "media") {
    return (
      <EffectComposer key="media" enableNormalPass={false} resolutionScale={0.75}>
        <Bloom intensity={0.32} luminanceThreshold={0.78} luminanceSmoothing={0.25} mipmapBlur />
        <HueSaturation saturation={0.08} />
        <Vignette offset={0.3} darkness={0.5} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer key="alta" enableNormalPass={false} multisampling={0}>
      <Bloom intensity={0.55} luminanceThreshold={0.7} luminanceSmoothing={0.3} mipmapBlur />
      <HueSaturation saturation={0.13} />
      <BrightnessContrast brightness={0.012} contrast={0.11} />
      <Vignette offset={0.26} darkness={0.58} />
      <SMAA />
    </EffectComposer>
  );
}
