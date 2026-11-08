import { describe, expect, it } from "vitest";
import { isLocaleMessagePack, loadLocalePack } from "./locale-pack-loader";
import {
  LEGACY_PUBLISHED_LOCALES,
  LOCALE_RUNTIME_MANIFEST,
  RUNTIME_APPROVED_LOCALES,
  isRuntimeApprovedLocale,
} from "./locale-runtime-manifest";
import { registerLanguagePack, translate, translateRuntime } from "./messages";
import type { Lang } from "./locale-identifiers";

describe("runtime locale pack policy", () => {
  it("keeps the runtime allowlist explicit and excludes generated catalog locales", () => {
    expect(RUNTIME_APPROVED_LOCALES).toHaveLength(26);
    expect(LEGACY_PUBLISHED_LOCALES).toHaveLength(24);
    expect(RUNTIME_APPROVED_LOCALES).toContain("pt-BR");
    expect(RUNTIME_APPROVED_LOCALES).toContain("en");
    expect(isRuntimeApprovedLocale("es")).toBe(true);
    expect(isRuntimeApprovedLocale("af")).toBe(false);
    expect("af" in LOCALE_RUNTIME_MANIFEST).toBe(false);
  });

  it("loads an allowlisted legacy pack without using a public draft path", async () => {
    let attempts = 0;
    const pack = await loadLocalePack("es", {
      legacyLoader: async () => {
        attempts += 1;
        return { default: { "nav.panel": "Panel" } };
      },
    });
    expect(attempts).toBe(1);
    expect(pack).toEqual({ "nav.panel": "Panel" });
  });

  it("fails closed before a draft can reach the translator", async () => {
    let attempts = 0;
    await expect(
      loadLocalePack("af", {
        legacyLoader: async () => {
          attempts += 1;
          return { default: { "nav.panel": "Draft" } };
        },
      }),
    ).rejects.toThrow("not approved");
    expect(attempts).toBe(0);

    const before = translateRuntime("af", "nav.panel");
    registerLanguagePack("af" as Lang, { "nav.panel": "Draft" });
    expect(translateRuntime("af", "nav.panel")).toBe(translate("en", "nav.panel"));
    expect(translateRuntime("af", "nav.panel")).toBe(before);
  });

  it("rejects bootstrap locales as pack requests", async () => {
    await expect(loadLocalePack("en")).rejects.toThrow("no runtime pack");
    await expect(loadLocalePack("pt-BR")).rejects.toThrow("no runtime pack");
  });

  it.each([null, [], {}, { "nav.panel": " " }, { "": "value" }])(
    "rejects invalid message maps",
    async (payload) => {
      await expect(
        loadLocalePack("es", {
          legacyLoader: async () => ({ default: payload }),
        }),
      ).rejects.toThrow("invalid message map");
    },
  );

  it("accepts only non-empty string values", () => {
    expect(isLocaleMessagePack({ "nav.panel": "Panel" })).toBe(true);
    expect(isLocaleMessagePack({ "nav.panel": "" })).toBe(false);
    expect(isLocaleMessagePack({ "nav.panel": 3 })).toBe(false);
  });
});
