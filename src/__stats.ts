import { premiumSyncStats } from "./lib/premium-sync.server";
let off = Number(process.argv[2] ?? 0); const end = Date.now() + 540_000;
while (Date.now() < end) { const r = await premiumSyncStats(500, off, 90_000, 10); console.log(JSON.stringify(r)); if (!r.processed) break; off = r.nextOffset; }
console.log("END", off);
