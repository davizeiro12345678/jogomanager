import { afterEach, expect, it, vi } from "vitest";

const initialize = vi.hoisted(() => vi.fn().mockRejectedValue(new Error("binary unavailable")));
vi.mock("./pkg/crowd_visibility_wasm", () => ({ default: initialize }));
import { loadCrowdVisibilityWasm } from "./crowd-visibility";

afterEach(() => vi.unstubAllGlobals());

it("memoizes a failed optional binary so a match never retries every render frame", async () => {
  vi.stubGlobal("window", {});
  expect(await loadCrowdVisibilityWasm()).toBeNull();
  expect(await loadCrowdVisibilityWasm()).toBeNull();
  expect(initialize).toHaveBeenCalledTimes(1);
});
