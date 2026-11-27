/**
 * Resolve the graphics evidence browser without user-specific installation paths.
 * CI supplies PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE.
 */
export function playwrightModuleSpecifier(env = process.env) {
  return env.PLAYWRIGHT_MODULE?.trim() || "playwright";
}

export function chromiumLaunchOptions({
  env = process.env,
  platform = process.platform,
  native = false,
} = {}) {
  const executablePath = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
  const args = native
    ? [
        ...(platform === "win32" ? ["--use-angle=d3d11"] : []),
        "--enable-gpu",
        "--ignore-gpu-blocklist",
        "--disable-software-rasterizer",
      ]
    : [];
  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args,
  };
}
