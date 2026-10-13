/**
 * Firebase (app + Analytics). Só roda no navegador, depois do consentimento.
 */
import type { FirebaseApp } from "firebase/app";

let app: FirebaseApp | null = null;

export async function initFirebase(): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  if (app) return app;
  try {
    const { readConsent } = await import("./consent");
    if (!readConsent().analytics) return null;
    const { getFirebaseWebConfig } = await import("./firebase-config.functions");
    const { apiKey, measurementId } = await getFirebaseWebConfig();
    if (!apiKey) return null;
    const { initializeApp, getApps } = await import("firebase/app");
    const config = {
      apiKey,
      authDomain: "sscxz-2ee8d.firebaseapp.com",
      projectId: "sscxz-2ee8d",
      storageBucket: "sscxz-2ee8d.firebasestorage.app",
      messagingSenderId: "122832770297",
      appId: "1:122832770297:web:e2f9bc68cca1b1f873be28",
      ...(measurementId ? { measurementId } : {}),
    };
    app = getApps().find((candidate) => candidate.options.projectId === config.projectId) ??
      initializeApp(config, "jogomanager");
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    // Avoid double-counting if the existing gtag.js integration sends the
    // same GA4 measurement stream; keep Firebase app initialisation separate.
    const directGa4Id = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"];
    if (measurementId && directGa4Id !== measurementId && (await isSupported())) getAnalytics(app);
    return app;
  } catch {
    return null;
  }
}
