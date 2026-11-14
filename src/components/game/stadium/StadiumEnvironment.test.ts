import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TimeOfDay, Weather } from "@/game/matchday";
import { StadiumEnvironment } from "./StadiumEnvironment";

const observed = vi.hoisted(() => ({
  environments: [] as { resolution: number; frames: number }[],
  backgrounds: [] as unknown[],
  lights: [] as Record<string, unknown>[],
}));

vi.mock("@react-three/drei", () => ({
  Environment: ({
    children,
    ...props
  }: {
    children: ReactNode;
    resolution: number;
    frames: number;
  }) => {
    observed.environments.push(props);
    return Children.toArray(children).filter((child) => {
      if (isValidElement(child) && child.type === "color") {
        observed.backgrounds.push(child.props);
        return false;
      }
      return true;
    });
  },
  Lightformer: (props: Record<string, unknown>) => {
    observed.lights.push(props);
    return null;
  },
}));

beforeEach(() => {
  observed.environments.length = 0;
  observed.backgrounds.length = 0;
  observed.lights.length = 0;
});

describe("stadium environment capture", () => {
  it("uses React's memo boundary for its primitive lighting inputs", () => {
    expect(StadiumEnvironment).toMatchObject({
      $$typeof: Symbol.for("react.memo"),
      compare: null,
    });
  });

  it.each([
    ["dia", "seco", "alta", 1, 384, "#8fbfe8", "#fff6e0", 2.1, 1.2, "#d5e3ef"],
    ["dia", "molhado", "media", 1, 192, "#8fbfe8", "#fff6e0", 1.75, 1.2, "#d5e3ef"],
    ["dia", "chuva", "alta", 0.75, 288, "#708895", "#e4edf3", 1.55, 1.2, "#d5e3ef"],
    ["dia", "neve", "media", 0.5, 96, "#9aa8b4", "#e4edf3", 1.55, 1.2, "#d5e3ef"],
    ["entardecer", "seco", "alta", 1, 384, "#4a3630", "#ffc79a", 1.45, 1.2, "#ff9b5c"],
    ["entardecer", "molhado", "media", 1, 192, "#4a3630", "#ffc79a", 1.45, 1.2, "#ff9b5c"],
    ["entardecer", "chuva", "alta", 1, 384, "#56616c", "#e4edf3", 1.55, 1.2, "#d5e3ef"],
    ["entardecer", "neve", "media", 1, 192, "#56616c", "#e4edf3", 1.55, 1.2, "#d5e3ef"],
    ["noite", "seco", "alta", 1, 384, "#060a10", "#e4ecff", 1.45, 2.4, "#d5e3ef"],
    ["noite", "molhado", "media", 1, 192, "#060a10", "#e4ecff", 1.45, 2.4, "#d5e3ef"],
    ["noite", "chuva", "alta", 1, 384, "#080f16", "#e4ecff", 1.45, 2.4, "#d5e3ef"],
    ["noite", "neve", "media", 1, 192, "#080f16", "#e4ecff", 1.45, 2.4, "#d5e3ef"],
  ] as const)(
    "preserves the %s/%s/%s lighting contract at texture scale %s",
    (time, weather, quality, textureScale, resolution, sky, key, intensity, fill, rim) => {
      renderToStaticMarkup(
        createElement(StadiumEnvironment, { time, weather, quality, textureScale }),
      );
      expect(observed.environments).toEqual([{ resolution, frames: 1 }]);
      expect(observed.backgrounds).toEqual([{ attach: "background", args: [sky] }]);
      expect(observed.lights).toEqual([
        {
          intensity,
          color: key,
          position: [0, 24, 0],
          rotation: [Math.PI / 2, 0, 0],
          scale: [60, 60, 1],
        },
        {
          intensity: fill,
          color: "#dceaff",
          position: [-30, 14, 0],
          "rotation-y": Math.PI / 2,
          scale: [60, 8, 1],
        },
        {
          intensity: fill,
          color: "#dceaff",
          position: [30, 14, 0],
          "rotation-y": -Math.PI / 2,
          scale: [60, 8, 1],
        },
        { intensity: 0.8, color: rim, position: [0, 6, -40], scale: [60, 8, 1] },
      ]);
    },
  );

  it("leaves low quality without an IBL capture", () => {
    for (const time of ["dia", "entardecer", "noite"] satisfies TimeOfDay[])
      for (const weather of ["seco", "molhado", "chuva", "neve"] satisfies Weather[])
        renderToStaticMarkup(
          createElement(StadiumEnvironment, { time, weather, quality: "baixa", textureScale: 1 }),
        );
    expect(observed.environments).toEqual([]);
    expect(observed.lights).toEqual([]);
  });
});
