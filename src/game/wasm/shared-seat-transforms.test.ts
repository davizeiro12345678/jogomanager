import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { Object3D } from "three";

describe("native shared-memory WASM preparation", () => {
  it("executes two disjoint worker ranges in one WASM memory and preserves Three transforms", async () => {
    const count = 96;
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 512, shared: true });
    const module = await WebAssembly.compile(
      readFileSync(new URL("./pkg/seat-transforms.wasm", import.meta.url)),
    );
    const inputs = new Float64Array(memory.buffer, 64, count * 9);
    for (let seat = 0; seat < count; seat++)
      inputs.set([seat - 48, seat % 9, 40 - seat * 0.3, 0.1, 0.4, 0.8, 0.7, 0.5, 0.3], seat * 9);
    const matrices = 64 + inputs.byteLength;
    const colors = matrices + count * 64;
    const skins = colors + count * 12;
    const styles = skins + count * 12;
    const source = `const {parentPort}=require('node:worker_threads'); parentPort.on('message',async ({module,memory,lane,args})=>{
      try {const instance=await WebAssembly.instantiate(module,{env:{memory}});instance.exports.prepare_seats(...args);
      Atomics.store(new Int32Array(memory.buffer,0,16),2+lane,1);parentPort.postMessage('done');}
      catch(error){parentPort.postMessage(String(error));}});`;
    const workers = [new Worker(source, { eval: true }), new Worker(source, { eval: true })];
    try {
      await Promise.all(
        workers.map(
          (worker, lane) =>
            new Promise<void>((resolve, reject) => {
              worker.once("error", reject);
              worker.once("message", (result) =>
                result === "done" ? resolve() : reject(new Error(result)),
              );
              worker.postMessage({
                module,
                memory,
                lane,
                args: [
                  (count * lane) / 2,
                  (count * (lane + 1)) / 2,
                  64,
                  matrices,
                  colors,
                  skins,
                  styles,
                ],
              });
            }),
        ),
      );
      const output = new Float32Array(memory.buffer, matrices, count * 16);
      const object = new Object3D();
      for (let seat = 0; seat < count; seat++) {
        const x = inputs[seat * 9]!,
          y = inputs[seat * 9 + 1]!,
          z = inputs[seat * 9 + 2]!;
        const height = 0.9 + (seat % 7) * 0.025;
        object.position.set(x, y, z);
        object.rotation.set(0, Math.atan2(-x, -z), 0);
        object.scale.set(height * (0.92 + (seat % 3) * 0.06), height, height);
        object.updateMatrix();
        object.matrix.elements.forEach((value, channel) =>
          expect(output[seat * 16 + channel]).toBeCloseTo(value, 5),
        );
      }
      expect(Atomics.load(new Int32Array(memory.buffer), 2)).toBe(1);
      expect(Atomics.load(new Int32Array(memory.buffer), 3)).toBe(1);
      expect(Array.from(new Float32Array(memory.buffer, colors, 3))).toEqual([
        Math.fround(0.1),
        Math.fround(0.4),
        Math.fround(0.8),
      ]);
    } finally {
      await Promise.all(workers.map((worker) => worker.terminate()));
    }
  });
});
