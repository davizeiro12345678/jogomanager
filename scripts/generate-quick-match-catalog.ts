import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

import { LEAGUES } from "../src/game/data/leagues";

const defaultLeague = LEAGUES[0];
if (!defaultLeague || defaultLeague.clubs.length < 2) {
  throw new Error("The quick-match default league must contain at least two clubs.");
}

const catalog = {
  directory: LEAGUES.map(({ id, name, country }) => ({ id, name, country })),
  defaultLeague,
};
const contents = `import type { League } from "../types";

export type QuickMatchLeagueSummary = Pick<League, "id" | "name" | "country">;

const catalog = ${JSON.stringify(catalog, null, 2)} satisfies {
  directory: QuickMatchLeagueSummary[];
  defaultLeague: League;
};

export const QUICK_MATCH_LEAGUE_DIRECTORY = catalog.directory;
export const DEFAULT_QUICK_MATCH_LEAGUE = catalog.defaultLeague;
`;
const output = new URL("../src/game/data/quick-match-catalog.ts", import.meta.url);
const outputPath = fileURLToPath(output);
const options = await prettier.resolveConfig(outputPath);
const formatted = await prettier.format(contents, { ...(options ?? {}), filepath: outputPath });
writeFileSync(outputPath, formatted);
console.log(`Wrote ${catalog.directory.length} league summaries to ${outputPath}`);
