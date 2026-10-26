import { useMemo } from "react";
import {
  EffectComposer,
  Bloom,
  FXAA,
  Vignette,
  HueSaturation,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { postPreset } from "./presets";
import { GradeLut } from "./GradeLut";
import type { ComponentProps } from "react";
import type { PostFX } from "./PostFX";

/** Color-only path: retain scene depth for opaque occlusion, without a normal
 * pass, depth-reading effects, AO, bokeh or SMAA images. */
export default function BalancedPostFX(
  props: ComponentProps<typeof PostFX> & {
    colorTreatment?: {
      saturation: number;
      brightness: number;
      contrast: number;
      vignetteOffset: number;
      vignetteDarkness: number;
      bloom: number;
      bloomThreshold: number;
    };
  },
) {
  const { quality, time = "dia", intensity = 1, grading, antialias = true } = props;
  const moment = props.moment ?? (props.replay ? "replay" : "match");
  const treatment = props.colorTreatment;
  const p = useMemo(
    () => postPreset(quality, moment, time, intensity),
    [quality, moment, time, intensity],
  );
  return (
    <EffectComposer
      enableNormalPass={false}
      depthBuffer={true}
      stencilBuffer={false}
      multisampling={0}
    >
      {time !== "dia" || treatment ? (
        <Bloom
          intensity={treatment?.bloom ?? p.bloom * 0.65}
          luminanceThreshold={treatment?.bloomThreshold ?? p.bloomThreshold}
          luminanceSmoothing={0.25}
          mipmapBlur={false}
          resolutionScale={0.35}
          kernelSize={KernelSize.SMALL}
        />
      ) : (
        <></>
      )}
      {grading ? (
        <GradeLut {...grading} />
      ) : (
        <HueSaturation saturation={treatment?.saturation ?? p.saturation} hue={p.hue} />
      )}
      {grading ? (
        <></>
      ) : (
        <BrightnessContrast
          brightness={treatment?.brightness ?? p.brightness}
          contrast={treatment?.contrast ?? p.contrast}
        />
      )}
      <Vignette
        offset={treatment?.vignetteOffset ?? 0.26}
        darkness={treatment?.vignetteDarkness ?? p.vignette * 0.8}
      />
      {antialias ? <FXAA /> : <></>}
    </EffectComposer>
  );
}
