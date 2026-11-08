import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseWebConfig } from "@/lib/firebase-config.functions";
import {
  disableFirebaseNotifications,
  enableFirebaseNotifications,
  hasFirebasePushDeviceToken,
  observeFirebasePushIdentity,
} from "@/lib/firebase-push";

/** FCM notification permission is requested only by clicking the opt-in button. */
export function FirebasePushControl() {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getFirebaseWebConfig>> | null>(
    null,
  );
  const [signedIn, setSignedIn] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mountedRef = useRef(false);
  const identityVersionRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncIdentity = (userId: string | null) => {
      const version = ++identityVersionRef.current;
      currentUserIdRef.current = userId;
      if (mounted) {
        setSignedIn(userId !== null);
        setEnabled(false);
        setMessage("");
      }
      void observeFirebasePushIdentity(userId)
        .then(() => {
          if (
            !mounted ||
            version !== identityVersionRef.current ||
            currentUserIdRef.current !== userId
          )
            return;
          setEnabled(hasFirebasePushDeviceToken(userId));
          setMessage("");
        })
        .catch(() => {
          if (
            mounted &&
            version === identityVersionRef.current &&
            currentUserIdRef.current === userId
          )
            setEnabled(false);
        });
    };
    mountedRef.current = true;
    const browserSupportsPush =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (browserSupportsPush) {
      void getFirebaseWebConfig()
        .then((config) => {
          if (
            mounted &&
            config.apiKey &&
            config.projectId &&
            config.appId &&
            config.messagingSenderId &&
            config.vapidPublicKey
          )
            setConfig(config);
        })
        .catch(() => undefined);
    }
    let authChanged = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      syncIdentity(session?.user.id ?? null);
    });
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error || authChanged) return;
        const userId = data.user?.id ?? null;
        syncIdentity(userId);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      mountedRef.current = false;
      identityVersionRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, []);

  const change = async () => {
    if (busy || !config || !signedIn) return;
    const requestedVersion = identityVersionRef.current;
    const requestedUserId = currentUserIdRef.current;
    setBusy(true);
    try {
      const result = enabled
        ? await disableFirebaseNotifications()
        : await enableFirebaseNotifications(config);
      if (
        mountedRef.current &&
        requestedVersion === identityVersionRef.current &&
        requestedUserId === currentUserIdRef.current
      ) {
        setEnabled(result.enabled);
        setMessage(result.message);
      }
    } catch {
      if (
        mountedRef.current &&
        requestedVersion === identityVersionRef.current &&
        requestedUserId === currentUserIdRef.current
      )
        setMessage("Falha ao atualizar as notificações. Tente novamente.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={!config || !signedIn || busy}
          onClick={() => void change()}
        >
          {enabled ? <BellOff className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
          {enabled ? "Desativar avisos neste aparelho" : "Ativar avisos neste aparelho"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {!config
            ? "Atualize a conexão Firebase com Include web push para ativar os avisos."
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
