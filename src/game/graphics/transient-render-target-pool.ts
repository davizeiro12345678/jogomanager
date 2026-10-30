import * as THREE from "three";

type TargetRecord = {
  target: THREE.RenderTarget;
  key: string;
  bytes: number;
  used: boolean;
};

export type TargetSpec = Readonly<{
  width: number;
  height: number;
  type?: THREE.TextureDataType;
  depthBuffer?: boolean;
}>;

/** Bounded temporary render targets for experimental multi-pass effects.
 * Pipeline-owned TRAA history is deliberately excluded: it must survive
 * across frames and must never be leased to another consumer. */
export class TransientRenderTargetPool {
  private readonly records: TargetRecord[] = [];
  constructor(readonly maxBytes = 32 * 1024 * 1024) {}
  acquire(spec: TargetSpec): THREE.RenderTarget {
    const { width, height, type = THREE.UnsignedByteType, depthBuffer = false } = spec;
    if (![width, height].every((n) => Number.isSafeInteger(n) && n > 0))
      throw new RangeError("Invalid render-target dimensions");
    const bytes = width * height * (type === THREE.HalfFloatType ? 8 : 4) +
      (depthBuffer ? width * height * 4 : 0);
    if (bytes > this.maxBytes) throw new RangeError("Target exceeds transient GPU memory budget");
    const key = [width, height, type, Number(depthBuffer)].join("/");
    const reusable = this.records.find((item) => !item.used && item.key === key);
    if (reusable) {
      reusable.used = true;
      return reusable.target;
    }
    // Remove idle targets before allocating another surface. Never dispose
    // a leased target even if temporarily above the global target budget.
    while (this.totalBytes + bytes > this.maxBytes) {
      const victimIndex = this.records.findIndex((record) => !record.used);
      if (victimIndex < 0) throw new RangeError("No idle render targets available");
      this.records[victimIndex]!.target.dispose();
      this.records.splice(victimIndex, 1);
    }
    const target = new THREE.RenderTarget(width, height, {
      type,
      depthBuffer,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    this.records.push({ target, key, bytes, used: true });
    return target;
  }
  release(target: THREE.RenderTarget): void {
    const record = this.records.find((item) => item.target === target);
    if (!record || !record.used) throw new Error("Render target is not leased by this pool");
    record.used = false;
  }
  get totalBytes(): number {
    return this.records.reduce((total, item) => total + item.bytes, 0);
  }
  get cachedCount(): number {
    return this.records.length;
  }
  dispose(): void {
    for (const record of this.records) record.target.dispose();
    this.records.length = 0;
  }
}
