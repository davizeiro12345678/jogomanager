import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { tsImport } from "tsx/esm/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { initCareer } = await tsImport(
  pathToFileURL(path.join(root, "src/game/career.ts")).href,
  import.meta.url,
);
const base = initCareer("bra", "fla", "Remount fixture");
const store = path.join(root, "src/lib/offline/store.ts").replaceAll("\\", "/");
const virtual = {
  "@/hooks/useAuthUserId": 'export function useAuthUserId(){return "career-remount-fixture"}',
  "@/integrations/supabase/client":
    "export const supabase={auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}}",
  "@/game/career-migration": "export function migrateCareer(state){return state}",
  "@/lib/career.functions":
    'export async function loadCareer(){window.careerRemountFixture.cloudLoads++;return {state:window.careerRemountFixture.base,generation:3,deletedAt:null}} export async function saveCareer(){window.careerRemountFixture.cloudSaves++;throw new Error("Controlled offline cloud failure")} export function createCareer(){} export function deleteCareer(){}',
  "@tanstack/react-start": "export function useServerFn(fn){return fn}",
  "@/lib/offline/store": `export * from ${JSON.stringify(store)};import {saveLocalCareer as persist} from ${JSON.stringify(store)};export async function saveLocalCareer(...args){const fixture=window.careerRemountFixture;if(fixture.deferFirstWrite){fixture.deferFirstWrite=false;fixture.localWrites++;await fixture.deferred}else fixture.localWrites++;return persist(...args)}`,
};
const bundled = await build({
  entryPoints: [path.join(root, ".github/fixtures/career-remount.tsx")],
  absWorkingDir: root,
  tsconfig: path.join(root, "tsconfig.json"),
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  plugins: [
    {
      name: "controlled-career-ports",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(@\/hooks\/useAuthUserId|@\/integrations\/supabase\/client|@\/game\/career-migration|@\/lib\/career.functions|@tanstack\/react-start|@\/lib\/offline\/store)$/,
          },
          (args) => ({ path: args.path, namespace: "career-ports" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "career-ports" }, (args) => ({
          contents: virtual[args.path],
          loader: "js",
          resolveDir: root,
        }));
      },
    },
  ],
});
const boot = `window.careerRemountFixture={base:${JSON.stringify(base)},deferred:null,release:null,deferFirstWrite:false,localWrites:0,cloudLoads:0,cloudSaves:0,report:null};window.careerRemountFixture.deferred=new Promise(resolve=>window.careerRemountFixture.release=resolve);`;
const server = http.createServer((request, response) => {
  if (request.url === "/fixture.js") {
    response.writeHead(200, { "Content-Type": "text/javascript" });
    response.end(bundled.outputFiles[0].contents);
  } else {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      `<!doctype html><div id="root"></div><script>${boot}</script><script src="/fixture.js"></script>`,
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.careerRemountFixture?.report !== null, {
    timeout: 20_000,
  });
  const report = await page.evaluate(() => window.careerRemountFixture.report);
  const output = path.resolve(
    process.argv[2] ||
      path.join(root, "verification/quality-update-20261108/career-remount-browser.json"),
  );
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(
    output,
    `${JSON.stringify({ ...report, browser: await browser.version(), node: process.version }, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser?.close();
  server.close();
}
