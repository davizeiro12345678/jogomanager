import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps, ReactElement } from "react";

// Exercise the ready renderer's actual React element wiring without a GPU.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useMemo: <T>(factory: () => T) => factory(),
    useCallback: <T>(callback: T) => callback,
    useRef: <T>(value: T) => ({ current: value }),
    useEffect: () => undefined,
    useState: <T>(initial: T | (() => T)) => {
      const value = typeof initial === "function" ? (initial as () => T)() : initial;
      return [(value === null ? "webgl2" : value) as T, () => undefined];
    },
  };
});
vi.mock("./visual-settings", async (original) => {
  const actual = await original<typeof import("./visual-settings")>();
  return {
    ...actual,
    useResolvedVisual: () => ({ ...actual.DEFAULT_VISUAL, quality: "auto", showFps: false }),
  };
});

import { Canvas } from "@react-three/fiber";
import { MobileFramebufferBudget } from "../components/game/MobileFramebufferBudget";
import { Stadium3D } from "../components/game/Stadium3D";
import { MatchSim } from "./sim";
import { GRAPHICS_PROFILES } from "./contracts/graphics-profile";
import { benchmarkTeam } from "../../scripts/graphics-fixture";

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props["children"])];
}
afterEach(() => vi.unstubAllGlobals());
it.each(["baixa", "media"] as const)(
  "shares explicit benchmark DPR between Canvas and mobile governor in %s",
  (quality) => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal("navigator", { hardwareConcurrency: 4, deviceMemory: 3 });
    const sim = new MatchSim(benchmarkTeam("fla"), benchmarkTeam("pal"), "dpr-integration");
    const render = (
      Stadium3D as unknown as { type: (props: ComponentProps<typeof Stadium3D>) => ReactElement }
    ).type;
    const tree = elements(render({ sim, quality, mode: "broadcast", pixelRatio: 1 }));
    const canvas = tree.find((element) => element.type === Canvas)!,
      budget = tree.find((element) => element.type === MobileFramebufferBudget)!;
    expect(canvas, "ready Canvas").toBeDefined();
    expect(budget, "mobile framebuffer governor").toBeDefined();
    expect(canvas.props["dpr"]).toBe(Math.min(1, GRAPHICS_PROFILES[quality].maxPixelRatio));
    expect(budget.props["requested"]).toBe(canvas.props["dpr"]);
  },
);
