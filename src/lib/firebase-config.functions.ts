import { createServerFn } from "@tanstack/react-start";

/**
 * Firebase WEB config is public, but a general server GOOGLE_API_KEY is NOT.
 * Use only the dedicated browser SDK key; never expose secret Google APIs here.
 */
export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => ({
  apiKey: (process.env["FIREBASE_WEB_API_KEY"] ?? "AIzaSyBgaknQ5e7aBH9wClm8QCzstrYM_O7pUB8").trim(),
  measurementId: (process.env["FIREBASE_MEASUREMENT_ID"] ?? "G-GEBKR68PLW").trim(),
}));
