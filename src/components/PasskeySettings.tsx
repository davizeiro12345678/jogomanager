import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthMethods } from "@/hooks/useAuthMethods";
import { supabase } from "@/integrations/supabase/client";
import { passkeyErrorMessage, supportsPasskeys } from "@/integrations/supabase/passkey-auth";

export function PasskeySettings() {
  const { methods, loading, error: settingsError, retry } = useAuthMethods();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const supported = supportsPasskeys();

  async function register() {
    if (busy || !supported || !methods?.passkeys) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await supabase.auth.registerPasskey();
      if (result.error) throw result.error;
      setNotice(
        "Chave de acesso cadastrada. Na próxima entrada, escolha Entrar com chave de acesso.",
      );
    } catch (cause) {
      setError(passkeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !settingsError && !methods?.passkeys) return null;
  return (
    <section className="surface-card mt-5 p-5" aria-labelledby="passkey-title">
      <h2 id="passkey-title" className="flex items-center gap-2 font-display text-lg">
        <Fingerprint size={20} /> Chave de acesso
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cadastre a biometria, o bloqueio do seu aparelho ou uma chave de segurança para entrar sem
        senha.
      </p>
      {loading ? (
        <p role="status" className="mt-3 text-sm">
          Carregando opções de acesso…
        </p>
      ) : settingsError ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-destructive">
            {settingsError}
          </p>
          <Button type="button" variant="outline" className="mt-2" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11"
            disabled={busy || !supported}
            onClick={register}
          >
            {busy ? "Aguarde a confirmação do aparelho…" : "Cadastrar chave de acesso"}
          </Button>
          {!supported && (
            <p className="mt-2 text-sm text-muted-foreground">
              Abra o jogo por HTTPS em um navegador com suporte a chaves de acesso.
            </p>
          )}
        </>
      )}
      {notice && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
