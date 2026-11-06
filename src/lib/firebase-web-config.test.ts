import { describe, expect, it } from "vitest";
import { resolveFirebaseConnectorConfig } from "./firebase-web-config";

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
});
