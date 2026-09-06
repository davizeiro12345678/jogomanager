import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Resultado do pagamento · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Confirmação de pagamento e entrega de itens.",
      },
      { property: "og:title", content: "Resultado do pagamento · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Confirmação de pagamento e entrega de itens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const id = typeof search["session_id"] === "string" ? search["session_id"] : undefined;
    return id ? { session_id: id } : {};
  },
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    setStatus("success");
  }, [sessionId]);

  return (
    <div className="pitch-bg flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/90 p-6 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-xl uppercase tracking-wide">Processando…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Aguardando confirmação do pagamento.
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-green-500" />
            <h1 className="font-display text-xl uppercase tracking-wide">Pagamento confirmado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seus itens serão entregues em poucos segundos. Obrigado por apoiar o jogo!
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/loja">Voltar à loja</Link>
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <h1 className="font-display text-xl uppercase tracking-wide">Sessão não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Não recebemos os dados da transação. Se o pagamento foi cobrado, os itens chegarão em breve.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/loja">Voltar à loja</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
