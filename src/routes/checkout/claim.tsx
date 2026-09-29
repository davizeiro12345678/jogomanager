import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { claimGuestCheckout } from "@/lib/guest-checkout.functions";
import { supabase } from "@/integrations/supabase/client";

function validIntent(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function validSession(value: unknown): value is string {
  return typeof value === "string" && /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export const Route = createFileRoute("/checkout/claim")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { intent?: string; session_id?: string } => ({
    ...(validIntent(search["intent"]) ? { intent: search["intent"] } : {}),
    ...(validSession(search["session_id"]) ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: ClaimGuestCheckout,
});

function ClaimGuestCheckout() {
  const { intent, session_id: sessionId } = Route.useSearch();
  const claim = useServerFn(claimGuestCheckout);
  const [status, setStatus] = useState<"loading" | "delivered" | "pending" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!intent || !sessionId) {
      setStatus("error");
      setMessage("O link da compra está incompleto.");
      return;
    }
    let mounted = true;

    const deliver = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (mounted) {
          setStatus("error");
          setMessage("Abra o link de e-mail novamente para entrar e receber sua compra.");
        }
        return;
      }
      try {
        const result = await claim({ data: { intentId: intent, sessionId } });
        if (!mounted) return;
        if (result.status === "delivered") {
          setStatus("delivered");
        } else if (result.status === "pending") {
          setStatus("pending");
          setMessage(result.message);
        } else {
          setStatus("error");
          setMessage(result.message);
        }
      } catch {
        if (mounted) {
          setStatus("error");
          setMessage("Não foi possível vincular esta compra agora.");
        }
      }
    };

    void deliver();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void deliver();
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [claim, intent, sessionId]);

  return (
    <main className="pitch-bg grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 p-8 text-center shadow-2xl backdrop-blur-xl">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Vinculando sua compra</h1>
            <p className="mt-2 text-sm text-muted-foreground">Estamos conferindo o pagamento e sua conta.</p>
          </>
        ) : null}
        {status === "delivered" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Item entregue</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua compra agora está vinculada a esta conta e aparece na carreira.
            </p>
          </>
        ) : null}
        {status === "pending" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Quase pronto</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 font-display text-2xl uppercase">Não foi possível entregar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        ) : null}
        <div className="mt-7 flex flex-col gap-2">
          <Button asChild><Link to="/loja">Abrir minha loja</Link></Button>
          <Button asChild variant="ghost"><Link to="/compras">Ver minhas compras</Link></Button>
        </div>
      </section>
    </main>
  );
}
