import { z } from "zod";
import { assertSafeJsonValue } from "./import-validation";

// Normalize manager names without letting control characters reach persisted data.
const normalizePublicText = (value: string) =>
  [...value.normalize("NFKC")]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
const hasVisibleText = (value: string) => /[\p{L}\p{N}]/u.test(value);

// Career JSON is untrusted even for authenticated users: bound its size and
// depth and reject dangerous object keys before the Zod schema passes it on.
function assertUntrustedJson(value: unknown): void {
  let count = 0;
  const seen = new WeakSet<object>();
  const visit = (node: unknown, depth: number): void => {
    if (++count > 100_000 || depth > 48) throw new Error("Carreira excede os limites permitidos.");
    if (node === null || typeof node === "string" || typeof node === "boolean") return;
    if (typeof node === "number" && Number.isFinite(node)) return;
    if (typeof node !== "object" || seen.has(node)) throw new Error("JSON de carreira inválido.");
    seen.add(node);
    if (Array.isArray(node)) {
      if (node.length > 5000) throw new Error("Carreira excede os limites permitidos.");
      node.forEach((child) => visit(child, depth + 1));
    } else {
      const keys = Object.keys(node);
      if (keys.length > 1000) throw new Error("Carreira excede os limites permitidos.");
      for (const key of keys) {
        if (key === "__proto__" || key === "prototype" || key === "constructor")
          throw new Error("JSON de carreira inválido.");
        visit((node as Record<string, unknown>)[key], depth + 1);
      }
    }
  };
  visit(value, 0);
}

/** IndexedDB retains explicitly undefined optional fields, while JSON omits
 * them. Match JSON serialization before checking an offline career payload;
 * never turn array holes, non-JSON values or unsafe object shapes into data. */
function normalizeUndefinedProperties(input: unknown): unknown {
  const seen = new WeakSet<object>();
  let count = 0;
  const visit = (value: unknown, depth: number): unknown => {
    if (++count > 100_000 || depth > 32) throw new Error("Carreira excede os limites permitidos.");
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("JSON de carreira inválido.");
    seen.add(value);
    if (Array.isArray(value)) return value.map((entry) => visit(entry, depth + 1));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("JSON de carreira inválido.");
    const clean: Record<string, unknown> = Object.create(null);
    for (const [key, entry] of Object.entries(value)) {
      if (++count > 100_000) throw new Error("Carreira excede os limites permitidos.");
      if (entry !== undefined) clean[key] = visit(entry, depth + 1);
    }
    return clean;
  };
  return visit(input, 0);
}

const CareerInput = z.object({
  state: z
    .object({
      leagueId: z.string().min(1).max(80),
      clubId: z.string().min(1).max(80),
      managerName: z
        .string()
        .transform(normalizePublicText)
        .pipe(z.string().min(1).max(80))
        .refine(hasVisibleText),
      season: z.number().int().min(1).max(100),
      round: z.number().int().min(1).max(1000),
      fixtures: z.array(z.unknown()).max(5000),
      results: z.array(z.unknown()).max(5000),
    })
    .passthrough(),
});

export function parseCareerInput(input: unknown) {
  const normalized = normalizeUndefinedProperties(input);
  assertSafeJsonValue(normalized);
  assertUntrustedJson(normalized);
  return CareerInput.parse(normalized);
}

const CareerOwner = z.object({ expectedOwnerId: z.string().uuid() });

export function parseCareerOwner(input: unknown) {
  return CareerOwner.parse(input);
}

export function parseCareerSaveRequest(input: unknown) {
  return { ...parseCareerInput(input), ...parseCareerOwner(input) };
}
