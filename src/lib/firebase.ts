/** Firebase app is opt-in. Analytics is initialized only after analytics consent. */
import type { FirebaseApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";
import { readConsent } from "./consent";

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let setCollectionEnabled: ((analytics: Analytics, enabled: boolean) => void) | null = null;

export function disableFirebaseAnalytics() {
  if (!readConsent().analytics && analytics && setCollectionEnabled)
    setCollectionEnabled(analytics, false);
}

export async function initFirebase(
  opts: { analytics?: boolean } = {},
): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getFirebaseWebConfig } = await import("./firebase-config.functions");
    const config = await getFirebaseWebConfig();
    if (!config.apiKey || !config.projectId || !config.appId) return null;

    if (!app) {
      const { getApps, initializeApp } = await import("firebase/app");
      app =
        getApps().find((existing) => existing.name === "pfm3d") ??
        initializeApp(
          {
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
            ...(config.measurementId ? { measurementId: config.measurementId } : {}),
          },
          "pfm3d",
        );
    }
    if (opts.analytics && readConsent().analytics && config.measurementId) {
      try {
        const { getAnalytics, isSupported, setAnalyticsCollectionEnabled } =
          await import("firebase/analytics");
        if ((await isSupported()) && readConsent().analytics) {
          analytics ??= getAnalytics(app);
          setCollectionEnabled = setAnalyticsCollectionEnabled;
          setAnalyticsCollectionEnabled(analytics, true);
        }
      } catch {
        // Unsupported analytics must not prevent the app or push permissions.
      }
    }
    return app;
  } catch {
    return null;
  }
}
