/**
 * Firebase (app + Analytics). Só roda no navegador, depois do consentimento.
 */
import type { FirebaseApp } from "firebase/app";

let app: FirebaseApp | null = null;

export async function initFirebase(): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  if (app) return app;
  try {
    const { getFirebaseWebConfig } = await import("./firebase-config.functions");
    const { apiKey, measurementId } = await getFirebaseWebConfig();
    if (!apiKey) return null;
    const { initializeApp } = await import("firebase/app");
    app = initializeApp({
      apiKey,
      authDomain: "sscxz-2ee8d.firebaseapp.com",
      projectId: "sscxz-2ee8d",
      storageBucket: "sscxz-2ee8d.firebasestorage.app",
      messagingSenderId: "122832770297",
      appId: "1:122832770297:web:e2f9bc68cca1b1f873be28",
      ...(measurementId ? { measurementId } : {}),
    });
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (measurementId && (await isSupported())) getAnalytics(app);
    return app;
  } catch {
    return null;
  }
}
