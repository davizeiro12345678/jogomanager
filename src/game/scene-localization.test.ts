import { describe, expect, it } from "vitest";
import { CUTSCENES } from "@/content/cutscenes";
import { sceneText, sceneTitle } from "./scene-localization";
import { resolveMessage } from "@/i18n/format-message";

describe("localized cinematic copy", () => {
  it("keeps a custom scene and its choices intact even with a built-in ID", () => {
    const authored = CUTSCENES["arrival"]!;
    const custom = {
      ...authored,
      title: "Personal title",
      lines: [{ ...authored.lines[0]!, text: "Personal dialogue" }],
    };
    const t = () => "Translated built-in";
    expect(sceneText(custom, custom.lines[0], "en", t, () => "en").text).toBe("Personal dialogue");
    expect(sceneTitle(custom, "en", t)).toBe("Personal title");
    expect(sceneText(authored, authored.lines[0], "pt-BR", t, () => "en").text).toBe(
      authored.lines[0]!.text,
    );
  });
  it("uses the actual fallback language for speech and keeps untranslated content", () => {
    const scene = CUTSCENES["arrival"]!;
    const localized = sceneText(
      scene,
      scene.lines[0],
      "fr",
      () => "English text",
      () => "en",
    );
    expect(localized).toEqual({ text: "English text", lang: "en" });
    expect(
      sceneText(
        scene,
        scene.lines[0],
        "fr",
        (key) => key,
        () => "fr",
      ).lang,
    ).toBe("pt-BR");
    expect(
      resolveMessage("line", [
        { lang: "fr", messages: { other: "Autre" } },
        { lang: "en", messages: { line: "Text" } },
      ]),
    ).toEqual({ text: "Text", lang: "en" });
    expect(resolveMessage("__proto__", [{ lang: "en", messages: {} }])).toBeNull();
  });
});
