import { supabase } from "@/integrations/supabase/client";
import { getFirebaseWebConfig } from "./firebase-config.functions";
import { initFirebase } from "./firebase";

const DEVICE_TOKEN_KEY = "pfm3d:fcm-device-token";

export type PushResult = { enabled: boolean; message: string };

/**
 * Only call from a user click. Never ask for push permission automatically.
 * Uses the same registered /sw.js as the offline mode, rather than creating
 * a competing Firebase worker with a different update lifecycle.
 */
export async function enableFirebaseNotifications(): Promise<PushResult> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return { enabled: false, message: "Notificações não suportadas neste navegador." };
  }
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) {
    return { enabled: false, message: "Entre na conta antes de ativar notificações." };
  }
  const config = await getFirebaseWebConfig();
  if (!config.apiKey || !config.vapidPublicKey) {
    return { enabled: false, message: "As chaves públicas do Firebase ainda não foram configuradas." };
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { enabled: false, message: "Permissão de notificações não concedida." };
    }
  }

  const app = await initFirebase();
  if (!app) return { enabled: false, message: "Firebase indisponível neste momento." };
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) {
    return { enabled: false, message: "Este dispositivo não suporta Firebase Messaging." };
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  const token = await getToken(getMessaging(app), {
    vapidKey: config.vapidPublicKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) return { enabled: false, message: "Não foi possível gerar um token de mensagens." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: identity.user.id, token, updated_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) return { enabled: false, message: "Não foi possível salvar a inscrição." };
  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return { enabled: true, message: "Notificações ativadas neste dispositivo." };
}

/** Remove this device only, never unsubscribe the user's other devices. */
export async function disableFirebaseNotifications(): Promise<PushResult> {
  if (typeof window === "undefined") return { enabled: false, message: "Indisponível." };
  const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) return { enabled: false, message: "Nenhuma inscrição neste dispositivo." };
  const { error } = await supabase.from("push_subscriptions").delete().eq("token", token);
  if (error) return { enabled: true, message: "Não foi possível desativar a inscrição na nuvem." };

  try {
    const app = await initFirebase();
    if (app) {
      const { deleteToken, getMessaging, isSupported } = await import("firebase/messaging");
      if (await isSupported()) await deleteToken(getMessaging(app));
    }
  } catch {
    // Cloud record has already been removed. Browser token deletion is best-effort.
  }
  window.localStorage.removeItem(DEVICE_TOKEN_KEY);
  return { enabled: false, message: "Notificações desativadas neste dispositivo." };
}

export function hasFirebasePushDeviceToken(): boolean {
  return typeof window !== "undefined" && !!window.localStorage.getItem(DEVICE_TOKEN_KEY);
}
