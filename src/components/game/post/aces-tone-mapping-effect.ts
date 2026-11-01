import { BlendFunction, Effect } from "postprocessing";

/** Three's fixed ACES curve, without unused adaptive-luminance render targets. */
export function createAcesToneMappingEffect() {
  return new Effect(
    "ACES",
    `#include <tonemapping_pars_fragment>
void mainImage(const in vec4 color, const in vec2 uv, out vec4 result) {
  result = vec4(ACESFilmicToneMapping(color.rgb), color.a);
}`,
    { blendFunction: BlendFunction.SRC },
  );
}
