import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ConsentBanner } from "./ConsentBanner";
import { runInNewContext } from "node:vm";
import { CONSENT_VISIBILITY_SCRIPT } from "@/lib/consent";

it("renders the initial consent question before downloading or hydrating JavaScript", () => {
  const html = renderToStaticMarkup(createElement(ConsentBanner));
  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-label="Privacidade"');
  expect(html).toContain("Só o essencial");
  expect(html).toContain("Aceitar");
});

it.each([null, "broken json", "{}", '{"decidedAt":null}', '{"decidedAt":12}'])(
  "keeps the question visible for missing or invalid decisions: %s",
  (stored) => {
    const styles: unknown[] = [];
    runInNewContext(CONSENT_VISIBILITY_SCRIPT, {
      localStorage: { getItem: () => stored },
      document: {
        readyState: "loading",
        createElement: () => ({}),
        head: { appendChild: (element: unknown) => styles.push(element) },
      },
    });
    expect(styles).toHaveLength(0);
  },
);

it.each([false, true])(
  "hides a prior decision before paint without changing analytics=%s",
  (analytics) => {
    const stored = JSON.stringify({
      analytics,
      telemetry: analytics,
      decidedAt: "2026-10-20T00:00:00Z",
    });
    const styles: { nonce?: string; textContent?: string }[] = [];
    runInNewContext(CONSENT_VISIBILITY_SCRIPT, {
      localStorage: { getItem: () => stored },
      document: {
        readyState: "loading",
        currentScript: { nonce: "page-nonce" },
        createElement: () => ({}),
        head: { appendChild: (element: (typeof styles)[number]) => styles.push(element) },
      },
    });
    expect(styles).toHaveLength(1);
    expect(styles[0]?.nonce).toBe("page-nonce");
    expect(styles[0]?.textContent).toContain("[data-pfm-consent-banner]");
    expect(styles[0]?.textContent).toContain("display:none");
  },
);

it.each(["interactive", "complete"])(
  "does not recreate the bootstrap when head scripts run after hydration: %s",
  (readyState) => {
    const styles: unknown[] = [];
    runInNewContext(CONSENT_VISIBILITY_SCRIPT, {
      localStorage: { getItem: () => '{"decidedAt":"2026-10-20T00:00:00Z"}' },
      document: {
        readyState,
        createElement: () => ({}),
        head: { appendChild: (element: unknown) => styles.push(element) },
      },
    });
    expect(styles).toHaveLength(0);
  },
);
