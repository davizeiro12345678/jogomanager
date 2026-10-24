import { createHmac, timingSafeEqual } from "node:crypto";

export function signRequest(timestamp, body, key) {
  if (typeof key !== "string" || key.length < 32) throw new Error("weak_signing_key");
  return createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyRequest(timestamp, body, signature, key, now = Date.now()) {
  if (!/^\d{13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || Math.abs(now - issuedAt) > 30_000) return false;
  try {
    const expected = Buffer.from(signRequest(timestamp, body, key), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
