/** JSON imported from another player is data, never an object-registry key. */
const RESERVED = new Set(["__proto__", "prototype", "constructor"]);
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export function safeRecordId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 120 &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value) &&
    !RESERVED.has(value)
  );
}

export function parseImportJson(text: string): unknown {
  if (
    text.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES
  )
    throw new Error("O pacote excede o limite de 4 MB.");
  const result: unknown = JSON.parse(text);
  assertSafeJsonValue(result);
  return result;
}

/** Bounds already decoded personal saves before serializing or persisting them. */
export function assertSafeJsonValue(result: unknown): void {
  const pending = [{ value: result, depth: 0 }];
  const seen = new WeakSet<object>();
  let count = 0;
  let bytes = 0;
  const encoder = new TextEncoder();
  const addText = (value: string) => {
    if (value.length > MAX_IMPORT_BYTES) throw new Error("O pacote excede o limite de 4 MB.");
    // JSON escaping may increase size; count its actual serialized representation.
    bytes += encoder.encode(JSON.stringify(value)).byteLength;
  };
  while (pending.length) {
    const entry = pending.pop()!;
    if (++count > 100_000 || entry.depth > 32) throw new Error("O pacote é complexo demais.");
    const value = entry.value;
    if (value && typeof value === "object") {
      if (seen.has(value)) throw new Error("O pacote contém referências inválidas.");
      seen.add(value);
      const array = Array.isArray(value);
      // Object.entries omits array holes, but JSON serialization emits null
      // for each one. Bound logical length before enumerating decoded input.
      if (array && value.length > 100_000) throw new Error("O pacote é complexo demais.");
      if (
        !array &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        throw new Error("O pacote contém um objeto inválido.");
      const entries = Object.entries(value);
      if (array && entries.length !== value.length)
        throw new Error("O pacote contém um valor inválido.");
      if (count + pending.length + entries.length > 100_000)
        throw new Error("O pacote é complexo demais.");
      bytes += 2 + Math.max(0, entries.length - 1);
      for (const [key, child] of entries) {
        if (RESERVED.has(key)) throw new Error("O pacote contém uma chave reservada.");
        if (!array) {
          addText(key);
          bytes += 1;
        }
        pending.push({ value: child, depth: entry.depth + 1 });
      }
    } else if (typeof value === "string") {
      addText(value);
    } else if (
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      bytes += String(value).length;
    } else {
      throw new Error("O pacote contém um valor inválido.");
    }
    if (bytes > MAX_IMPORT_BYTES) throw new Error("O pacote excede o limite de 4 MB.");
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export const textField = (value: unknown, max = 120): value is string =>
  typeof value === "string" && value.length <= max;
export const boundedNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
export const colorField = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);

/** Uploaded raster portraits remain supported; active SVG/HTML data is rejected. */
export function imageField(value: unknown): boolean {
  if (value === undefined || value === "") return true;
  if (!textField(value, 2 * 1024 * 1024)) return false;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validClubStyle(
  value: unknown,
  kind: "crest" | "kit" | "stadium" | "fans",
): boolean {
  if (value === undefined) return true;
  if (!record(value)) return false;
  const choice = (key: string, choices: readonly string[]) =>
    value[key] === undefined || (typeof value[key] === "string" && choices.includes(value[key]));
  const number = (key: string, min: number, max: number) =>
    value[key] === undefined || boundedNumber(value[key], min, max);
  const colors = (keys: string[]) =>
    keys.every((key) => value[key] === undefined || colorField(value[key]));
  if (kind === "stadium")
    return (
      (value["name"] === undefined || textField(value["name"])) &&
      number("capacity", 500, 150_000) &&
      choice("roof", ["aberto", "parcial", "total"]) &&
      colors(["seatColor"])
    );
  if (kind === "fans")
    return (
      number("size", 0, 2) &&
      choice("chant", ["carnaval", "operario", "epico", "silencioso"]) &&
      colors(["flagA", "flagB"])
    );
  if (kind === "crest")
    return (
      choice("shape", [
        "shield",
        "round",
        "pointed",
        "diamond",
        "hex",
        "english",
        "split",
        "banner",
      ]) &&
      choice("pattern", [
        "sash",
        "halves",
        "stripes",
        "rings",
        "quarters",
        "chevron",
        "hoop",
        "rays",
        "solid",
      ]) &&
      choice("emblem", ["ball", "lion", "eagle", "crown", "anchor", "leaf", "mountain", "bolt"]) &&
      number("founded", 1800, 2200)
    );
  return (
    choice("pattern", [
      "solid",
      "stripes",
      "hoops",
      "sash",
      "halves",
      "checks",
      "band",
      "sleeves",
      "gradient",
      "pin",
      "quarters",
      "chevron",
      "diagonal",
      "shadow",
      "argyle",
      "mesh",
    ]) && colors(["base", "detail", "shorts", "socks", "awayBase", "awayDetail"])
  );
}

export function validStyles(value: Record<string, unknown>): boolean {
  return (["crest", "kit", "stadium", "fans"] as const).every((kind) =>
    validClubStyle(value[kind], kind),
  );
}
