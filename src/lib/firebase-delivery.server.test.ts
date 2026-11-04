import { describe, expect, it, vi } from "vitest";
import { sendFirebaseTestPush } from "./firebase-delivery.server";

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function account() {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))}\n-----END PRIVATE KEY-----`;
  return {
    keys,
    json: JSON.stringify({
      project_id: "sscxz-2ee8d",
      client_email: "test@sscxz-2ee8d.iam.gserviceaccount.com",
      private_key: pem,
    }),
  };
}

describe("Firebase test delivery", () => {
  it("signs a scoped Google assertion and sends only the fixed test payload to the registered token", async () => {
    const { keys, json } = await account();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "oauth-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await sendFirebaseTestPush({
      projectId: "sscxz-2ee8d",
      serviceAccountJson: json,
      deviceToken: "device-token",
      fetcher,
      now: 1_800_000_000_000,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toBe("https://oauth2.googleapis.com/token");
    const assertion = (fetcher.mock.calls[0]![1].body as URLSearchParams).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    if (!header || !claims || !signature) throw new Error("Invalid test assertion");
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(header)))).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toMatchObject({
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        keys.publicKey,
        fromBase64Url(signature),
        new TextEncoder().encode(`${header}.${claims}`),
      ),
    ).toBe(true);
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://fcm.googleapis.com/v1/projects/sscxz-2ee8d/messages:send",
    );
    expect(fetcher.mock.calls[1]![1].headers.authorization).toBe("Bearer oauth-token");
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({
      message: {
        token: "device-token",
        data: {
          title: "Pro Football Manager 3D",
          body: "As notificações deste aparelho estão funcionando.",
          url: "/",
          eventId: "push-test",
        },
      },
    });
  });
  it("rejects credentials for another project before making any network request", async () => {
    const { json } = await account();
    const fetcher = vi.fn();
    await expect(
      sendFirebaseTestPush({
        projectId: "another-project",
        serviceAccountJson: json,
        deviceToken: "device-token",
        fetcher,
      }),
    ).rejects.toThrow("FCM account unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send a message if authorization fails", async () => {
    const { json } = await account();
    const fetcher = vi.fn().mockResolvedValue(new Response("secret response", { status: 401 }));
    await expect(
      sendFirebaseTestPush({
        projectId: "sscxz-2ee8d",
        serviceAccountJson: json,
        deviceToken: "device-token",
        fetcher,
      }),
    ).rejects.toThrow("FCM authorization unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
