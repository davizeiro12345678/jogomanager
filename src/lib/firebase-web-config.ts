export interface FirebaseConnectorConfig {
  apiKey?: string;
  projectId?: string;
  appId?: string;
  vapidPublicKey?: string;
}

/** Resolve the connector as one project; never mix its identity with legacy defaults. */
export function resolveFirebaseConnectorConfig(config: FirebaseConnectorConfig) {
  const apiKey = config.apiKey?.trim() ?? "";
  const projectId = config.projectId?.trim() ?? "";
  const appId = config.appId?.trim() ?? "";
  const vapidPublicKey = config.vapidPublicKey?.trim() ?? "";
  const messagingSenderId = appId.split(":")[1] ?? "";
  return { apiKey, projectId, appId, vapidPublicKey, messagingSenderId };
}