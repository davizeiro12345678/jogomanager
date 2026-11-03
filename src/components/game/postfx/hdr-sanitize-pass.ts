import { ShaderPass } from "postprocessing";
import { ShaderMaterial, Uniform } from "three";

/*
 * A single NaN or Infinity pixel (half-float overflow from a bright glint,
 * a degenerate depth-of-field sample) is spread by bloom's blur until the
 * whole frame flashes white or black. This standalone pass replaces
 * non-finite values and caps HDR brightness, so every later effect pass
 * (bloom, grading, vignette) reads a clean image.
 */
const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D inputBuffer;
uniform float ceiling;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(inputBuffer, vUv);
  vec3 c = color.rgb;
  // Comparisons are false for NaN, so non-finite or absurd channels fail.
  c.r = (c.r > -1.0 && c.r < 1e6) ? c.r : 0.0;
  c.g = (c.g > -1.0 && c.g < 1e6) ? c.g : 0.0;
  c.b = (c.b > -1.0 && c.b < 1e6) ? c.b : 0.0;
  gl_FragColor = vec4(clamp(c, 0.0, ceiling), color.a);
}
`;

export function createHdrSanitizePass(ceiling = 24) {
  return new ShaderPass(
    new ShaderMaterial({
      name: "HdrSanitize",
      uniforms: { inputBuffer: new Uniform(null), ceiling: new Uniform(ceiling) },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
    }),
    "inputBuffer",
  );
}
