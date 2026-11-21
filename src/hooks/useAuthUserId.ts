import { useEffect, useState } from "react";

import { getConfiguredSupabaseClient } from "@/integrations/supabase/client";
import { reportSilent } from "@/lib/silent-errors";

/** undefined while loading, null for a visitor, otherwise the current account ID. */
export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const client = getConfiguredSupabaseClient();
    if (!client) {
      setUserId(null);
      return;
    }
    let alive = true;
    let changed = false;
    const observePushIdentity = (nextUserId: string | null) => {
      if (!alive) return;
      void import("@/lib/firebase-push")
        .then((push) => {
          if (!alive) return;
          return push.observeFirebasePushIdentity(nextUserId);
        })
        .catch((error) => {
          if (!alive) return;
          reportSilent("auth.operation", error, {
            classification: "degradation",
            feature: "push-identity",
            phase: "observe",
            dedupeKey: "push-identity-observer",
          });
        });
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      changed = true;
      const nextUserId = session?.user.id ?? null;
      if (alive) setUserId(nextUserId);
      observePushIdentity(nextUserId);
    });
    void client.auth
      .getSession()
      .then(({ data: session }) => {
        if (!alive || changed) return;
        const nextUserId = session.session?.user.id ?? null;
        setUserId(nextUserId);
        observePushIdentity(nextUserId);
      })
      .catch((error) => {
        if (alive && !changed) {
          reportSilent("auth.operation", error, {
            classification: "fatal",
            feature: "auth-session",
            phase: "get-session",
            dedupeKey: "auth-session-read",
          });
          setUserId(null);
        }
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return userId;
}
