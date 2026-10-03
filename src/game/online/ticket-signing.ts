import {
  parseMatchTicketV1,
  type MatchTicketV1,
} from "./match-protocol";
import { canonicalize } from "./session-hash";

export type UnsignedMatchTicketV1 = Omit<MatchTicketV1, "signature">;

const TICKET_SIGNING_DOMAIN = "pfm-match-ticket-v1";
const textEncoder = new TextEncoder();

function assertSigningSecret(secret: string): string {
  const normalized = secret.trim();
  // A short deployment value turns a cryptographic check into a configuration
  // accident. This also keeps test fixtures from silently masking an unset
  // production secret.
  if (normalized.length < 32) {
    throw new Error("MATCH_TICKET_SIGNING_SECRET must contain at least 32 characters");
  }
  return normalized;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("signature must be base64url");
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  // Allocate a fresh ArrayBuffer-backed view so Web Crypto never receives a
  // potentially SharedArrayBuffer-backed typed array.
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function ticketPayload(ticket: UnsignedMatchTicketV1): string {
  return canonicalize({
    domain: TICKET_SIGNING_DOMAIN,
    ticket: {
      version: ticket.version,
      roomId: ticket.roomId,
      userId: ticket.userId,
      seat: ticket.seat,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt,
      nonce: ticket.nonce,
    },
  });
}

async function importHmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto subtle API is required for match ticket signing");
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(assertSigningSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyPayload(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await importHmacKey(secret, ["verify"]);
    return await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      textEncoder.encode(payload),
    );
  } catch {
    // Authentication failures must not disclose whether a malformed signature,
    // key configuration or signed claim caused the rejection to a client.
    return false;
  }
}

/** Creates a short-lived HMAC ticket that binds a user to exactly one seat. */
export async function signMatchTicketV1(
  unsignedTicket: UnsignedMatchTicketV1,
  secret: string,
): Promise<MatchTicketV1> {
  const signature = await signPayload(ticketPayload(unsignedTicket), secret);
  return parseMatchTicketV1({ ...unsignedTicket, signature });
}

/** Verifies every ticket claim as part of the HMAC payload. */
export async function verifyMatchTicketV1(ticket: MatchTicketV1, secret: string): Promise<boolean> {
  const { signature, ...unsignedTicket } = ticket;
  return verifyPayload(ticketPayload(unsignedTicket), signature, secret);
}

/** Uses the Worker-safe CSPRNG; this value is never supplied by the browser. */
export function createMatchTicketNonce(byteLength = 24): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 128) {
    throw new RangeError("ticket nonce length must be between 16 and 128 bytes");
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto getRandomValues is required for match tickets");
  }
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
