import { buildCrowdSeatUpload } from "./crowd-seat-upload";
import { MAX_SHARED_SEATS } from "./wasm/seat-transform-contract";

self.onmessage = (event: MessageEvent<unknown>) => {
  // This module is a dedicated Worker, not a Window message receiver.
  // Native dedicated-worker messages use an empty origin; where the
  // browser supplies an origin, only the worker's own origin is accepted.
  if (!event.isTrusted || (event.origin !== "" && event.origin !== self.location.origin)) return;
  const data = event.data;
  if (
    !(data instanceof Float64Array) ||
    data.length % 9 !== 0 ||
    data.length > MAX_SHARED_SEATS * 9
  ) {
    self.postMessage(null);
    return;
  }
  const result = buildCrowdSeatUpload(data);
  self.postMessage(result, { transfer: [result.matrices.buffer] });
};
