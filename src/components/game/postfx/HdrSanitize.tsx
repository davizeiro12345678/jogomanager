import { forwardRef, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

/*
 * A single NaN or Infinity pixel (half-float overflow from a bright glint,
 * a degenerate depth-of-field sample) is spread by bloom's blur until the
 * whole frame flashes white or black. This pass replaces non-finite values
 * and caps HDR brightness before the blurring effects read the image.
 */
const fragmentShader = /* glsl */ `
uniform float ceiling;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // Comparisons are false for NaN, so out-of-range or non-finite channels fail.
  bvec3 ok = bvec3(c.r > -1.0 && c.r < 1e6, c.g > -1.0 && c.g < 1e6, c.b > -1.0 && c.b < 1e6);
  c = vec3(ok.r ? c.r : 0.0, ok.g ? c.g : 0.0, ok.b ? c.b : 0.0);
  outputColor = vec4(clamp(c, 0.0, ceiling), inputColor.a);
}
`;

class HdrSanitizeEffect extends Effect {
  constructor(ceiling: number) {
    super("HdrSanitizeEffect", fragmentShader, {
      // Its own pass, so the next effects sample the cleaned image.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([["ceiling", new Uniform(ceiling)]]),
    });
  }
}

export const HdrSanitize = forwardRef<HdrSanitizeEffect, { ceiling?: number }>(
  function HdrSanitize({ ceiling = 24 }, ref) {
    const effect = useMemo(() => new HdrSanitizeEffect(ceiling), [ceiling]);
    return <primitive ref={ref} object={effect} dispose={null} />;
  },
);
