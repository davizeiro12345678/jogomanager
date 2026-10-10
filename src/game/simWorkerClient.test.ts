import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { snapshotMatch } from "./live-match";
import { createLiveMatchController } from "./simWorkerClient";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";

// Backend loading is exercised separately with deadlines, traps and aborts.
// These controller tests inspect the lifecycle after initialization completes.
vi.mock("./match-execution", () => ({
  initializeMatchExecution: async (sim: MatchSim) => sim.executionContract(),
}));

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
  it("does not start a local fallback for invalid initial teams", () => {
    vi.stubGlobal("Worker", undefined);
    expect(() =>
      createLiveMatchController({
        home: {
          ...buildTeamSetup("fla"),
          tactics: { ...buildTeamSetup("fla").tactics, formation: "destroy" },
        } as never,
        away: buildTeamSetup("pal"),
        seed: "invalid",
        onSnapshot: vi.fn(),
        onFinished: vi.fn(),
      }),
    ).toThrow("inválido");
  });
  it("ignores malformed runtime controls before changing the view or posting", async () => {
    const { controller, worker } = createController();
    const before = structuredClone(controller.view.home.tactics);
    const messages = worker.messages.length;
    controller.setTactics("home", { ...before, pressing: Infinity });
    controller.setSpeed(NaN);
    controller.pause("false" as never);
    expect(await controller.talk("destroy" as never, "motivar")).toBe(false);
    expect(controller.view.home.tactics).toEqual(before);
    expect(worker.messages).toHaveLength(messages);
  });
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

  it("preserves the live worker and settles a control rejected by backpressure", async () => {
    const { controller, worker } = createController();
    const result = controller.talk("home", "motivar");
    const request = worker.messages.at(-1)!;
    worker.emitMessage({ id: request.id, ok: false, code: "queue-full", error: "Fila cheia" });
    await expect(result).resolves.toBe(false);
    expect(controller.isWorker).toBe(true);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(worker.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reapply a command reported as failed by the live worker", async () => {
    const { controller, worker } = createController();
    const result = controller.talk("home", "motivar");
    const request = worker.messages.at(-1)!;
    worker.emitMessage({
      id: request.id,
      ok: false,
      code: "command-failed",
      error: "Comando falhou",
    });
    await expect(result).resolves.toBe(false);
    expect(controller.isWorker).toBe(true);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rolls a rejected tactical change back to the last worker-confirmed tactics", async () => {
    const { controller, worker } = createController();
    const initial = { ...controller.view.home.tactics };
    const accepted = { ...initial, mentality: 3 };
    controller.setTactics("home", accepted);
    const first = worker.messages.at(-1)!;
    worker.emitMessage({ id: first.id, ok: true, type: "command", result: true });
    expect(controller.view.home.tactics).toEqual(accepted);
    controller.setTactics("home", { ...accepted, pressing: 2 });
    const rejected = worker.messages.at(-1)!;
    worker.emitMessage({ id: rejected.id, ok: false, code: "queue-full", error: "Fila cheia" });
    expect(controller.view.home.tactics).toEqual(accepted);
    expect(controller.isWorker).toBe(true);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(worker.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps earlier admitted tactics visible if a later command is refused", () => {
    const { controller, worker } = createController();
    const firstTactics = { ...controller.view.home.tactics, mentality: 3 };
    controller.setTactics("home", firstTactics);
    const first = worker.messages.at(-1)!;
    controller.setTactics("home", { ...firstTactics, pressing: 2 });
    const second = worker.messages.at(-1)!;
    worker.emitMessage({ id: second.id, ok: false, code: "queue-full", error: "Fila cheia" });
    expect(controller.view.home.tactics).toEqual(firstTactics);
    worker.emitMessage({ id: first.id, ok: true, type: "command", result: true });
    expect(controller.view.home.tactics).toEqual(firstTactics);
  });

  it("reconciles a late tactical acknowledgement without executing a second command", async () => {
    const { controller, worker } = createController();
    const initial = { ...controller.view.home.tactics };
    const tactics = { ...initial, mentality: 3 };
    controller.setTactics("home", tactics);
    const request = worker.messages.at(-1)!;
    await vi.advanceTimersByTimeAsync(3000);
    expect(controller.view.home.tactics).toEqual(initial);
    const posted = worker.messages.length;
    worker.emitMessage({ id: request.id, ok: true, type: "command", result: true });
    expect(controller.view.home.tactics).toEqual(tactics);
    expect(worker.messages).toHaveLength(posted);
  });

  it("restores confirmed tactics before creating fallback after a failed post", () => {
    const { controller, worker } = createController();
    const initial = { ...controller.view.home.tactics };
    vi.spyOn(worker, "postMessage").mockImplementationOnce(() => {
      throw new Error("post failed");
    });
    controller.setTactics("home", { ...initial, mentality: 3 });
    expect(controller.isWorker).toBe(false);
    expect(controller.view.home.tactics).toEqual(initial);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("bounds pending live command listeners without terminating admitted work", async () => {
    const { controller, worker } = createController();
    const results = Array.from({ length: 64 }, () => controller.talk("home", "motivar"));
    const posted = worker.messages.length;
    await expect(controller.talk("home", "motivar")).resolves.toBe(false);
    expect(worker.messages).toHaveLength(posted);
    expect(worker.listeners.size).toBe(64);
    controller.dispose();
    expect(await Promise.all(results)).toEqual(Array(64).fill(false));
    expect(worker.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
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

  it("clears the local fallback interval when the failed worker's controller is disposed", async () => {
    const { controller, worker } = createController();

    worker.onerror?.({ message: "worker failed" } as ErrorEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(1);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers confirmed substitutions and a team talk at time zero instead of restarting", async () => {
    const { controller, worker } = createController();
    const source = new MatchSim(
      structuredClone(controller.view.home),
      structuredClone(controller.view.away),
      "worker-lifecycle-test",
    );
    const restore = vi.spyOn(MatchSim.prototype, "restoreCheckpoint");
    try {
      const incoming = source.home.bench![0]!;
      const outgoing = source.home.players[1]!;
      expect(source.substitute("home", outgoing.id, incoming)).toBe(true);
      expect(source.applyTeamTalk("home", "motivar")).toBe(true);
      const checkpoint = source.checkpoint();
      const snapshot = {
        ...snapshotMatch(source, 2),
        recovery: { checkpointSeq: 1, ticks: [] },
      };
      expect(snapshot.time).toBe(0);
      worker.emitMessage({ id: 1, ok: true, type: "recovery", checkpointSeq: 1, checkpoint });
      worker.emitMessage({ id: 1, ok: true, type: "snapshot", snapshot });

      worker.onerror?.({ message: "worker failed before first tick" } as ErrorEvent);
      await Promise.resolve();
      await Promise.resolve();

      expect(restore).toHaveBeenCalledTimes(1);
      expect(restore).toHaveBeenCalledWith(checkpoint);
      expect(controller.view.time).toBe(0);
      expect(controller.view.subsUsed.home).toBe(1);
      expect(controller.view.players.some((player) => player.pid === incoming.id)).toBe(true);
      expect(controller.view.players.some((player) => player.pid === outgoing.id)).toBe(false);
      expect(controller.view.events).toEqual(source.events);
      expect(await controller.talk("home", "motivar")).toBe(false);
      expect(controller.isWorker).toBe(false);
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      restore.mockRestore();
      source.dispose();
    }
  });

  it("keeps a confirmed time-zero snapshot paused when its matching checkpoint is absent", () => {
    const { controller, worker } = createController();
    const source = new MatchSim(
      structuredClone(controller.view.home),
      structuredClone(controller.view.away),
      "worker-lifecycle-test",
    );
    try {
      const snapshot = {
        ...snapshotMatch(source, 1),
        recovery: { checkpointSeq: 9, ticks: [] },
      };
      worker.emitMessage({ id: 1, ok: true, type: "snapshot", snapshot });
      worker.onerror?.({ message: "worker lost checkpoint" } as ErrorEvent);
      expect(controller.view.time).toBe(0);
      expect(controller.isWorker).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      source.dispose();
    }
  });

  it("sleeps while the fallback is paused and releases its simulation once", async () => {
    const dispose = vi.spyOn(MatchSim.prototype, "dispose");
    const { controller, worker } = createController();
    expect(dispose).toHaveBeenCalledTimes(1);
    worker.onerror?.({ message: "worker failed" } as ErrorEvent);
    await Promise.resolve();
    await Promise.resolve();
    controller.pause(true);
    expect(vi.getTimerCount()).toBe(0);
    controller.pause(false);
    expect(vi.getTimerCount()).toBe(1);
    controller.dispose();
    controller.dispose();
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    dispose.mockRestore();
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
