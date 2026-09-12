import { CLUBS, LEAGUES } from "../src/game/data/leagues";
const list = Object.values(CLUBS).slice(0, 5).map((c: any) => `${c.id} (${c.league})`);
console.log(list.join("\n"));
console.log("ligas:", Object.keys(LEAGUES).slice(0, 5).join(", "));
