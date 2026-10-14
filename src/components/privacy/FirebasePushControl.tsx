import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseWebConfig } from "@/lib/firebase-config.functions";
import {
  disableFirebaseNotifications,
  enableFirebaseNotifications,
  hasFirebasePushDeviceToken,
} from "@/lib/firebase-push";

/** FCM notification permission is requested only by clicking the opt-in button. */
export function FirebasePushControl() {
  const [configured, setConfigured] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    setEnabled(hasFirebasePushDeviceToken());
    const browserSupportsPush =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (browserSupportsPush) {
      void getFirebaseWebConfig()
        .then((config) => {
          if (mounted) setConfigured(Boolean(config.apiKey && config.vapidPublicKey));
        })
        .catch(() => undefined);
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.user));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(Boolean(session?.user));
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const change = async () => {
    if (busy || !configured || !signedIn) return;
    setBusy(true);
    try {
      if (!enabled && Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage("Permissão de notificações não concedida.");
          return;
        }
      }
      const result = enabled
        ? await disableFirebaseNotifications()
        : await enableFirebaseNotifications();
      setEnabled(result.enabled);
      setMessage(result.message);
    } catch {
      setMessage("Falha ao atualizar as notificações. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!configured || !signedIn || busy}
          onClick={() => void change()}
        >
          {enabled ? <BellOff className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
          {enabled ? "Desativar avisos neste aparelho" : "Ativar avisos neste aparelho"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {!configured
            ? "Firebase Push ainda não configurado"
            : !signedIn
              ? "Entre na conta para habilitar"
              : "Opcional e revogável"}
        </span>
      </div>
      {message ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
