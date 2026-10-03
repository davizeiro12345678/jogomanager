import type { MatchCommandV1 } from "./match-protocol";

export const SESSION_HASH_ALGORITHM = "SHA-256";
export const GENESIS_SESSION_HASH = "0".repeat(64);

export interface CommandHashLink {
  previousHash: string;
  hash: string;
}

/**
 * Serialize JSON data identically in browser, Node and Worker runtimes. A
 * command cannot get a different digest merely because object keys were added
 * in a different order by a client.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("canonical values must contain finite numbers");
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError("canonical values must be JSON-compatible");
    case "object":
      if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
        .join(",")}}`;
  }

  // `typeof` is exhaustive today, but retain a defensive throw so strict
  // TypeScript builds cannot silently widen this serializer's return contract.
  throw new TypeError("canonical values must be JSON-compatible");
}

function assertHash(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 hex digest`);
  }
}

async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto subtle.digest is required for session hashing");
  }
  const digest = await globalThis.crypto.subtle.digest(SESSION_HASH_ALGORITHM, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function appendCommandHash(
  previousHash: string,
  command: MatchCommandV1,
): Promise<CommandHashLink> {
  assertHash(previousHash, "previousHash");
  const hash = await sha256Hex(
    canonicalize({
      protocol: "match-command-v1",
      previousHash,
      command,
    }),
  );
  return { previousHash, hash };
}
