import { beforeEach, expect, it, vi } from "vitest";

const initialize = vi.hoisted(() => vi.fn());
vi.mock("@dimforge/rapier3d-compat", () => ({ init: initialize }));
beforeEach(() => {
  vi.resetModules();
  initialize.mockReset();
});

it("shares one initialization between concurrent physics consumers", async () => {
  let finish!: () => void;
  initialize.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { initializeRapier } = await import("./rapier-runtime");
  const first = initializeRapier();
  expect(initializeRapier()).toBe(first);
  await Promise.resolve();
  expect(initialize).toHaveBeenCalledTimes(1);
  finish();
  await first;
  await initializeRapier();
  expect(initialize).toHaveBeenCalledTimes(1);
});

it("does not permanently cache a rejected WASM download", async () => {
  initialize.mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
  const { initializeRapier } = await import("./rapier-runtime");
  await expect(initializeRapier()).rejects.toThrow("network");
  await initializeRapier();
  expect(initialize).toHaveBeenCalledTimes(2);
});
