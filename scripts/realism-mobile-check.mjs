import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const b = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route("**/__l5e/assets-v1/**", (r) =>
    r.fulfill({ status: 404, body: "controlled fallback" }),
  );
  await p.goto("http://127.0.0.1:4266/club", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.evaluate(async () => {
    const { initCareer } = await import("/src/game/career.ts");
    const { saveLocalCareer } = await import("/src/lib/offline/store.ts");
    await saveLocalCareer(initCareer("bra", "fla", "QA largura"), "QA", null);
  });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(7000);
  const findings = await p.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")]
      .flatMap((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)
          ? [
              {
                tag: e.tagName,
                class: e.className,
                text: e.textContent.slice(0, 110),
                left: r.left,
                width: r.width,
                right: r.right,
              },
            ]
          : [];
      })
      .slice(0, 25),
  }));
  fs.writeFileSync(
    "verification/realism-data-20261022/after/app/mobile-overflow-diagnostic.json",
    JSON.stringify(findings, null, 2),
  );
  console.log(JSON.stringify(findings));
  await p.screenshot({
    path: "verification/realism-data-20261022/after/app/mobile-overflow-diagnostic.png",
    fullPage: true,
  });
} finally {
  await b.close();
}
