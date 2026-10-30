import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BoundedAsyncGpuReadback } from "./gpu-async-readback";

describe("nonblocking GPU readback", () => {
  it("drops overlapping read requests and enforces a bounded frequency", async () => {
    const target = new THREE.RenderTarget(2, 2);
    let release!: (pixels: Uint8Array) => void;
    const pending = new Promise<Uint8Array>((resolve) => {
      release = resolve;
    });
    const reader = { readRenderTargetPixelsAsync: vi.fn().mockReturnValueOnce(pending) };
    const pipeline = new BoundedAsyncGpuReadback(100, 16);
    const first = pipeline.tryRead(reader, target, 2, 2, 1000);
    expect(await pipeline.tryRead(reader, target, 2, 2, 1050)).toBeNull();
    release(new Uint8Array(16));
    expect((await first)?.byteLength).toBe(16);
    expect(await pipeline.tryRead(reader, target, 2, 2, 1050)).toBeNull();
    expect(reader.readRenderTargetPixelsAsync).toHaveBeenCalledTimes(1);
    target.dispose();
  });
  it("rejects oversized GPU requests without transferring anything", async () => {
    const target = new THREE.RenderTarget(256, 256);
    const reader = { readRenderTargetPixelsAsync: vi.fn() };
    const pipeline = new BoundedAsyncGpuReadback();
    expect(await pipeline.tryRead(reader, target, 256, 256, 1)).toBeNull();
    expect(reader.readRenderTargetPixelsAsync).not.toHaveBeenCalled();
    target.dispose();
  });
});
