import * as React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./registry";
import { SignupEmail } from "./signup";
import { RecoveryEmail } from "./recovery";

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

  it("retains links in the plain-text version sent to email clients", async () => {
    for (const [name, entry] of Object.entries(TEMPLATES)) {
      const text = await render(React.createElement(entry.component, entry.previewData as never), {
        plainText: true,
      });
      expect(text, name).toContain("https://jogomanager.com");
      if (name === "signup")
        expect(text).toContain("https://jogomanager.com/confirm?token=preview");
    }
  });

  it("preserves encoded authentication links and escapes user-controlled text", async () => {
    const confirmationUrl = "https://jogomanager.com/confirm?token=a%2Bb&next=%2Fclube#finish";
    for (const element of [
      React.createElement(SignupEmail, {
        siteName: 'Clube <script>alert("x")</script> & João',
        siteUrl: "https://jogomanager.com",
        recipient: "joao@example.test",
        confirmationUrl,
      }),
      React.createElement(RecoveryEmail, { siteName: "João & Cia", confirmationUrl }),
    ]) {
      const html = await render(element);
      const text = await render(element, { plainText: true });
      expect(html).not.toContain('<script>alert("x")</script>');
      expect(html).toContain("token=a%2Bb&amp;next=%2Fclube#finish");
      expect(text).toContain(confirmationUrl);
      expect(text).toContain("João");
    }
  });
});
