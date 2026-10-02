import {
  EffectComposer,
  Bloom,
  Vignette,
  N8AO,
  BrightnessContrast,
  HueSaturation,
} from "@react-three/postprocessing";
import type { QualityLevel } from "@/game/device";

/** Dialogue needs a crisp face: restrained grading and short-range contact AO.
 * No extra normal pass, heavy bokeh, chromatic fringes or animated grain. */
export default function CinematicLens({ quality }: { quality: QualityLevel }) {
  if (quality === "baixa") return null;
  return (
    <EffectComposer key={quality} enableNormalPass={false} multisampling={0}>
      {quality === "alta" ? (
        <N8AO
          color="#172330"
          aoRadius={0.18}
          distanceFalloff={0.5}
          intensity={0.6}
          halfRes
          screenSpaceRadius={false}
        />
      ) : (
        <></>
      )}
      <Bloom intensity={0.12} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
      <HueSaturation saturation={-0.025} />
      <BrightnessContrast brightness={0.015} contrast={0.035} />
      <Vignette offset={0.22} darkness={0.22} />
    </EffectComposer>
  );
}
