import { describe, expect, it } from "vitest";
import {
  CINEMATIC_SET_LOADERS,
  cacheCinematicSetLoader,
  resolveCinematicSetLoader,
  type CinematicSetLoader,
} from "./registry";
import type { CinematicSet } from "@/game/cinematic-blocking";
import type { CinematicSetProps } from "./types";
import type { ComponentType } from "react";

const setKeys: CinematicSet[] = [
  "locker",
  "tunnel",
  "press",
  "pitch",
  "stands",
  "office",
  "arrival",
];

function testLoaders() {
  const component: ComponentType<CinematicSetProps> = () => null;
  const calls = Object.fromEntries(setKeys.map((key) => [key, 0])) as Record<CinematicSet, number>;
  const loaders = Object.fromEntries(
    setKeys.map((key) => [
      key,
      async () => {
        calls[key] += 1;
        return { default: component };
      },
    ]),
  ) as unknown as Record<CinematicSet, CinematicSetLoader>;
  return { loaders, calls };
}

describe("cinematic set loader registry", () => {
  it("shares preloaded set imports and allows a failed import to be retried", async () => {
    let calls = 0;
    const cached = cacheCinematicSetLoader(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return { default: () => null };
    });
    const failed = cached();
    expect(cached()).toBe(failed);
    await expect(failed).rejects.toThrow("offline");
    const retry = cached();
    expect(cached()).toBe(retry);
    await retry;
    expect(calls).toBe(2);
  });
  it("registers every known cinematic set", () => {
    expect(Object.keys(CINEMATIC_SET_LOADERS)).toEqual(setKeys);
  });

  it("invokes only the selected set loader", async () => {
    const { loaders, calls } = testLoaders();
    const selected = resolveCinematicSetLoader("press", loaders);

    expect(selected).not.toBeNull();
    await selected?.();

    for (const key of setKeys) {
      expect(calls[key]).toBe(key === "press" ? 1 : 0);
    }
  });

  it("propagates a selected import failure and safely rejects unknown sets", async () => {
    const { loaders, calls } = testLoaders();
    const failure = new Error("scene chunk failed");
    loaders.arrival = async () => {
      calls.arrival += 1;
      throw failure;
    };

    await expect(resolveCinematicSetLoader("arrival", loaders)?.()).rejects.toBe(failure);
    expect(resolveCinematicSetLoader("unknown", loaders)).toBeNull();
    expect(calls.arrival).toBe(1);
  });
});
