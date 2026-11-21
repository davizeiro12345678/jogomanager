import { buildCrowdSeatUpload } from "./crowd-seat-upload";
import { MAX_SHARED_SEATS } from "./wasm/seat-transform-contract";

self.onmessage = ({ data }: MessageEvent<unknown>) => {
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
