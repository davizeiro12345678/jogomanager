import { createServerFn } from "@tanstack/react-start";
import { resolveFirebaseConnectorConfig } from "./firebase-web-config";

/**
 * Firebase Web configuration is intentionally public. Never return Firebase Admin
 * service-account credentials or server-side FCM access tokens from here.
 * The distinct FIREBASE_WEB_API_KEY avoids accidentally using an unrelated Google key.
 */
export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => {
  const connector = resolveFirebaseConnectorConfig({
    apiKey: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] ?? "",
    projectId: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] ?? "",
    appId: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] ?? "",
    vapidPublicKey: process.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] ?? "",
  });
  if (connector.apiKey || connector.projectId || connector.appId || connector.vapidPublicKey) {
    return {
      ...connector,
      authDomain: connector.projectId ? `${connector.projectId}.firebaseapp.com` : "",
      storageBucket: "",
      measurementId: "",
    };
  }
  const standalone = resolveFirebaseConnectorConfig({
    apiKey: process.env["FIREBASE_WEB_API_KEY"],
    projectId: process.env["FIREBASE_PROJECT_ID"],
    appId: process.env["FIREBASE_WEB_APP_ID"],
    vapidPublicKey: process.env["FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY"],
  });
  return {
    ...standalone,
    authDomain: (process.env["FIREBASE_AUTH_DOMAIN"] ?? "").trim(),
    storageBucket: (process.env["FIREBASE_STORAGE_BUCKET"] ?? "").trim(),
    measurementId: (process.env["FIREBASE_MEASUREMENT_ID"] ?? "").trim(),
  };
});
