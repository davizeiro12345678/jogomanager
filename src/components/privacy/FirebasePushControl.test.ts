import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  disable: vi.fn().mockResolvedValue({ enabled: false, message: "Desativado" }),
  enable: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => undefined,
  useState: () => [state.values[state.index++], vi.fn()],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/firebase-config.functions", () => ({ getFirebaseWebConfig: vi.fn() }));
vi.mock("@/lib/firebase-push", () => ({
  disableFirebaseNotifications: state.disable,
  enableFirebaseNotifications: state.enable,
  hasFirebasePushDeviceToken: vi.fn(),
}));

import { FirebasePushControl } from "./FirebasePushControl";

function findButton(
  node: unknown,
): ReactElement<{ disabled: boolean; onClick: () => void }> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findButton(child);
      if (result) return result;
    }
    return null;
  }
  if (!isValidElement<{ children?: unknown }>(node)) return null;
  if (node.type === Button) return node as ReactElement<{ disabled: boolean; onClick: () => void }>;
  return findButton(node.props.children);
}

beforeEach(() => {
  state.index = 0;
  state.disable.mockClear();
  state.enable.mockClear();
});

describe("push control availability", () => {
  it("allows a signed-in user to revoke an existing subscription when Firebase config is unavailable", async () => {
    state.values = [false, true, true, false, ""];
    const button = findButton(FirebasePushControl());
    expect(button?.props.disabled).toBe(false);
    button?.props.onClick();
    await vi.waitFor(() => expect(state.disable).toHaveBeenCalledTimes(1));
  });

  it("keeps activation unavailable without Firebase config", () => {
    state.values = [false, true, false, false, ""];
    expect(findButton(FirebasePushControl())?.props.disabled).toBe(true);
  });
});
