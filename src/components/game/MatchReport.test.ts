import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { WorkerMatchView } from "@/game/live-match";
import { DEFAULT_QUICK_MATCH_LEAGUE } from "@/game/quick-match-catalog";
import { buildTeamSetup } from "@/game/quickMatch";
import { MatchReport } from "./MatchReport";

vi.mock("@/components/GuestCloudPrompt", () => ({
  GuestCloudPrompt: () => createElement("aside", { "aria-label": "Salvar carreira na nuvem" }),
}));
vi.mock("@/features/ads/AdZones", () => ({
  NativeSponsoredCard: () => null,
  CornerAd: () => null,
}));

function renderReport(options: { mode?: "quick" } = {}) {
  const homeId = DEFAULT_QUICK_MATCH_LEAGUE.clubs[0]!.id;
  const awayId = DEFAULT_QUICK_MATCH_LEAGUE.clubs[1]!.id;
  return renderToStaticMarkup(
    createElement(MatchReport, {
      sim: new WorkerMatchView(buildTeamSetup(homeId), buildTeamSetup(awayId)),
      homeId,
      awayId,
      mySide: "home",
      onFinish: vi.fn(),
      ...options,
    }),
  );
}

it("labels the quick match return destination and omits cloud career saving", () => {
  const report = renderReport({ mode: "quick" });
  expect(report).toContain("Fim de jogo");
  expect(report).toContain("Voltar à escolha de times");
  expect(report).not.toContain("Salvar carreira na nuvem");
});

it("retains the career destination and cloud saving for career matches", () => {
  const report = renderReport();
  expect(report).toContain("Voltar à central");
  expect(report).toContain("Salvar carreira na nuvem");
});
