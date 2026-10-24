import { expect, it } from "vitest";
import { matchGpuQuality, webglRendererName } from "./gpu-quality";
it("balances automatic integrated-GPU settings without upgrading a small device", () => {
  expect(matchGpuQuality("auto", "alta", "ANGLE (Intel Iris Xe)")).toBe("media");
  expect(matchGpuQuality("auto", "baixa", "Intel UHD Graphics")).toBe("baixa");
  expect(matchGpuQuality("auto", "alta", "AMD Radeon 780M")).toBe("media");
  expect(matchGpuQuality("auto", "alta", "SwiftShader")).toBe("baixa");
  expect(matchGpuQuality("auto", "alta", "NVIDIA GeForce RTX 4060")).toBe("alta");
});
it("honors explicitly selected detail and safely handles a private or WebGPU context", () => {
  expect(matchGpuQuality("alta", "media", "Intel Iris Xe")).toBe("alta");
  expect(matchGpuQuality("cinema", "media", "Intel Iris Xe")).toBe("alta");
  expect(webglRendererName({})).toBe("");
  expect(
    webglRendererName({
      getContext: () => {
        throw new Error("private");
      },
    }),
  ).toBe("");
});
