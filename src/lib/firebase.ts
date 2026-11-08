/** Firebase app is opt-in. Analytics is initialized only after analytics consent. */
import type { FirebaseApp } from "firebase/app";
import type { getFirebaseWebConfig } from "./firebase-config.functions";
import { sameFirebaseProjectIdentity } from "./firebase-web-config";

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

    const identity = {
      apiKey: config.apiKey,
      projectId: config.projectId,
      appId: config.appId,
      messagingSenderId: config.messagingSenderId,
    };
    if (app && !sameFirebaseProjectIdentity(app.options, identity)) return null;
    if (!app) {
      const { getApps, initializeApp } = await import("firebase/app");
      const existing = getApps().find((candidate) => candidate.name === "pfm3d");
      if (existing) {
        if (!sameFirebaseProjectIdentity(existing.options, identity)) return null;
        app = existing;
      } else {
        app = initializeApp(
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
