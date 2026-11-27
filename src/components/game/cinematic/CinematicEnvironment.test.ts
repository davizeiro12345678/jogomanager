import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CinematicEnvironment } from "./CinematicEnvironment";

const observed = vi.hoisted(() => ({
  environments: [] as { resolution: number; frames: number }[],
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
    return children;
  },
  Lightformer: (props: Record<string, unknown>) => {
    observed.lights.push(props);
    return null;
  },
}));

beforeEach(() => {
  observed.environments.length = 0;
  observed.lights.length = 0;
});

describe("cinematic environment capture", () => {
  it("uses a memo boundary without freezing actual colour changes", () => {
    expect(CinematicEnvironment).toMatchObject({
      $$typeof: Symbol.for("react.memo"),
      compare: null,
    });
  });

  it.each(["alta", "media"] as const)(
    "preserves the three original lightformers for %s and each authored colour",
    (quality) => {
      // Neutral mood colours followed by the five authored line tints.
      const colours = [
        "#fff3e1",
        "#d8e3fa",
        "#eef2f7",
        "#effff4",
        "#ffe3c0",
        "#c3d9ff",
        "#d8c9ff",
        "#fff3d6",
      ];
      for (const warm of colours) {
        observed.environments.length = 0;
        observed.lights.length = 0;
        renderToStaticMarkup(createElement(CinematicEnvironment, { quality, warm }));
        expect(observed.environments).toEqual([
          { resolution: quality === "alta" ? 96 : 64, frames: 1 },
        ]);
        expect(observed.lights).toEqual([
          { position: [0, 6, 2], scale: [10, 3, 1], intensity: 2.2, color: warm },
          { position: [-6, 3, -4], scale: [6, 4, 1], intensity: 1.1, color: "#d6e5f4" },
          { position: [6, 3, -4], scale: [6, 4, 1], intensity: 0.8, color: "#e6dfd3" },
        ]);
      }
    },
  );

  it("does not allocate an environment at low quality", () => {
    renderToStaticMarkup(
      createElement(CinematicEnvironment, { quality: "baixa", warm: "#eef2f7" }),
    );
    expect(observed.environments).toEqual([]);
    expect(observed.lights).toEqual([]);
  });
});
