import { expect, it, vi } from "vitest";
import {
  installRendererResourceProbe,
  RESOURCE_PROBE_REQUEST,
  RESOURCE_PROBE_SNAPSHOT,
} from "./renderer-resource-probe";
it("samples only on request and removes the callback on disposal", () => {
  const target = new EventTarget(),
    capture = vi.fn(() => ({ geometries: 14 }));
  const received: unknown[] = [];
  target.addEventListener(RESOURCE_PROBE_SNAPSHOT, (event) =>
    received.push((event as CustomEvent).detail),
  );
  for (let index = 0; index < 100; index++) {
    const stop = installRendererResourceProbe(target, capture);
    expect(capture).toHaveBeenCalledTimes(index);
    target.dispatchEvent(new Event(RESOURCE_PROBE_REQUEST));
    stop();
    target.dispatchEvent(new Event(RESOURCE_PROBE_REQUEST));
  }
  expect(capture).toHaveBeenCalledTimes(100);
  expect(received).toEqual(Array.from({ length: 100 }, () => ({ geometries: 14 })));
});
