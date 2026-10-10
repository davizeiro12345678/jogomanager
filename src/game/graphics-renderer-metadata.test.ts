import { describe, expect, it } from "vitest";
import { graphicsRendererClass, rendererMetadata } from "./graphics-renderer-metadata";

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
});
