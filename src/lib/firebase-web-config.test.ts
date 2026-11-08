import { describe, expect, it } from "vitest";
import {
  resolveFirebaseConnectorConfig,
  sameFirebaseProjectIdentity,
  selectFirebaseWebConfig,
} from "./firebase-web-config";

describe("Firebase connector project identity", () => {
  it("derives the sender from the connected app instead of a different legacy project", () => {
    expect(
      resolveFirebaseConnectorConfig({ appId: "1:123456:web:example", projectId: " connected " })
        .messagingSenderId,
    ).toBe("123456");
  });

  it("does not invent identities for missing web configuration", () => {
    expect(resolveFirebaseConnectorConfig({})).toEqual({
      apiKey: "",
      projectId: "",
      appId: "",
      vapidPublicKey: "",
      messagingSenderId: "",
    });
  });

  it("falls back to a complete standalone project when the connector is partial", () => {
    expect(
      selectFirebaseWebConfig({
        connector: { projectId: "partial-project" },
        standalone: {
          apiKey: "standalone-key",
          projectId: "standalone-project",
          appId: "1:123456:web:standalone",
          vapidPublicKey: "standalone-vapid",
        },
      }),
    ).toEqual({
      source: "standalone",
      config: {
        apiKey: "standalone-key",
        projectId: "standalone-project",
        appId: "1:123456:web:standalone",
        vapidPublicKey: "standalone-vapid",
        messagingSenderId: "123456",
      },
    });
  });

  it("prefers a complete connector and never mixes another project's settings", () => {
    expect(
      selectFirebaseWebConfig({
        connector: {
          apiKey: "connector-key",
          projectId: "connector-project",
          appId: "1:654321:web:connector",
          vapidPublicKey: "connector-vapid",
        },
        standalone: {
          apiKey: "standalone-key",
          projectId: "standalone-project",
          appId: "1:123456:web:standalone",
          vapidPublicKey: "standalone-vapid",
        },
      }),
    ).toEqual({
      source: "connector",
      config: {
        apiKey: "connector-key",
        projectId: "connector-project",
        appId: "1:654321:web:connector",
        vapidPublicKey: "connector-vapid",
        messagingSenderId: "654321",
      },
    });
  });

  it("rejects a registered app whose Firebase identity differs from the requested project", () => {
    const expected = {
      apiKey: "project-key",
      projectId: "project-a",
      appId: "1:123456:web:app-a",
      messagingSenderId: "123456",
    };
    expect(sameFirebaseProjectIdentity(expected, expected)).toBe(true);
    expect(sameFirebaseProjectIdentity({ ...expected, apiKey: "other-key" }, expected)).toBe(false);
    expect(sameFirebaseProjectIdentity({ ...expected, projectId: "project-b" }, expected)).toBe(
      false,
    );
    expect(
      sameFirebaseProjectIdentity({ ...expected, messagingSenderId: "999999" }, expected),
    ).toBe(false);
  });
});
