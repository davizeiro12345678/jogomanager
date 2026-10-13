/**
 * Firebase (app + Analytics). Só roda no navegador, depois do consentimento.
 * A configuração web do Firebase é pública por natureza.
 */
import type { FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey:
    import.meta.env["VITE_FIREBASE_API_KEY"] ||
    import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] ||
    "",
  authDomain: "sscxz-2ee8d.firebaseapp.com",
  projectId: "sscxz-2ee8d",
  storageBucket: "sscxz-2ee8d.firebasestorage.app",
  messagingSenderId: "122832770297",
  appId: "1:122832770297:web:e2f9bc68cca1b1f873be28",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || undefined,
};

let app: FirebaseApp | null = null;

export async function initFirebase(): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  if (app) return app;
  if (!firebaseConfig.apiKey) return null; // sem chave: não inicializa
  try {
    const { initializeApp } = await import("firebase/app");
    app = initializeApp(firebaseConfig);
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (firebaseConfig.measurementId && (await isSupported())) getAnalytics(app);
    return app;
  } catch {
    return null;
  }
}
