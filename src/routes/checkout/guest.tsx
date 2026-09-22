import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Mail, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getGuestCheckoutStatus } from "@/lib/guest-checkout.functions";
import { supabase } from "@/integrations/supabase/client";

function validIntent(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function validSession(value: unknown): value is string {
  return typeof value === "string" && /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export const Route = createFileRoute("/checkout/guest")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { intent?: string; session_id?: string } => ({
    ...(validIntent(search["intent"]) ? { intent: search["intent"] } : {}),
    ...(validSession(search["session_id"]) ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: GuestCheckoutReturn,
});

function GuestCheckoutReturn() {
  const { intent, session_id: sessionId } = Route.useSearch();
  const getStatus = useServerFn(getGuestCheckoutStatus);
  const [status, setStatus] = useState<"loading" | "pending" | "paid" | "error">(
    intent && sessionId ? "loading" : "error",
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const refresh = useCallback(async () => {
    if (!intent || !sessionId) {
      setStatus("error");
      setMessage("Não encontramos esta compra visitante.");
      return;
    }
    setStatus("loading");
    try {
      const result = await getStatus({ data: { intentId: intent, sessionId } });
      if (result.status === "paid") {
        setStatus("paid");
        return;
      }
      if (result.status === "pending") {
        setStatus("pending");
        return;
      }
      setStatus("error");
      setMessage("message" in result ? result.message : "Não foi possível confirmar esta compra agora.");
    } catch {
      setStatus("error");
      setMessage("Não foi possível confirmar esta compra agora.");
    }
  }, [getStatus, intent, sessionId]);

  useEffect(() => {
    if (intent) {
      const remembered = window.sessionStorage.getItem(`pfm3d.guest-checkout.${intent}.email`);
      if (remembered) setEmail(remembered);
    }
    void refresh();
  }, [intent, refresh]);

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intent || !sessionId) return;
    setSending(true);
    setMessage("");
    const redirectTo = `${window.location.origin}/checkout/claim?intent=${encodeURIComponent(intent)}&session_id=${encodeURIComponent(sessionId)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setSending(false);
    if (error) {
      setMessage("Não foi possível enviar o link. Confira o e-mail e tente novamente.");
      return;
    }
    window.sessionStorage.setItem(`pfm3d.guest-checkout.${intent}.email`, email.trim());
    setSent(true);
  }

  return (
    <main className="pitch-bg grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        {status === "loading" ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Confirmando pagamento</h1>
            <p className="mt-2 text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
          </div>
        ) : null}

        {status === "pending" ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Pagamento em confirmação</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Assim que o banco confirmar, volte aqui para receber o link de acesso.
            </p>
            <Button className="mt-5" variant="outline" onClick={() => void refresh()}>
              <RefreshCw size={16} /> Verificar novamente
            </Button>
          </div>
        ) : null}

        {status === "paid" ? (
          <>
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-4 font-display text-2xl uppercase">Pagamento confirmado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Envie um link seguro para o mesmo e-mail usado no pagamento. Ele cria ou abre sua
                conta e entrega o item automaticamente.
              </p>
            </div>
            {sent ? (
              <div role="status" className="mt-6 rounded-xl border border-primary/35 bg-primary/10 p-4 text-sm">
                <p className="font-medium">Confira sua caixa de entrada</p>
                <p className="mt-1 text-muted-foreground">
                  O link abre esta compra e finaliza a entrega na sua conta.
                </p>
              </div>
            ) : (
              <form className="mt-6 space-y-3" onSubmit={sendMagicLink}>
                <label className="block text-sm font-medium" htmlFor="claim-email">
                  Mesmo e-mail usado no pagamento
                </label>
                <input
                  id="claim-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@email.com"
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                <Button type="submit" className="w-full" disabled={sending}>
                  <Mail size={16} /> {sending ? "Enviando link…" : "Enviar link seguro"}
                </Button>
              </form>
            )}
          </>
        ) : null}

        {status === "error" ? (
          <div className="text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 font-display text-2xl uppercase">Compra não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message || "Este link é inválido ou expirou."}
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-2">
          <Button asChild variant="outline"><Link to="/produtos">Voltar aos produtos</Link></Button>
          <Button asChild variant="ghost"><Link to="/auth">Já tenho uma conta</Link></Button>
        </div>
      </section>
    </main>
  );
}
