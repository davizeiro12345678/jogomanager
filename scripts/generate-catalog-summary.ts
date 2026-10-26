import { readFileSync, writeFileSync } from "node:fs";
import { SHIPPED_CATALOG } from "../src/game/data/catalog-facts";

// Build-time catalogue access: public editorial pages only import the JSON summary.
// The integrity test fails if a catalogue update leaves this summary out of date.
const target = new URL("../src/game/data/catalog-summary.generated.json", import.meta.url);
const expected = JSON.stringify(SHIPPED_CATALOG, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== expected)
    throw new Error("Regenerate the public catalogue summary");
} else {
  writeFileSync(target, expected);
}
