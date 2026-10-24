import type { Plugin, ResolveModulePreloadDependenciesFn } from "vite";

/** Imported modules are evaluated before their host can start a dynamic import.
 * Keep new chunks preloaded, while omitting already-loaded static dependencies
 * from Vite's repeated per-route URL manifests. CSS stays under Vite's ordering. */
export function modulePreloadPlan(): {
  plugin: Plugin;
  resolveDependencies: ResolveModulePreloadDependenciesFn;
} {
  const loadedByHost = new Map<string, Set<string>>();
  return {
    plugin: {
      name: "pfm-module-preload-plan",
      apply: "build",
      applyToEnvironment: (environment) => environment.config.consumer === "client",
      generateBundle: {
        order: "pre",
        handler(_options, bundle) {
          loadedByHost.clear();
          for (const [name, output] of Object.entries(bundle)) {
            if (output.type !== "chunk") continue;
            const loaded = new Set<string>();
            const visit = (file: string) => {
              if (loaded.has(file)) return;
              const dependency = bundle[file];
              if (dependency?.type !== "chunk") return;
              loaded.add(file);
              dependency.imports.forEach(visit);
            };
            visit(name);
            loadedByHost.set(name, loaded);
          }
        },
      },
    },
    resolveDependencies(_filename, dependencies, context) {
      if (context.hostType !== "js") return dependencies;
      const loaded = loadedByHost.get(context.hostId);
      return loaded ? dependencies.filter((dependency) => !loaded.has(dependency)) : dependencies;
    },
  };
}
