type NodeEnvironment = Record<string, string | undefined>;

// The native binding is server-only. Node previews have no cloudflare:workers module.
let workerBindings: Record<string, unknown> | undefined;
try {
  workerBindings = (await import("cloudflare:workers")).env as Record<string, unknown>;
} catch {
  // Local Node preview uses process.env instead.
}

export function resolveFootballPublicEnvironment(
  bindings: Record<string, unknown> | undefined,
  node: NodeEnvironment,
) {
  const read = (name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") => {
    const value = bindings?.[name];
    return typeof value === "string" && value.length > 0 ? value : node[name];
  };
  return {
    SUPABASE_URL: read("SUPABASE_URL"),
    SUPABASE_PUBLISHABLE_KEY: read("SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function footballPublicEnvironment() {
  return resolveFootballPublicEnvironment(workerBindings, process.env);
}
