/** Bounds personal cloud saves before parsing their optional nested fields.
 * It validates the transport shape; it never attests gameplay progress. */
export function assertUntrustedJson(
  input: unknown,
  limits = { nodes: 250_000, characters: 8_000_000, depth: 32 },
): void {
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let characters = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > limits.nodes || depth > limits.depth)
      throw new Error("O arquivo da carreira excede o limite permitido.");
    if (typeof value === "string") characters += value.length;
    else if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("A carreira contém um número inválido.");
    } else if (value && typeof value === "object") {
      if (seen.has(value)) throw new Error("A carreira contém uma referência circular.");
      seen.add(value);
      const prototype = Object.getPrototypeOf(value);
      if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
        throw new Error("Formato de carreira inválido.");
      for (const key of Object.keys(value)) {
        if (key === "__proto__" || key === "prototype" || key === "constructor")
          throw new Error("A carreira contém uma chave inválida.");
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (!property || !Object.hasOwn(property, "value"))
          throw new Error("Formato de carreira inválido.");
        characters += key.length;
        pending.push({ value: property.value, depth: depth + 1 });
        if (pending.length + nodes > limits.nodes)
          throw new Error("O arquivo da carreira excede o limite permitido.");
      }
    } else if (value !== null && value !== undefined && typeof value !== "boolean")
      throw new Error("Formato de carreira inválido.");
    if (characters > limits.characters)
      throw new Error("O arquivo da carreira excede o limite permitido.");
  }
}

/** Keep accents, international scripts and emoji joiners; strip display
 * control characters that can impersonate another speaker or reverse copy. */
export function normalizePublicText(text: string): string {
  return text
    .normalize("NFC")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127 ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("")
    .trim();
}
export function hasVisibleText(text: string) {
  return /[\p{L}\p{N}\p{P}\p{S}]/u.test(text);
}
