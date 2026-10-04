type WebGLProbeContext = {
  getExtension(name: string): { loseContext(): void } | null;
};

type WebGLProbeCanvas = {
  getContext(kind: "webgl2"): WebGLProbeContext | null;
};

/**
 * R3F/Three requires WebGL2 for this renderer. Check that exact context
 * before mounting the canvas, then release the short-lived probe so it cannot
 * take one of the page's real rendering contexts.
 */
export function supportsWebGL(createCanvas?: () => WebGLProbeCanvas): boolean {
  if (!createCanvas && typeof document === "undefined") return false;
  try {
    const canvas = createCanvas ? createCanvas() : document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
