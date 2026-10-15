import { validSeatTransformRequest, type SeatTransformRequest } from "./seat-transform-contract";
let received = false;
self.onmessage = async ({ data }: MessageEvent<SeatTransformRequest>) => {
  try {
    if (received || !validSeatTransformRequest(data))
      throw new Error("Invalid shared seat request");
    received = true;
    const instance = await WebAssembly.instantiate(data.module, { env: { memory: data.memory } });
    const prepare = instance.exports["prepare_seats"];
    if (typeof prepare !== "function") throw new Error("Missing shared seat export");
    prepare(...data.args);
    // Release the completed range after native WASM writes. Never block render.
    Atomics.store(new Int32Array(data.memory.buffer, 0, 16), 2 + data.lane, 1);
    self.postMessage({ type: "done", lane: data.lane });
  } catch {
    self.postMessage({ type: "failed" });
  }
};
