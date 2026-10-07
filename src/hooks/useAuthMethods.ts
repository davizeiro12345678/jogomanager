import { useCallback, useEffect, useState } from "react";
import { availableAuthMethods, type AuthMethods } from "@/integrations/supabase/social-auth";
import { reportSilent } from "@/lib/silent-errors";

export function useAuthMethods() {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void availableAuthMethods(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setMethods(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          reportSilent("auth.operation", error, {
            classification: "fatal",
            feature: "auth-methods",
            phase: "load",
            dedupeKey: "auth-methods-load",
          });
          setError(
            "Não foi possível carregar as formas de entrada. Confira a conexão e tente novamente.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  return { methods, loading, error, retry };
}
