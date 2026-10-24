import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscordLink } from "./DiscordLink";
import { DISCORD_INVITE } from "@/content/community";

describe("lightweight community link", () => {
  it("preserves the invitation, safe external navigation and default accessible label", () => {
    const html = renderToStaticMarkup(createElement(DiscordLink));
    expect(html).toContain(`href="${DISCORD_INVITE}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Entrar no Discord");
    expect(html).not.toContain("Troque ideias de futebol");
  });

  it("preserves custom labels and layout classes", () => {
    const html = renderToStaticMarkup(
      createElement(DiscordLink, { className: "custom" }, "Comunidade"),
    );
    expect(html).toContain("Comunidade");
    expect(html).toContain("custom");
  });
});
