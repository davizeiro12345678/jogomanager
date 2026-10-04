import { describe, expect, it } from "vitest";
import { textureDecodeWorkers } from "./device-workload";

describe("texture decoder workload", () => {
  it("reserves capacity for the game on small devices", () => {
    expect(textureDecodeWorkers(2, 2)).toBe(1);
    expect(textureDecodeWorkers(4, 4)).toBe(1);
    expect(textureDecodeWorkers(8, 2)).toBe(1);
  });

  it("scales with available cores but caps background decoders", () => {
    expect(textureDecodeWorkers(6, 8)).toBe(3);
    expect(textureDecodeWorkers(8, 8)).toBe(4);
    expect(textureDecodeWorkers(16, 16)).toBe(4);
    expect(textureDecodeWorkers(undefined, undefined)).toBe(1);
  });
});
