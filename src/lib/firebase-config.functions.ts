import { createServerFn } from "@tanstack/react-start";

/** A configuração web do Firebase é pública; só é guardada como segredo por conveniência. */
export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => ({
  apiKey: (
    process.env["GOOGLE_API_KEY"] ??
    process.env["FIREBASE_API_KEY"] ??
    process.env["VITE_GOOGLE_API_KEY"] ??
    ""
  ).trim(),
  measurementId: (
    process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ??
    process.env["VITE_GOOGLE_ANALYTICS_ID"] ??
    ""
  ).trim(),
}));
