/** Firebase app is opt-in. Analytics is initialized only after analytics consent. */
import type { FirebaseApp } from "firebase/app";
import type { getFirebaseWebConfig } from "./firebase-config.functions";

let app: FirebaseApp | null = null;
let analyticsStarted = false;

export async function initFirebase(
  opts: { analytics?: boolean; config?: Awaited<ReturnType<typeof getFirebaseWebConfig>> } = {},
): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  try {
    const config =
      opts.config ?? (await (await import("./firebase-config.functions")).getFirebaseWebConfig());
    if (!config.apiKey || !config.projectId || !config.appId) return null;

    if (app && (app.options.projectId !== config.projectId || app.options.appId !== config.appId)) {
      return null;
    }
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
    if (opts.analytics && !analyticsStarted && config.measurementId) {
      try {
        const { getAnalytics, isSupported } = await import("firebase/analytics");
        if (await isSupported()) {
          getAnalytics(app);
          analyticsStarted = true;
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
