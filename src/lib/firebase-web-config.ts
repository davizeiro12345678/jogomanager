export interface FirebaseConnectorConfig {
  apiKey?: string;
  projectId?: string;
  appId?: string;
  vapidPublicKey?: string;
}

export type ResolvedFirebaseConnectorConfig = ReturnType<typeof resolveFirebaseConnectorConfig>;

/** Resolve the connector as one project; never mix its identity with legacy defaults. */
export function resolveFirebaseConnectorConfig(config: FirebaseConnectorConfig) {
  const apiKey = config.apiKey?.trim() ?? "";
  const projectId = config.projectId?.trim() ?? "";
  const appId = config.appId?.trim() ?? "";
  const vapidPublicKey = config.vapidPublicKey?.trim() ?? "";
  const messagingSenderId = appId.split(":")[1] ?? "";
  return { apiKey, projectId, appId, vapidPublicKey, messagingSenderId };
}

export interface FirebaseProjectIdentity {
  apiKey?: string;
  projectId?: string;
  appId?: string;
  messagingSenderId?: string;
}

/** Require the existing and incoming app to belong to the same configured project. */
export function sameFirebaseProjectIdentity(
  existing: FirebaseProjectIdentity,
  incoming: FirebaseProjectIdentity,
): boolean {
  const keys: (keyof FirebaseProjectIdentity)[] = [
    "apiKey",
    "projectId",
    "appId",
    "messagingSenderId",
  ];
  return keys.every((key) => {
    const expected = incoming[key]?.trim() ?? "";
    return expected !== "" && (existing[key]?.trim() ?? "") === expected;
  });
}

/**
 * A connector may be populated incrementally. Prefer it only when its Firebase
 * project identity is complete; otherwise use the independent standalone config.
 */
export function selectFirebaseWebConfig(sources: {
  connector: FirebaseConnectorConfig;
  standalone: FirebaseConnectorConfig;
}): { source: "connector" | "standalone"; config: ResolvedFirebaseConnectorConfig } {
  const connector = resolveFirebaseConnectorConfig(sources.connector);
  if (connector.apiKey && connector.projectId && connector.appId && connector.messagingSenderId) {
    return { source: "connector", config: connector };
  }
  return {
    source: "standalone",
    config: resolveFirebaseConnectorConfig(sources.standalone),
  };
}
