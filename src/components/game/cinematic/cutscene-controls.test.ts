import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CutsceneDialogue } from "./CutsceneDialogue";
import { CutsceneSettings } from "./CutsceneSettings";

describe("cutscene controls", () => {
  it("renders the current dialogue, its accessible transcript, and choices", () => {
    const markup = renderToStaticMarkup(
      createElement(CutsceneDialogue, {
        speaker: "Capitão",
        fullText: "Vamos para o campo.",
        visibleText: "Vamos para",
        choices: [{ label: "Concordar", hint: "Apoie o capitão", response: [] }],
        selectedChoice: null,
        choiceLocked: true,
        onAdvance: vi.fn(),
        onChoose: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Diálogo da cena"');
    expect(markup).toContain("Capitão: Vamos para o campo.");
    expect(markup).toContain("Vamos para");
    expect(markup).toContain("Concordar");
    expect(markup).toContain("Apoie o capitão");
    expect(markup).toContain('disabled=""');
  });

  it("renders settings from controlled values and locks captions for choices", () => {
    const markup = renderToStaticMarkup(
      createElement(CutsceneSettings, {
        captions: false,
        pendingChoice: true,
        onToggleCaptions: vi.fn(),
        narrate: true,
        voiceEnabled: true,
        onToggleVoice: vi.fn(),
        ambientEnabled: false,
        onToggleAmbience: vi.fn(),
        automatic: false,
        onToggleAutomatic: vi.fn(),
        mode: "3d",
        onToggleMode: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Preferências da cena"');
    expect(markup).toContain("Mostrar legendas");
    expect(markup).toContain("Desligar voz");
    expect(markup).toContain("Som ambiente");
    expect(markup).toContain("Cena ilustrada");
    expect(markup).toContain('disabled=""');
  });
});
