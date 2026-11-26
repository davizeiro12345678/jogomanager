import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoomChat } from "./RoomChat";

const roomId = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";
const hooks = vi.hoisted(() => ({
  useEffect: vi.fn<(effect: () => () => void) => void>(),
  subscribe: vi.fn<(onStatus: (status: string) => void) => void>(),
  remove: vi.fn<() => Promise<void>>(),
}));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useEffect: hooks.useEffect,
}));
vi.mock("@/i18n/provider", () => ({ useT: () => ({ t: (key: string) => key, lang: "pt" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        or: () => query,
        in: () => query,
        maybeSingle: async () => ({
          data: { id: roomId, host_id: userId, guest_id: null, status: "open" },
        }),
      };
      return query;
    },
    realtime: { setAuth: async () => {} },
    channel: () => ({ on: () => ({ subscribe: hooks.subscribe }) }),
    removeChannel: hooks.remove,
  },
}));

describe("private chat subscription cleanup", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "unmount"])(
    "removes the channel once after %s even when unsubscribe emits CLOSED",
    async (reason) => {
      // Render the component with real React state/refs, then control effect timing.
      renderToString(createElement(RoomChat, { roomId, userId }));
      const cleanup = hooks.useEffect.mock.calls[0]![0]();
      await vi.waitFor(() => expect(hooks.subscribe).toHaveBeenCalledOnce());
      const notify = hooks.subscribe.mock.calls[0]![0];
      hooks.remove.mockImplementationOnce(async () => notify("CLOSED"));

      notify("SUBSCRIBED");
      if (reason === "unmount") cleanup();
      else notify(reason);
      notify("CLOSED");
      cleanup();
      expect(hooks.remove).toHaveBeenCalledOnce();
    },
  );
});
