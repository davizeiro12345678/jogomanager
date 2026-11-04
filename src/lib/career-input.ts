import { z } from "zod";

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
  let characters = 0;
  const seen = new WeakSet<object>();
  const visit = (node: unknown, depth: number): void => {
    if (++count > 100_000 || depth > 48) throw new Error("Carreira excede os limites permitidos.");
    if (typeof node === "string") {
      characters += node.length;
      if (characters > 8_000_000) throw new Error("Carreira excede os limites permitidos.");
      return;
    }
    if (node === null || typeof node === "boolean") return;
    if (typeof node === "number" && Number.isFinite(node)) return;
    if (typeof node !== "object" || seen.has(node)) throw new Error("JSON de carreira inválido.");
    seen.add(node);
    const isArray = Array.isArray(node);
    if (
      !isArray &&
      Object.getPrototypeOf(node) !== Object.prototype &&
      Object.getPrototypeOf(node) !== null
    )
      throw new Error("JSON de carreira inválido.");
    if (isArray && node.length > 5000) throw new Error("Carreira excede os limites permitidos.");
    const keys = Object.keys(node);
    if (keys.length > (isArray ? 5000 : 1000))
      throw new Error("Carreira excede os limites permitidos.");
    for (const key of keys) {
      if (key === "__proto__" || key === "prototype" || key === "constructor")
        throw new Error("JSON de carreira inválido.");
      characters += key.length;
      if (characters > 8_000_000) throw new Error("Carreira excede os limites permitidos.");
      const property = Object.getOwnPropertyDescriptor(node, key);
      if (!property || !Object.hasOwn(property, "value"))
        throw new Error("JSON de carreira inválido.");
      visit(property.value, depth + 1);
    }
  };
  visit(value, 0);
}

const CareerInput = z.object({
  state: z
    .object({
      leagueId: z.string().min(1).max(80),
      clubId: z.string().min(1).max(80),
      managerName: z
        .string()
        .max(256)
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
  assertUntrustedJson(input);
  return CareerInput.parse(input);
}

const CareerOwner = z.object({ expectedOwnerId: z.string().uuid() });

export function parseCareerOwner(input: unknown) {
  return CareerOwner.parse(input);
}

export function parseCareerSaveRequest(input: unknown) {
  return { ...parseCareerInput(input), ...parseCareerOwner(input) };
}
