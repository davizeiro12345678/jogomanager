import { describe, expect, it } from "vitest";

import { watchReducedMotion } from "./device";

describe("system reduced-motion preference", () => {
  it("notifies an open scene when the OS preference changes and unsubscribes cleanly", () => {
    const original = globalThis.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const query = {
      matches: false,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function")
          listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function")
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
    } as unknown as MediaQueryList;
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: () => query,
    });
    try {
      const changes: boolean[] = [];
      const unsubscribe = watchReducedMotion((value) => changes.push(value));
      for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
      expect(changes).toEqual([true]);
      unsubscribe();
      for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent);
      expect(changes).toEqual([true]);
    } finally {
      if (original)
        Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: original });
      else Reflect.deleteProperty(globalThis, "matchMedia");
    }
  });
});
