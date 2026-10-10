import { expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";
const probe = vi.hoisted(() => ({
  rendered: undefined as (() => void) | undefined,
  stop: vi.fn(),
}));
vi.mock("./graphics-probe", () => ({
  subscribeRenderedFrames: (_gl: unknown, render: () => void) => {
    probe.rendered = render;
    return probe.stop;
  },
}));
import { observeCanvasLifecycle } from "./canvas-lifecycle";

it("waits for a completed draw after mount and context restoration, then removes its listeners", () => {
  const canvas = new EventTarget();
  const status = vi.fn(),
    invalidate = vi.fn();
  const stop = observeCanvasLifecycle(
    { domElement: canvas } as unknown as WebGLRenderer,
    invalidate,
    status,
  );
  expect(status.mock.calls.map(([value]) => value)).toEqual(["loading"]);
  probe.rendered!();
  probe.rendered!();
  expect(status.mock.calls.map(([value]) => value)).toEqual(["loading", "ready"]);
  const loss = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(loss);
  expect(loss.defaultPrevented).toBe(true);
  probe.rendered!();
  expect(status).toHaveBeenLastCalledWith("lost");
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(status).toHaveBeenLastCalledWith("loading");
  expect(invalidate).toHaveBeenCalledTimes(2);
  probe.rendered!();
  expect(status).toHaveBeenLastCalledWith("ready");
  stop();
  const count = status.mock.calls.length;
  canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(status).toHaveBeenCalledTimes(count);
  expect(probe.stop).toHaveBeenCalledOnce();
});
