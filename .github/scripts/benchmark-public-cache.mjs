import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Isolated synthetic public catalogue, never a user's IndexedDB or live API.
// Measure synchronous encoding + put, not just asynchronous disk completion.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [output] = process.argv.slice(2);
if (!output) throw new Error("Expected output file");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.route("https://cache-benchmark.invalid/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Isolated cache benchmark</title>" }),
  );
  await page.goto("https://cache-benchmark.invalid/");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const report = await page.evaluate(async () => {
    const request = (operation) =>
      new Promise((resolve, reject) => {
        operation.onsuccess = () => resolve(operation.result);
        operation.onerror = () => reject(operation.error);
      });
    const open = indexedDB.open("public-cache-fixture", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("cache");
    const db = await request(open);
    const data = { crests: {}, kits: {} };
    for (let i = 0; i < 25_000; i++)
      data.crests[`club-${i}`] = `https://images.example/football/teams/${i}.png`;
    for (let i = 0; i < 1_000; i++)
      data.kits[`club-${i}`] = `https://images.example/football/kits/${i}.png`;
    const value = { at: 1_793_275_200_000, data },
      reference = JSON.stringify(value);
    const samples = { object: [], string: [] };
    const reads = { object: [], string: [] };
    const save = async (mode, measured) => {
      const tx = db.transaction("cache", "readwrite"),
        store = tx.objectStore("cache");
      const completed = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      const start = performance.now();
      store.put(mode === "string" ? JSON.stringify(value) : value, "fixture");
      const duration = performance.now() - start;
      await completed;
      const readStart = performance.now();
      const read = db.transaction("cache").objectStore("cache").get("fixture");
      const readTime = await new Promise((resolve, reject) => {
        read.onerror = () => reject(read.error);
        read.onsuccess = () => {
          const stored = read.result;
          const restored = typeof stored === "string" ? JSON.parse(stored) : stored;
          // Include native materialization before onsuccess, not just the
          // property accessor. This latency also includes asynchronous I/O.
          const elapsed = performance.now() - readStart;
          if (JSON.stringify(restored) !== reference) reject(new Error("Cache content changed"));
          else resolve(elapsed);
        };
      });
      if (measured) {
        samples[mode].push(duration);
        reads[mode].push(readTime);
      }
    };
    try {
      for (let i = 0; i < 3; i++) {
        await save("object", false);
        await save("string", false);
      }
      for (let i = 0; i < 11; i++)
        for (const mode of ["object", "string", "string", "object"]) await save(mode, true);
      return {
        fixture: { crests: 25_000, kits: 1_000, jsonCharacters: reference.length },
        order: "ABBA, three warmups and 22 samples per encoding",
        identityVerified: true,
        synchronousWriteMs: samples,
        readLatencyMs: reads,
      };
    } finally {
      db.close();
      await request(indexedDB.deleteDatabase("public-cache-fixture"));
    }
  });
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[10] + sorted[11]) / 2;
  };
  const result = {
    ...report,
    browser: browser.version(),
    cpuSlowdown: 4,
    releaseCertification: false,
    writeMedianMs: Object.fromEntries(
      Object.entries(report.synchronousWriteMs).map(([k, v]) => [k, median(v)]),
    ),
    readLatencyMedianMs: Object.fromEntries(
      Object.entries(report.readLatencyMs).map(([k, v]) => [k, median(v)]),
    ),
  };
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      writeMedianMs: result.writeMedianMs,
      readLatencyMedianMs: result.readLatencyMedianMs,
    }),
  );
} finally {
  await browser.close();
}
