import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./new.tsx", import.meta.url), "utf8");
const arrival = source.match(/<Cutscene\s+scene="arrival"[\s\S]*?\/>/)?.[0] ?? "";

describe("manager arrival scene integration", () => {
  it("passes the selected club so the crest and both club colours reach the scene", () => {
    expect(arrival).toContain("club={selected?.club}");
  });

  it("passes the new manager's name to the arrival dialogue", () => {
    expect(arrival).toContain("managerName={name.trim()}");
  });
});
