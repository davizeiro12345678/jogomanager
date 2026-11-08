import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlayerCareerState } from "@/game/player-career/types";

vi.mock("@/game/player-career/engine", () => ({ seasonLength: () => 1 }));
vi.mock("@/game/player-career/objectives", () => ({
  seasonObjectives: () => [
    {
      id: "goals",
      title: "Marcar gols",
      complete: true,
      current: 1,
      target: 1,
      display: "1 de 1",
      detail: "Marque um gol.",
      consequence: "Aumenta a reputação.",
    },
    {
      id: "assists",
      title: "Dar assistências",
      complete: false,
      current: 0,
      target: 2,
      display: "0 de 2",
      detail: "Dê duas assistências.",
      consequence: "Aumenta a confiança.",
    },
  ],
}));

import { PlayerObjectives } from "./PlayerObjectives";

describe("PlayerObjectives accessible summary", () => {
  it("announces the actual completed and total objective counts", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerObjectives, { state: { retired: false } as PlayerCareerState }),
    );

    expect(html).toContain('aria-label="1 de 2 metas alcançadas"');
    expect(html).not.toContain('aria-label="{finished} de {objectives.length} metas alcançadas"');
  });
});
