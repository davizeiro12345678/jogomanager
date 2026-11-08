import { describe, expect, it } from "vitest";

import {
  getLiveRoomConnectionState,
  getRealtimeReconnectDelayMs,
  reconcileLiveRoomRevision,
} from "./multiplayer-connection";

describe("live multiplayer connection state", () => {
  it("keeps the presentation running while the realtime connection is available", () => {
    expect(getLiveRoomConnectionState(true)).toEqual({
      pausePresentation: false,
      notice: null,
    });
  });

  it("pauses only the local presentation while reconnecting", () => {
    expect(getLiveRoomConnectionState(false)).toEqual({
      pausePresentation: true,
      notice: {
        title: "Reconectando à sala",
        detail:
          "A apresentação foi pausada. Quando a conexão voltar, o placar oficial continuará vindo do servidor.",
      },
    });
  });

  it("does not treat an online browser as a subscribed Realtime socket", () => {
    expect(
      getLiveRoomConnectionState({
        browserOnline: true,
        realtimeStatus: "channel_error",
        reconnectAttempt: 2,
        appliedRevision: 12,
      }),
    ).toMatchObject({
      browserOnline: true,
      realtimeStatus: "channel_error",
      pausePresentation: true,
      reconnectAttempt: 2,
      reconnectDelayMs: 4_000,
      resyncFromRevision: null,
    });
  });

  it("resumes only after Realtime subscribes and asks for a revision resync", () => {
    expect(
      getLiveRoomConnectionState({
        browserOnline: true,
        realtimeStatus: "subscribed",
        reconnectAttempt: 2,
        appliedRevision: 12,
      }),
    ).toMatchObject({
      pausePresentation: false,
      notice: null,
      reconnectDelayMs: null,
      resyncFromRevision: 12,
    });
  });

  it("keeps reconnect backoff bounded and deterministic", () => {
    expect([0, 1, 2, 5, 99].map(getRealtimeReconnectDelayMs)).toEqual([
      1_000, 2_000, 4_000, 30_000, 30_000,
    ]);
  });

  it("accepts only newer server revisions and never moves the cursor backward", () => {
    expect(reconcileLiveRoomRevision(null, 4)).toEqual({
      accepted: true,
      appliedRevision: 4,
    });
    expect(reconcileLiveRoomRevision(4, 4)).toEqual({
      accepted: false,
      appliedRevision: 4,
    });
    expect(reconcileLiveRoomRevision(4, 3)).toEqual({
      accepted: false,
      appliedRevision: 4,
    });
    expect(reconcileLiveRoomRevision(4, 5)).toEqual({
      accepted: true,
      appliedRevision: 5,
    });
  });
});
