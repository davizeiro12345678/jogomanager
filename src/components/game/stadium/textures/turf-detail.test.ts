import { afterEach, beforeEach, expect, it, vi } from "vitest";

type DetailResult = { bytes: Uint8Array; backend: string };
class TurfWorker {
  static instances: TurfWorker[] = [];
  onmessage: ((event: MessageEvent<DetailResult>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    TurfWorker.instances.push(this);
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
}

const releases: (() => void)[] = [];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.resetModules();
  TurfWorker.instances.length = 0;
  vi.stubGlobal("window", {});
  vi.stubGlobal("Worker", TurfWorker);
});
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  await flush();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function scene() {
  const lanes = await import("@/game/presentation-lanes");
  const pool = new lanes.PresentationLanePool(1);
  vi.spyOn(lanes, "acquirePresentationLanes").mockImplementation((count, signal) =>
    pool.acquire(count, signal),
  );
  const textures = await import("./turf-detail");
  const maps = textures.turfDetailTextures();
  const release = textures.retainTurfDetail();
  releases.push(release);
  return { ...textures, maps, pool, release };
}

it("keeps GPU storage dimensions fixed while neutral turf becomes detailed", async () => {
  const { maps } = await scene();
  const normal = maps.normal;
  const roughness = maps.roughness;
  for (const [map, neutral] of [
    [normal, [128, 128, 255, 255]],
    [roughness, [210, 210, 210, 255]],
  ] as const) {
    expect(map.image.width).toBe(512);
    expect(map.image.height).toBe(512);
    expect(map.image.data).toHaveLength(512 * 512 * 4);
    expect(map.image.data!.every((value, index) => value === neutral[index % 4])).toBe(true);
  }

  await flush();
  const worker = TurfWorker.instances[0]!;
  const length = 512 * 512 * 4;
  const bytes = new Uint8Array(length * 2).fill(255);
  bytes.set([122, 134, 253, 255]);
  bytes.set([199, 199, 199, 255], length);
  worker.onmessage?.(new MessageEvent("message", { data: { bytes, backend: "typescript" } }));

  expect(maps.normal).toBe(normal);
  expect(maps.roughness).toBe(roughness);
  for (const map of [normal, roughness]) {
    expect(map.image.width).toBe(512);
    expect(map.image.height).toBe(512);
  }
  expect(Array.from(normal.image.data!.slice(0, 4))).toEqual([122, 134, 253, 255]);
  expect(Array.from(roughness.image.data!.slice(0, 4))).toEqual([199, 199, 199, 255]);
  expect(worker.terminated).toBe(true);
});

it("retains shared turf until the last scene leaves and ignores the canceled result", async () => {
  const { maps, pool, release, retainTurfDetail, turfDetailTextures } = await scene();
  const otherScene = retainTurfDetail();
  releases.push(otherScene);
  await flush();
  const worker = TurfWorker.instances[0]!;
  const lateResult = worker.onmessage;
  const neutralData = maps.normal.image.data;

  release();
  await flush();
  expect(worker.terminated).toBe(false);
  expect(turfDetailTextures()).toBe(maps);

  otherScene();
  await flush();
  expect(worker.terminated).toBe(true);
  lateResult?.(
    new MessageEvent("message", {
      data: { bytes: new Uint8Array(512 * 512 * 8), backend: "typescript" },
    }),
  );
  expect(maps.normal.image.data).toBe(neutralData);
  const recoveredLane = await pool.acquire(1, new AbortController().signal, 50);
  expect(recoveredLane).not.toBeNull();
  recoveredLane?.();
});
