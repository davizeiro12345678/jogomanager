import { createServerFn } from "@tanstack/react-start";

/**
 * Firebase Web configuration is intentionally public. Never return Firebase Admin
 * service-account credentials or server-side FCM access tokens from here.
 * The distinct FIREBASE_WEB_API_KEY avoids accidentally using an unrelated Google key.
 */
export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => ({
  apiKey: (process.env["FIREBASE_WEB_API_KEY"] ?? "").trim(),
  authDomain: (process.env["FIREBASE_AUTH_DOMAIN"] ?? "sscxz-2ee8d.firebaseapp.com").trim(),
  projectId: (process.env["FIREBASE_PROJECT_ID"] ?? "sscxz-2ee8d").trim(),
  storageBucket: (
    process.env["FIREBASE_STORAGE_BUCKET"] ?? "sscxz-2ee8d.firebasestorage.app"
  ).trim(),
  messagingSenderId: (process.env["FIREBASE_MESSAGING_SENDER_ID"] ?? "122832770297").trim(),
  appId: (
    process.env["FIREBASE_WEB_APP_ID"] ?? "1:122832770297:web:e2f9bc68cca1b1f873be28"
  ).trim(),
  vapidPublicKey: (process.env["FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY"] ?? "").trim(),
  measurementId: (
    process.env["FIREBASE_MEASUREMENT_ID"] ??
    process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ??
    ""
  ).trim(),
}));
