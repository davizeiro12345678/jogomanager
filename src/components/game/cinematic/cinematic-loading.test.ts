import { describe, expect, it, vi } from "vitest";
import { createElement, memo } from "react";
import { renderToReadableStream } from "react-dom/server";

import { createCinematicStage, loadWithRetry } from "./cinematic-loading";

describe("cinematic stage attempts", () => {
  it("renders 3D after retrying a previously rejected stage download", async () => {
    const failure = new Error("stage download interrupted");
    let online = false;
    const restoredModule = {
      CinematicStage3D: memo(() => createElement("span", null, "Restored 3D stage")),
    };
    const loader = async () => {
      if (!online) throw failure;
      return restoredModule;
    };
    const props = { art: "dressing" as const, primary: "#008800", secondary: "#ffffff" };

    const firstAttempt = createCinematicStage(loader);
    await expect(
      renderToReadableStream(createElement(firstAttempt, props), {
        onError: () => undefined,
      }),
    ).rejects.toBe(failure);

    online = true;
    const retry = createCinematicStage(loader);
    const stream = await renderToReadableStream(createElement(retry, props));
    await expect(new Response(stream).text()).resolves.toContain("Restored 3D stage");
  });
});

describe("loadWithRetry", () => {
  it("retries with bounded backoff and resolves after transient chunk failures", async () => {
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("primeira"))
      .mockRejectedValueOnce(new Error("segunda"))
      .mockResolvedValue("stage");
    const sleeps: number[] = [];

    await expect(
      loadWithRetry(importer, (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      }),
    ).resolves.toBe("stage");

    expect(importer).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([250, 750]);
  });

  it("clears the rejected attempt and exposes the final failure", async () => {
    const failure = new Error("chunk ausente");
    const importer = vi.fn<() => Promise<string>>().mockRejectedValue(failure);
    const sleeps: number[] = [];

    await expect(
      loadWithRetry(importer, (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      }),
    ).rejects.toBe(failure);

    expect(importer).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([250, 750, 2000]);
  });
});
