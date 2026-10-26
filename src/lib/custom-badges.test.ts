import { afterEach, expect, it, vi } from "vitest";
import { badgeFor } from "../game/customStyle";
import { applyCustomToWorld, badgeFor as legacyBadgeFor, revertCustomWorld } from "./customData";
import { DEFAULT_WORLD, setActiveWorld } from "./world-scope";

afterEach(() => {
  revertCustomWorld();
  setActiveWorld(DEFAULT_WORLD);
  vi.unstubAllGlobals();
});
it("keeps the lightweight renderer on the same applied badge registry across saved campaigns", () => {
  const stored = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
  });
  const fixture = (badge: string) =>
    JSON.stringify({
      clubs: {
        fla: {
          id: "fla",
          name: "",
          short: "",
          primary: "",
          secondary: "",
          badge,
        },
      },
      players: [],
      competitions: [],
    });
  stored.set("manager3d.custom.v1::first", fixture("data:image/png;base64,AA=="));
  stored.set("manager3d.custom.v1::second", fixture("data:image/png;base64,AQ=="));
  setActiveWorld("first");
  applyCustomToWorld();
  expect(badgeFor("fla")).toBe("data:image/png;base64,AA==");
  expect(legacyBadgeFor("fla")).toBe(badgeFor("fla"));
  revertCustomWorld();
  expect(badgeFor("fla")).toBeUndefined();
  setActiveWorld("second");
  applyCustomToWorld();
  expect(badgeFor("fla")).toBe("data:image/png;base64,AQ==");
  expect(legacyBadgeFor("fla")).toBe(badgeFor("fla"));
});
