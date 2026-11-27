import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const posted = vi.fn();
let receive: (event: MessageEvent<unknown>) => void;

beforeAll(async () => {
  vi.stubGlobal("postMessage", posted);
  vi.stubGlobal("onmessage", undefined);
  await import("../../scripts/graphics-fixture.worker");
  const handler = Reflect.get(globalThis, "onmessage");
  if (typeof handler !== "function") throw new Error("Graphics fixture worker did not initialize");
  receive = (event) => {
    Reflect.apply(handler, globalThis, [event]);
  };
});
beforeEach(() => posted.mockClear());
afterAll(() => vi.unstubAllGlobals());

describe("graphics fixture rules propagation", () => {
  it("retains the original execution contract when revision is omitted", () => {
    receive({ data: { type: "init", manual: true, seed: "graphics-high-v1" } } as MessageEvent);
    expect(posted.mock.calls[0]?.[0].execution).toEqual({
      revision: 2,
      physics: "compat",
      perception: "compat",
    });
  });
  it("constructs revision 2 in the actual fixture worker", () => {
    receive({
      data: { type: "init", manual: true, seed: "graphics-broadcast-v1", rulesRevision: 2 },
    } as MessageEvent);
    expect(posted.mock.calls[0]?.[0].execution).toMatchObject({ rulesRevision: 2 });
    posted.mockClear();
    receive({ data: { type: "advance", ms: 100 } } as MessageEvent);
    expect(posted.mock.calls[0]?.[0].execution).toMatchObject({ rulesRevision: 2 });
  });
  it.each([0, 3, "2", null, NaN])(
    "rejects unsupported worker revision %s before publishing a sample",
    (rulesRevision) => {
      expect(() =>
        receive({ data: { type: "init", manual: true, rulesRevision } } as MessageEvent),
      ).toThrow(/rules revision/i);
      expect(posted).not.toHaveBeenCalled();
    },
  );
});
