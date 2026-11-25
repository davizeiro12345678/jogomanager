import assert from "node:assert/strict";
import test from "node:test";
import { chromiumLaunchOptions, playwrightModuleSpecifier } from "./realism-browser-runtime.mjs";

test("portable capture loads Playwright from explicit CI path", () => {
  assert.equal(
    playwrightModuleSpecifier({ PLAYWRIGHT_MODULE: "/tmp/qa/playwright" }),
    "/tmp/qa/playwright",
  );
});

test("default browser capture does not reference a personal Windows path", () => {
  assert.equal(playwrightModuleSpecifier({}), "playwright");
  assert.equal(
    chromiumLaunchOptions({ env: {}, platform: "linux", native: false }).executablePath,
    undefined,
  );
});

test("honors the CI browser executable without changing isolation flags", () => {
  assert.deepEqual(
    chromiumLaunchOptions({
      env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/usr/bin/google-chrome" },
      platform: "linux",
      native: false,
    }),
    { headless: true, executablePath: "/usr/bin/google-chrome", args: [] },
  );
});

test("native renderer flags are platform appropriate", () => {
  const linux = chromiumLaunchOptions({ native: true, platform: "linux", env: {} });
  const windows = chromiumLaunchOptions({ native: true, platform: "win32", env: {} });
  assert.ok(linux.args.includes("--enable-gpu"));
  assert.ok(!linux.args.includes("--use-angle=d3d11"));
  assert.ok(windows.args.includes("--use-angle=d3d11"));
});
