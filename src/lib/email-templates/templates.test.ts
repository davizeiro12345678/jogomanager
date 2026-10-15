import * as React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./registry";

describe("transactional email templates", () => {
  it("registers and renders every preview with Portuguese document metadata", async () => {
    expect(Object.keys(TEMPLATES)).toEqual([
      "welcome",
      "season-start",
      "career-milestone",
      "account-security",
      "signup",
    ]);
    for (const [name, entry] of Object.entries(TEMPLATES)) {
      expect(entry.previewData, name).toBeDefined();
      const html = await render(React.createElement(entry.component, entry.previewData as never));
      expect(html, name).toContain('lang="pt-BR"');
      expect(html, name).toContain("JOGO MANAGER");
      expect(html, name).toContain("https://jogomanager.com");
    }
  });
});
