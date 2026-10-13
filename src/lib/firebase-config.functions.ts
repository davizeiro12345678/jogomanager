import { createServerFn } from "@tanstack/react-start";

/** A configuração web do Firebase é pública; só é guardada como segredo por conveniência. */
export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => ({
  apiKey: (process.env["GOOGLE_API_KEY"] ?? "").trim(),
  measurementId: (process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ?? "").trim(),
}));
