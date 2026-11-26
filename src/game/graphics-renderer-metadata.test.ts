import { describe, expect, it } from "vitest";
import { graphicsRendererClass, rendererMetadata } from "./graphics-renderer-metadata";
import { assessNativePerformance } from "./native-performance-contract";

describe("actual graphics renderer", () => {
  it("distinguishes integrated hardware from software and hidden identity", () => {
    expect(graphicsRendererClass("ANGLE Intel Iris Xe D3D11")).toBe("hardware");
    expect(graphicsRendererClass("ANGLE Intel UHD Graphics 620")).toBe("hardware");
    expect(graphicsRendererClass("ANGLE Google SwiftShader")).toBe("software");
    expect(graphicsRendererClass(null)).toBe("unknown");
  });
  it("requires the initialized backend to claim native WebGPU", () => {
    expect(rendererMetadata({ isWebGPURenderer: true }).kind).toBe("unknown");
    expect(
      rendererMetadata({ isWebGPURenderer: true, backend: { isWebGLBackend: true } }).kind,
    ).toBe("webgl2");
    expect(rendererMetadata({ backend: { isWebGPUBackend: true } }).kind).toBe("webgpu");
  });
  it.each([null, undefined, 7, false, {}, "", "  ", "null", "undefined", "unknown", "Disabled"])(
    "never certifies a hidden or malformed GL identity (%j)",
    (identity) => {
      const metadata = rendererMetadata({
        capabilities: { isWebGL2: true },
        getContext: () => ({
          VERSION: 1,
          getParameter: (parameter: number) => (parameter === 1 ? "WebGL 2.0" : identity),
          getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 2, UNMASKED_VENDOR_WEBGL: 3 }),
        }),
      });
      expect(metadata.gpuRenderer).toBeNull();
      expect(metadata.rendererClass).toBe("unknown");
      const result = assessNativePerformance({
        fps: 70,
        p95: 19,
        onePercentLow: 51,
        width: 1280,
        height: 720,
        dpr: 1,
        quality: "alta",
        gpuRenderer: metadata.gpuRenderer,
        warmupMs: 60000,
        measurementMs: 300000,
        complete: true,
        interruptions: 0,
        coveredMs: 300000,
        contractChanged: false,
        adaptive: false,
      });
      expect(result.passes).toBe(false);
      expect(result.reasons).toContain("native-gpu-unverified");
    },
  );
});
