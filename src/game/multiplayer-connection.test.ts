import { describe, expect, it } from "vitest";

import { getLiveRoomConnectionState } from "./multiplayer-connection";

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
});
