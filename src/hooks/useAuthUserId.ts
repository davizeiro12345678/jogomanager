import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

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
      .catch(() => {
        if (alive && !changed) setUserId(null);
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return userId;
}
