import { parseMatchReceiptV1, type MatchReceiptV1 } from "./match-protocol";
import type { MatchReceiptSigner } from "./authoritative-match-session";
import { canonicalize } from "./session-hash";

const encoder = new TextEncoder();
const SIGNATURE_DOMAIN = "pfm-authoritative-match-receipt-v1";

function requireSecret(secret: string): string {
  if (typeof secret !== "string" || secret.trim().length < 32)
    throw new Error("match receipt signing secret must be configured securely");
  return secret.trim();
}

function message(unsigned: Omit<MatchReceiptV1, "signature">): Uint8Array<ArrayBuffer> {
  return encoder.encode(canonicalize({ domain: SIGNATURE_DOMAIN, receipt: unsigned }));
}

async function key(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(requireSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(signature: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]{43,44}$/.test(signature)) throw new Error("invalid HMAC format");
  const raw = atob(
    signature.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (signature.length % 4)) % 4),
  );
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Server-only receipt; the signature covers the entire canonical result. */
export function createMatchReceiptSigner(secret: string): MatchReceiptSigner {
  const verified = requireSecret(secret);
  return {
    async sign(unsigned) {
      const cryptoKey = await key(verified, ["sign"]);
      const digest = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, message(unsigned));
      return encode(new Uint8Array(digest));
    },
  };
}

export async function verifySignedMatchReceipt(
  input: unknown,
  secret: string,
): Promise<boolean> {
  try {
    const receipt = parseMatchReceiptV1(input);
    const { signature, ...unsigned } = receipt;
    const cryptoKey = await key(secret, ["verify"]);
    return await globalThis.crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      decode(signature),
      message(unsigned),
    );
  } catch {
    return false;
  }
}
