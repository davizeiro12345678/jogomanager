import type { QualityLevel } from "./device";
import type { QualityPref } from "./visual-settings";
/** Read the already-created renderer; CPU core count cannot identify its GPU. */
export function matchGpuQuality(
  preference: QualityPref,
  detected: QualityLevel,
  renderer: string,
): QualityLevel {
  if (preference !== "auto") return preference === "cinema" ? "alta" : preference;
  if (/SwiftShader|llvmpipe|Microsoft Basic Render|Software Rasterizer/i.test(renderer))
    return "baixa";
  const integrated =
    /Intel.*(?:Iris|UHD|HD Graphics)|Radeon.*(?:680M|780M|Vega)|Radeon(?:\(TM\))? Graphics/i.test(
      renderer,
    );
  return integrated && detected === "alta" ? "media" : detected;
}
export function webglRendererName(renderer: { getContext?: () => unknown }): string {
  try {
    const context = renderer.getContext?.() as WebGLRenderingContext | undefined;
    if (typeof context?.getExtension !== "function") return "";
    const info = context.getExtension("WEBGL_debug_renderer_info");
    return info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    return "";
  }
}
