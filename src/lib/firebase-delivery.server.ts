/** Server-only FCM HTTP v1 delivery. Credentials and device tokens must not be logged. */
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encoded(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseAccount(raw: string, projectId: string): ServiceAccount {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("FCM account unavailable");
  const account = value as Partial<ServiceAccount>;
  if (
    account.project_id !== projectId ||
    typeof account.client_email !== "string" ||
    !account.client_email.endsWith(".gserviceaccount.com") ||
    typeof account.private_key !== "string" ||
    !account.private_key.startsWith("-----BEGIN PRIVATE KEY-----")
  )
    throw new Error("FCM account unavailable");
  return account as ServiceAccount;
}

export async function sendFirebaseTestPush(options: {
  projectId: string;
  serviceAccountJson: string;
  deviceToken: string;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<void> {
  const { projectId, deviceToken } = options;
  if (
    !/^[a-z0-9][a-z0-9-]{3,61}[a-z0-9]$/.test(projectId) ||
    !deviceToken ||
    deviceToken.length > 4096
  )
    throw new Error("FCM configuration unavailable");
  const account = parseAccount(options.serviceAccountJson, projectId);
  const pem = account.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    "",
  );
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const unsigned = `${encoded({ alg: "RS256", typ: "JWT" })}.${encoded({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const request = options.fetcher ?? fetch;
  const oauth = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!oauth.ok) throw new Error("FCM authorization unavailable");
  const oauthData: unknown = await oauth.json();
  const accessToken = (oauthData as { access_token?: unknown })?.access_token;
  if (typeof accessToken !== "string" || !accessToken)
    throw new Error("FCM authorization unavailable");
  const result = await request(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          data: {
            title: "Pro Football Manager 3D",
            body: "As notificações deste aparelho estão funcionando.",
            url: "/",
            eventId: "push-test",
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!result.ok) throw new Error("FCM delivery unavailable");
}
