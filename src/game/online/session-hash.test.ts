import { describe, expect, it } from "vitest";

import { MATCH_PROTOCOL_VERSION, parseMatchCommandV1 } from "./match-protocol";
import { GENESIS_SESSION_HASH, appendCommandHash, canonicalize } from "./session-hash";

const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";

describe("session command hash chain", () => {
  it("canonicalizes object keys independently of insertion order", () => {
    expect(canonicalize({ b: 2, a: { z: true, x: [3, 1] } })).toBe(
      '{"a":{"x":[3,1],"z":true},"b":2}',
    );
  });

  it("is stable for the same command and previous hash", async () => {
    const command = parseMatchCommandV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      sequence: 1,
      kind: "ready",
      payload: { ready: true },
    });

    const first = await appendCommandHash(GENESIS_SESSION_HASH, command);
    const repeated = await appendCommandHash(GENESIS_SESSION_HASH, command);

    expect(first).toEqual(repeated);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the digest when a command changes and links the next command", async () => {
    const ready = parseMatchCommandV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      sequence: 1,
      kind: "ready",
      payload: { ready: true },
    });
    const tactics = parseMatchCommandV1({
      version: MATCH_PROTOCOL_VERSION,
      roomId,
      sequence: 2,
      kind: "set_tactics",
      payload: {
        formation: "4-3-3",
        mentality: "attacking",
        pressing: "high",
        width: "wide",
        tempo: "fast",
        lineHeight: "high",
      },
    });

    const first = await appendCommandHash(GENESIS_SESSION_HASH, ready);
    const next = await appendCommandHash(first.hash, tactics);
    const altered = await appendCommandHash(
      GENESIS_SESSION_HASH,
      parseMatchCommandV1({ ...ready, sequence: 3 }),
    );

    expect(next.previousHash).toBe(first.hash);
    expect(first.hash).not.toBe(altered.hash);
  });
});
