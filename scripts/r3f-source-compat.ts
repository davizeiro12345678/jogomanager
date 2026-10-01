import type { PluginOption, UserConfig } from "vite";

/** TanStack source attributes are DOM properties. R3F interprets their hyphens
 * as a nested Three.js property path, which fails during live updates. Keep
 * the normal inspector on HTML files and skip the renderer's JSX namespace. */
export async function protectThreeSourceTags(config: UserConfig): Promise<UserConfig> {
  async function visit(option: PluginOption): Promise<void> {
    const plugin = await option;
    if (!plugin) return;
    if (Array.isArray(plugin)) {
      for (const child of plugin) await visit(child);
      return;
    }
    if (plugin.name !== "@tanstack/devtools:inject-source" || !("transform" in plugin)) return;
    const transform = plugin.transform;
    if (!transform || typeof transform === "function") return;
    const handler = transform.handler;
    plugin.transform = {
      ...transform,
      handler(code, id, options) {
        if (
          /['"](?:@react-three\/|three(?:\/|['"]))/.test(code) ||
          /<(?:primitive|instancedMesh|group|mesh)(?:\s|\/|>)/.test(code)
        )
          return null;
        return handler.call(this, code, id, options);
      },
    };
  }
  for (const plugin of config.plugins ?? []) await visit(plugin);
  return config;
}
