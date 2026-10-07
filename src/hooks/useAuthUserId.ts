import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { reportSilent } from "@/lib/silent-errors";

/** undefined while loading, null for a visitor, otherwise the current account ID. */
export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (alive) setUserId(session?.user.id ?? null);
    });
    void supabase.auth
      .getSession()
      .then(({ data: session }) => {
        if (alive && !changed) setUserId(session.session?.user.id ?? null);
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
