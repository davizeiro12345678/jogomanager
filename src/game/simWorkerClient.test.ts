import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { snapshotMatch } from "./live-match";
import { createLiveMatchController } from "./simWorkerClient";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

type PostedMessage = { id: number; type: string };
type MessageListener = (event: MessageEvent) => void;

class TestWorker {
  static instances: TestWorker[] = [];
  readonly messages: PostedMessage[] = [];
  readonly listeners = new Set<MessageListener>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly terminate = vi.fn();
  readonly options: WorkerOptions | undefined;

  constructor(_url?: string | URL, options?: WorkerOptions) {
    this.options = options;
    TestWorker.instances.push(this);
  }

  postMessage(message: PostedMessage) {
    this.messages.push(message);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "message" && typeof listener === "function")
      this.listeners.add(listener as MessageListener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "message" && typeof listener === "function")
      this.listeners.delete(listener as MessageListener);
  }

  emitMessage(data: unknown) {
    const event = { data } as MessageEvent;
    this.onmessage?.(event);
    for (const listener of [...this.listeners]) listener(event);
  }
}

const controllers: Array<ReturnType<typeof createLiveMatchController>> = [];

function createController() {
  const controller = createLiveMatchController({
    home: buildTeamSetup("fla"),
    away: buildTeamSetup("pal"),
    seed: "worker-lifecycle-test",
    onSnapshot: () => undefined,
    onFinished: () => undefined,
  });
  controllers.push(controller);
  return { controller, worker: TestWorker.instances.at(-1)! };
}

beforeEach(() => {
  vi.useFakeTimers();
  TestWorker.instances = [];
  vi.stubGlobal("Worker", TestWorker);
});

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live match worker lifecycle", () => {
  it("keeps telemetry fully absent unless a caller opts in", () => {
    const { controller, worker } = createController();

    expect(worker.options).toEqual({ type: "module" });
    expect(worker.messages[0]).toMatchObject({ id: 1, type: "startLive" });
    expect(worker.messages[0]).not.toHaveProperty("telemetry");

    controller.dispose();
  });

  it("clears the response timeout as soon as a team-talk reply arrives", async () => {
    const { controller, worker } = createController();
    const result = controller.talk("home", "motivar");
    const request = worker.messages.at(-1)!;

    worker.emitMessage({ id: request.id, ok: true, type: "command", result: true });

    await expect(result).resolves.toBe(true);
    expect(worker.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });

  it("settles and releases a pending command immediately when its controller is disposed", async () => {
    const { controller, worker } = createController();
    const result = controller.talk("home", "motivar");
    let settled = false;
    void result.then(() => {
      settled = true;
    });

    controller.dispose();
    await Promise.resolve();

    expect(settled).toBe(true);
    expect(worker.listeners.size).toBe(0);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(result).resolves.toBe(false);
  });

  it("times out an unacknowledged command and removes its message listener", async () => {
    const { controller, worker } = createController();
    const result = controller.talk("home", "motivar");

    await vi.advanceTimersByTimeAsync(3000);

    await expect(result).resolves.toBe(false);
    expect(worker.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });

  it("clears the local fallback interval when the failed worker's controller is disposed", () => {
    const { controller, worker } = createController();

    worker.onerror?.({ message: "worker failed" } as ErrorEvent);

    expect(vi.getTimerCount()).toBe(1);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("collects opt-in bridge telemetry without changing the live snapshot payload", () => {
    const samples: Array<{
      source: string;
      kind: string;
      sequence: number;
      estimatedSerializedBytes: number;
      intervalMs: number | null;
      applyMs: number;
    }> = [];
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    const controller = createLiveMatchController({
      home,
      away,
      seed: "worker-telemetry-test",
      onSnapshot: () => undefined,
      onFinished: () => undefined,
      telemetry: { onSample: (sample) => samples.push(sample) },
    });
    controllers.push(controller);
    const worker = TestWorker.instances.at(-1)!;
    const sim = new MatchSim(home, away, "worker-telemetry-test");

    expect(worker.options).toMatchObject({
      type: "module",
      name: "stadium-live-match-telemetry",
    });
    expect(worker.messages[0]).toMatchObject({ id: 1, type: "startLive" });
    expect(worker.messages[0]).not.toHaveProperty("telemetry");

    worker.emitMessage({ id: 1, ok: true, type: "snapshot", snapshot: snapshotMatch(sim, 4) });
    vi.advanceTimersByTime(100);
    sim.step(1 / 30);
    worker.emitMessage({ id: 1, ok: true, type: "snapshot", snapshot: snapshotMatch(sim, 5) });

    expect(samples).toHaveLength(2);
    expect(samples[0]).toMatchObject({
      source: "worker",
      kind: "snapshot",
      sequence: 4,
      intervalMs: null,
    });
    expect(samples[0]?.estimatedSerializedBytes).toBeGreaterThan(0);
    expect(samples[0]?.applyMs).toBeGreaterThanOrEqual(0);
    expect(samples[1]?.intervalMs).not.toBeNull();
    expect(controller.view.time).toBe(sim.time);
  });
});
