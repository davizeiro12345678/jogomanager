import { buildCrowdSeatUpload, packCrowdSeats, type CrowdSeatSource } from "./crowd-seat-upload";
import { acquirePresentationLanes } from "./presentation-lanes";
import { prepareSharedSeatBuffers, type SeatBuffers } from "./wasm/shared-seat-transforms";

async function prepareTransferableSeats(
  source: CrowdSeatSource,
  signal: AbortSignal,
): Promise<SeatBuffers | null> {
  if (source.positions.length < 512 || typeof Worker === "undefined") return null;
  const release = await acquirePresentationLanes(1, signal, 150);
  if (!release) return null;
  let worker: Worker | undefined;
  try {
    if (signal.aborted) return null;
    worker = new Worker(new URL("./crowd-seat-upload.worker.ts", import.meta.url), {
      type: "module",
    });
    const lane = worker;
    return await new Promise<SeatBuffers | null>((resolve) => {
      const finish = (result: SeatBuffers | null) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        lane.onmessage = lane.onerror = lane.onmessageerror = null;
        resolve(result);
      };
      const abort = () => finish(null);
      const timer = setTimeout(abort, 1_000);
      signal.addEventListener("abort", abort, { once: true });
      lane.onerror = lane.onmessageerror = abort;
      lane.onmessage = ({ data }: MessageEvent<SeatBuffers | null>) => finish(data);
      try {
        const input = packCrowdSeats(source);
        lane.postMessage(input, [input.buffer]);
      } catch {
        abort();
      }
    });
  } catch {
    return null;
  } finally {
    worker?.terminate();
    release();
  }
}

export async function prepareCrowdSeatUpload(source: CrowdSeatSource, signal: AbortSignal) {
  const shared = await prepareSharedSeatBuffers(source, signal);
  if (shared || signal.aborted) return shared;
  const transferred = await prepareTransferableSeats(source, signal);
  if (transferred || signal.aborted) return transferred;
  return buildCrowdSeatUpload(packCrowdSeats(source));
}
