import { signRequest } from "../signature.mjs";

try {
  const endpoint = new URL("/v1/readiness", process.env.MATCH_AUX_URL ?? "http://127.0.0.1:3090");
  if (
    endpoint.username ||
    endpoint.password ||
    (endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1"))
  )
    throw new Error("invalid_endpoint");
  const body = '{"probe":"readiness"}';
  const timestamp = String(Date.now());
  const signature = signRequest(timestamp, body, process.env.MATCH_AUX_SIGNING_KEY);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pfm-timestamp": timestamp,
      "x-pfm-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(3_000),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || typeof result.busy !== "boolean")
    throw new Error("unavailable");
  console.log(JSON.stringify({ ok: true, busy: result.busy }));
} catch {
  console.error("Auxiliary match readiness check failed");
  process.exitCode = 1;
}
