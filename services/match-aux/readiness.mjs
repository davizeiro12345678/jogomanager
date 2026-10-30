import { verifyRequest } from "./signature.mjs";

// No database work before authentication and no provider data in the response.
export async function signedReadiness(body, timestamp, signature, key, ping, isBusy) {
  if (!verifyRequest(timestamp, body, signature, key))
    return { status: 401, body: { error: "unauthorized" } };
  if (body !== '{"probe":"readiness"}') return { status: 400, body: { error: "invalid_request" } };
  try {
    const response = await ping();
    if (response?.ok !== 1) throw new Error("ping_failed");
    return { status: 200, body: { ok: true, busy: isBusy() } };
  } catch {
    return { status: 503, body: { ok: false, busy: isBusy() } };
  }
}
