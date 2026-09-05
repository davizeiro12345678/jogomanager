import { LEAGUES, CLUBS } from "@/game/data/leagues";
const ids = LEAGUES.flatMap(l=>l.clubs).map(c=>c.id);
const dup = ids.filter((id,i)=>ids.indexOf(id)!==i);
const lids = LEAGUES.map(l=>l.id); const ldup = lids.filter((id,i)=>lids.indexOf(id)!==i);
console.log("ligas", LEAGUES.length, "clubes", Object.keys(CLUBS).length, "dupClubes", [...new Set(dup)], "dupLigas", [...new Set(ldup)]);
