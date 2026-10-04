import { afterEach, expect, it, vi } from "vitest";
import { loadCrowdVisibilityWasm } from "./crowd-visibility";

afterEach(() => vi.unstubAllGlobals());

it("does not initialize optional visual WASM in SSR", async () => {
  vi.stubGlobal("window", undefined);
  expect(await loadCrowdVisibilityWasm()).toBeNull();
});

it("retains the TypeScript path on browsers without WebAssembly", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("WebAssembly", undefined);
  expect(await loadCrowdVisibilityWasm()).toBeNull();
});
