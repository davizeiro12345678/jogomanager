export type GraphicsRenderer = {
  constructor?: { name?: string };
  isWebGLRenderer?: boolean;
  isWebGPURenderer?: boolean;
  backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
  capabilities?: {
    isWebGL2?: boolean;
    maxTextureSize?: number;
    getMaxAnisotropy?: () => number;
  };
  getContext?: () => {
    VERSION?: number;
    getParameter?: (parameter: number) => unknown;
    getExtension?: (name: string) => {
      UNMASKED_RENDERER_WEBGL?: number;
      UNMASKED_VENDOR_WEBGL?: number;
    } | null;
  } | null;
};

/** Privacy-filtered/null GL values must never become a claimed GPU identity. */
function rendererIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (
    !name ||
    name.length > 1024 ||
    /^(?:null|undefined|unknown(?: renderer| gpu)?|disabled|unavailable|n\/a|none|\[object Object\]|webgl(?: renderer)?|webkit webgl)$/i.test(
      name,
    )
  )
    return null;
  return name;
}

/** Integrated Intel is physical hardware. Only an explicit software renderer
 * is classified as software; a hidden renderer stays unverified. */
export function graphicsRendererClass(name: string | null): "hardware" | "software" | "unknown" {
  const identity = rendererIdentity(name);
  if (!identity) return "unknown";
  return /swiftshader|llvmpipe|softpipe|software|basic render|lavapipe|microsoft warp/i.test(
    identity,
  )
    ? "software"
    : "hardware";
}

export function rendererMetadata(gl: unknown) {
  const renderer = gl as GraphicsRenderer;
  const name = renderer.constructor?.name ?? "unknown";
  // WebGPURenderer can internally fall back to WebGL. Its class name does
  // not prove which backend actually drew the scene.
  const isWebGpu = renderer.backend?.isWebGPUBackend === true;
  const isWebGl2 =
    !isWebGpu &&
    (renderer.backend?.isWebGLBackend === true || renderer.capabilities?.isWebGL2 === true);
  let contextVersion: string | null = null;
  let gpuRenderer: string | null = null;
  let gpuVendor: string | null = null;
  try {
    const context = renderer.getContext?.();
    if (context?.getParameter && typeof context.VERSION === "number") {
      const value = context.getParameter(context.VERSION);
      contextVersion = typeof value === "string" ? value : null;
      const debug = context.getExtension?.("WEBGL_debug_renderer_info");
      if (debug?.UNMASKED_RENDERER_WEBGL)
        gpuRenderer = rendererIdentity(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
      if (debug?.UNMASKED_VENDOR_WEBGL)
        gpuVendor = rendererIdentity(context.getParameter(debug.UNMASKED_VENDOR_WEBGL));
    }
  } catch {
    // WebGPU and privacy settings may hide GPU identity.
  }
  return {
    kind: isWebGpu
      ? "webgpu"
      : isWebGl2
        ? "webgl2"
        : renderer.isWebGLRenderer
          ? "webgl"
          : "unknown",
    renderer: name,
    contextVersion,
    gpuRenderer,
    gpuVendor,
    rendererClass: graphicsRendererClass(gpuRenderer),
    maxTextureSize: renderer.capabilities?.maxTextureSize ?? null,
    maxAnisotropy: renderer.capabilities?.getMaxAnisotropy?.() ?? null,
  };
}
