import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveWorkerRequest, LiveWorkerResponse } from "./live-match";
import { buildTeamSetup } from "./quickMatch";

vi.mock("./match-execution", () => ({
  initializeMatchExecution: async (sim: { executionContract: () => unknown }) =>
    sim.executionContract(),
}));
vi.mock("./rapier-ball-visual", () => ({ createRapierVisualPhysics: async () => null }));

type WorkerHarness = {
  name?: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
};

const worker: WorkerHarness = {
  onmessage: null,
  postMessage: vi.fn(),
};
vi.stubGlobal("self", worker);
await import("./match.worker");
const onmessage = worker.onmessage;

const flushMicrotasks = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

const responseMessages = (target: WorkerHarness) =>
  target.postMessage.mock.calls.map(([message]) => message as LiveWorkerResponse);
const responseType = (message: LiveWorkerResponse) =>
  "type" in message ? message.type : undefined;
const send = (message: LiveWorkerRequest) =>
  onmessage?.({ data: message } as MessageEvent<unknown>);

describe("match worker skip ordering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    worker.postMessage.mockClear();
    worker.onmessage = onmessage;
  });

  afterEach(async () => {
    send({ id: 99, type: "stopLive" });
    await flushMicrotasks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps pause, tactics and substitute behind the complete skip", async () => {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    const incoming = home.bench![0]!;
    const messages: LiveWorkerRequest[] = [
      { id: 1, type: "startLive", home, away, seed: "skip-order" },
      { id: 2, type: "skipLive" },
      { id: 3, type: "pauseLive", paused: true },
      {
        id: 4,
        type: "tacticsLive",
        side: "home",
        tactics: { ...home.tactics, mentality: 3 },
        expiresAt: Date.now() + 3_000,
      },
      {
        id: 5,
        type: "substituteLive",
        side: "home",
        outPid: home.players[1]!.id,
        incoming,
        expiresAt: Date.now() + 3_000,
      },
    ];
    for (const message of messages) send(message);
    await flushMicrotasks();

    expect(
      responseMessages(worker).some(
        (message) => message.id === 1 && responseType(message) === "ready",
      ),
    ).toBe(true);
    expect(responseMessages(worker).filter((message) => [3, 4, 5].includes(message.id))).toEqual(
      [],
    );

    await vi.runAllTimersAsync();
    await flushMicrotasks();

    const responses = responseMessages(worker).filter((message) =>
      [2, 3, 4, 5].includes(message.id),
    );
    expect(responses.map((message) => `${message.id}:${responseType(message)}`)).toEqual([
      "2:finished",
      "3:command",
      "4:snapshot",
      "4:command",
      "5:snapshot",
      "5:command",
    ]);
    expect(responses.filter((message) => responseType(message) === "command")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 3, ok: true }),
        expect.objectContaining({ id: 4, ok: true, result: true }),
        expect.objectContaining({ id: 5, ok: true, result: false }),
      ]),
    );
  });

  it("cancels the pending skip on stopLive without leaving a timer or queue wait", async () => {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    send({ id: 10, type: "startLive", home, away, seed: "skip-stop" });
    await flushMicrotasks();
    send({ id: 11, type: "skipLive" });
    send({ id: 12, type: "stopLive" });
    await flushMicrotasks();

    expect(responseMessages(worker)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 12, ok: true, type: "command" })]),
    );
    expect(responseMessages(worker)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 11, type: "finished" })]),
    );
    expect(vi.getTimerCount()).toBe(0);

    send({ id: 13, type: "pauseLive", paused: true });
    await flushMicrotasks();
    expect(responseMessages(worker)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 13, ok: true, type: "command" })]),
    );
  });
});
