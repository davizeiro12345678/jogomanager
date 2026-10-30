import * as THREE from "three";

export type AsyncPixelReader = {
  readRenderTargetPixelsAsync(
    target: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<ArrayBufferView>;
};

/** Never block the match's render frame with a synchronous GPU readback.
 * Only one capture can be pending, and high-frequency invocations are
 * discarded rather than growing a queue of GPU fences. */
export class BoundedAsyncGpuReadback {
  private busy = false;
  private nextAt = 0;
  constructor(readonly minIntervalMs = 500, readonly maxPixels = 64 * 64) {}

  async tryRead(
    reader: AsyncPixelReader,
    target: THREE.RenderTarget,
    width: number,
    height: number,
    now: number,
  ): Promise<ArrayBufferView | null> {
    if (
      this.busy ||
      now < this.nextAt ||
      !Number.isFinite(now) ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > this.maxPixels
    ) return null;
    this.busy = true;
    this.nextAt = now + Math.max(0, this.minIntervalMs);
    try {
      return await reader.readRenderTargetPixelsAsync(target, 0, 0, width, height);
    } catch {
      return null;
    } finally {
      this.busy = false;
    }
  }

  reset(): void {
    this.nextAt = 0;
    // An in-flight GPU transfer cannot safely be canceled by the app.
    // It will release its slot when the returned Promise settles.
  }
}
