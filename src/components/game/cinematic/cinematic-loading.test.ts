import { describe, expect, it, vi } from "vitest";

import { retryChunk } from "@/lib/chunk-retry";

describe("cinematic chunk retry", () => {
  it("retries with bounded backoff and resolves after transient chunk failures", async () => {
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("primeira"))
      .mockRejectedValueOnce(new Error("segunda"))
      .mockResolvedValue("stage");
    const sleeps: number[] = [];

    await expect(
      retryChunk("cutscene", importer, (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      }),
    ).resolves.toBe("stage");

    expect(importer).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([500, 1500]);
  });

  it("clears the rejected attempt and exposes the final failure", async () => {
    const failure = new Error("chunk ausente");
    const importer = vi.fn<() => Promise<string>>().mockRejectedValue(failure);
    const sleeps: number[] = [];

    await expect(
      retryChunk("cutscene", importer, (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      }),
    ).rejects.toBe(failure);

    expect(importer).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([500, 1500]);
  });
});
