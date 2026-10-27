import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { CONTENT_UPDATED, SiteFooter } from "../components/SiteFooter";

function findTime(node: unknown): ReactElement<{ dateTime: string; children: string }> | undefined {
  if (Array.isArray(node)) return node.map(findTime).find(Boolean);
  if (!isValidElement<{ children?: unknown }>(node)) return undefined;
  if (node.type === "time") return node as ReactElement<{ dateTime: string; children: string }>;
  return findTime(node.props.children);
}
afterEach(() => vi.restoreAllMocks());
it("renders the exact fixed editorial date without constructing an Intl formatter on hydration or rerender", () => {
  const expected = new Date(`${CONTENT_UPDATED}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const formatter = vi.spyOn(Date.prototype, "toLocaleDateString");
  for (const path of ["/", "/guias", "/melhores-formacoes"]) {
    const time = findTime(SiteFooter({ path }));
    expect(time?.props.dateTime).toBe(CONTENT_UPDATED);
    expect(time?.props.children).toBe(expected);
  }
  expect(formatter).not.toHaveBeenCalled();
});
