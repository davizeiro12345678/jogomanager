import { expect, it } from "vitest";
import { formatMessage, resolveMessage } from "./format-message";

it("formats scene values including zero without changing unresolved placeholders", () => {
  expect(
    formatMessage("{title} · {count} falas · {missing}", { title: "Vestiário", count: 0 }),
  ).toBe("Vestiário · 0 falas · {missing}");
  expect(formatMessage("${done}/${total} metas · R$ 5 · ${missing}", { done: 0, total: 3 })).toBe(
    "0/3 metas · R$ 5 · ${missing}",
  );
});

it("ignores inherited values and preserves literal substitution characters", () => {
  expect(formatMessage("{constructor}: {value}", { value: "$& <jogador>" })).toBe(
    "{constructor}: $& <jogador>",
  );
});

it("resolves text with its real fallback locale without inherited dictionary values", () => {
  expect(
    resolveMessage("line", [
      { lang: "fr", messages: { other: "Autre" } },
      { lang: "en", messages: { line: "Text" } },
    ]),
  ).toEqual({ text: "Text", lang: "en" });
  expect(resolveMessage("__proto__", [{ lang: "en", messages: {} }])).toBeNull();
});
