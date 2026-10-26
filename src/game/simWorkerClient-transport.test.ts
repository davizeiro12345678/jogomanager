import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { snapshotMatch } from "./live-match";
import { LiveSnapshotEncoder, type PackedLiveSnapshot } from "./live-transport";
import { createLiveMatchController } from "./simWorkerClient";

vi.mock("./match-execution", () => ({
  initializeMatchExecution: async (sim: MatchSim) => sim.executionContract(),
}));
type Posted = { id: number; type: string; buffer?: ArrayBuffer; session?: number; slot?: number };
class TestWorker {
  static instances: TestWorker[] = [];
  messages: Posted[] = [];
  listeners = new Set<(event: MessageEvent) => void>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  constructor(_url?: URL | string, _options?: WorkerOptions) {
    TestWorker.instances.push(this);
  }
  postMessage(message: Posted, _transfer?: Transferable[]) {
    this.messages.push(message);
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "message" && typeof listener === "function")
      this.listeners.add(listener as (event: MessageEvent) => void);
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "message" && typeof listener === "function")
      this.listeners.delete(listener as (event: MessageEvent) => void);
  }
  emit(data: unknown) {
    const event = { data } as MessageEvent;
    this.onmessage?.(event);
    for (const listener of [...this.listeners]) listener(event);
  }
}
const controllers: ReturnType<typeof createLiveMatchController>[] = [];
const matches: MatchSim[] = [];
function fixture() {
  const home = buildTeamSetup("fla"),
    away = buildTeamSetup("pal");
  const sim = new MatchSim(home, away, "transport-controller");
  matches.push(sim);
  const onError = vi.fn();
  const controller = createLiveMatchController({
    home,
    away,
    seed: "transport-controller",
    onSnapshot: vi.fn(),
    onFinished: vi.fn(),
    onError,
  });
  controllers.push(controller);
  const worker = TestWorker.instances.at(-1)!;
  const packet = (seq: number, bad = false): PackedLiveSnapshot => {
    const frame = new LiveSnapshotEncoder(91).encode(snapshotMatch(sim, seq))!;
    if (bad) frame.frame[0] = NaN;
    return frame;
  };
  const emit = (frame: PackedLiveSnapshot) =>
    worker.emit({ id: 1, ok: true, type: "packedSnapshot", snapshot: frame });
  return { controller, worker, packet, emit, onError };
}
beforeEach(() => {
  vi.useFakeTimers();
  TestWorker.instances = [];
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  for (const sim of matches.splice(0)) sim.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live controller transport recovery", () => {
  it("requests resync and recycles the first bad buffer without starting fallback", () => {
    const { controller, worker, packet, emit } = fixture();
    const bad = packet(1, true);
    emit(bad);
    expect(worker.messages.filter((message) => message.type === "resyncLive")).toHaveLength(1);
    expect(worker.messages.find((message) => message.type === "recycleLive")).toMatchObject({
      session: 91,
      slot: bad.slot,
      buffer: bad.frame.buffer,
    });
    expect(controller.isWorker).toBe(true);
    expect(worker.terminate).not.toHaveBeenCalled();
  });
  it("starts fallback only after three consecutive invalid packets and terminates once", () => {
    const { controller, worker, packet, emit } = fixture();
    emit(packet(1, true));
    emit(packet(2, true));
    expect(controller.isWorker).toBe(true);
    emit(packet(3, true));
    expect(controller.isWorker).toBe(false);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    emit(packet(4, true));
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.messages.filter((message) => message.type === "resyncLive")).toHaveLength(2);
  });
  it("resets the failure streak after a valid packet", () => {
    const { controller, worker, packet, emit } = fixture();
    emit(packet(1, true));
    emit(packet(2, true));
    emit(packet(3));
    expect(controller.view.players).toHaveLength(22);
    emit(packet(4, true));
    emit(packet(5, true));
    expect(controller.isWorker).toBe(true);
    expect(worker.terminate).not.toHaveBeenCalled();
    emit(packet(6, true));
    expect(controller.isWorker).toBe(false);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it("does not settle a pending tactical request with a resync acknowledgement", () => {
    const { controller, worker, packet, emit } = fixture();
    const before = structuredClone(controller.view.home.tactics);
    controller.setTactics("home", { ...before, mentality: 3 });
    const tactics = worker.messages.at(-1)!;
    expect(tactics.type).toBe("tacticsLive");
    expect(worker.listeners.size).toBe(1);
    emit(packet(1, true));
    const resync = worker.messages.find((message) => message.type === "resyncLive")!;
    expect(resync.id).not.toBe(tactics.id);
    worker.emit({ id: resync.id, ok: true, type: "command", result: true });
    expect(worker.listeners.size).toBe(1);
    worker.emit({ id: tactics.id, ok: false, code: "queue-full", error: "Fila cheia" });
    expect(worker.listeners.size).toBe(0);
    expect(controller.view.home.tactics).toEqual(before);
    expect(controller.isWorker).toBe(true);
  });
});
