import type { CrowdVisibilityInput } from "./crowd-visibility";

/** One producer / one consumer. Atomics publish complete snapshots only. */
export const MAILBOX_CAPACITY = 5_120;
export const CAMERA_VALUES = 33;
export type CrowdMailbox = {
  state: Int32Array;
  camera: Float64Array;
  packed: Uint32Array;
};

/** Reject malformed shared views before any atomic publication or copy. */
export function validCrowdMailbox(value: unknown): value is CrowdMailbox {
  if (!value || typeof value !== "object" || typeof SharedArrayBuffer === "undefined") return false;
  const mailbox = value as Partial<CrowdMailbox>;
  if (!(
    mailbox.state instanceof Int32Array &&
    mailbox.state.length === 2 &&
    mailbox.state.buffer instanceof SharedArrayBuffer &&
    mailbox.camera instanceof Float64Array &&
    mailbox.camera.length === CAMERA_VALUES &&
    mailbox.camera.buffer instanceof SharedArrayBuffer &&
    mailbox.packed instanceof Uint32Array &&
    mailbox.packed.length === MAILBOX_CAPACITY &&
    mailbox.packed.buffer instanceof SharedArrayBuffer
  ))
    return false;
  const views = [mailbox.state!, mailbox.camera!, mailbox.packed!];
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const left = views[i]!,
        right = views[j]!;
      if (
        left.buffer === right.buffer &&
        left.byteOffset < right.byteOffset + right.byteLength &&
        right.byteOffset < left.byteOffset + left.byteLength
      )
        return false;
    }
  }
  return true;
}

export function createCrowdMailbox(): CrowdMailbox {
  return {
    state: new Int32Array(new SharedArrayBuffer(8)),
    camera: new Float64Array(new SharedArrayBuffer(CAMERA_VALUES * 8)),
    packed: new Uint32Array(new SharedArrayBuffer(MAILBOX_CAPACITY * 4)),
  };
}

export function writeCrowdCamera(target: Float64Array, input: CrowdVisibilityInput): void {
  // A short frustum means visible in both selectors. Never retain the planes
  // from the preceding camera when reusing the transport buffer.
  target.fill(0, 0, 24);
  if (input.frustumPlanes.length >= 24) target.set(input.frustumPlanes.subarray(0, 24), 0);
  target[24] = input.camera.x;
  target[25] = input.camera.y;
  target[26] = input.camera.z;
  target[27] = input.projectedScale;
  target[28] = Number(input.perspective);
  target[29] = normalizeCrowdBudget(input.maxTiles, input.layout.tileCount);
  target[30] = normalizeCrowdBudget(input.maxInstances, MAILBOX_CAPACITY);
  target[31] = input.detailedPixels;
  target[32] = input.meshPixels;
}

export function normalizeCrowdBudget(value: number, ceiling: number): number {
  return Number.isFinite(value) ? Math.min(ceiling, Math.max(0, Math.floor(value))) : 0;
}

export function publishCrowdResult(mailbox: CrowdMailbox, packed: Uint32Array): void {
  if (packed.length > MAILBOX_CAPACITY) throw new RangeError("Crowd result exceeds mailbox");
  mailbox.packed.set(packed);
  Atomics.store(mailbox.state, 1, packed.length);
  Atomics.store(mailbox.state, 0, 2);
}
