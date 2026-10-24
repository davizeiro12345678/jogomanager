import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/User/.codex/mcp-game-runtime/node_modules/playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--disable-software-rasterizer",
    ...process.argv.slice(2),
  ],
});
try {
  const page = await browser.newPage();
  console.log(
    JSON.stringify(
      await page.evaluate(() => {
        const gl = document
          .createElement("canvas")
          .getContext("webgl2", { powerPreference: "high-performance" });
        if (!gl) return { available: false };
        const extension = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          available: true,
          renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
          vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
        };
      }),
    ),
  );
} finally {
  await browser.close();
}
