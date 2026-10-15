import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readConsent, saveConsent } from "@/lib/consent";

/** Isolated from consent settings, Firebase push and data-export UI.
 * Every route needs the banner but not the entire preferences editor. */
/** Aviso discreto na primeira visita; some depois da escolha. */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(readConsent().decidedAt === null);
    const close = () => setOpen(false);
    window.addEventListener("consent-changed", close);
    return () => window.removeEventListener("consent-changed", close);
  }, []);
  // Enquanto o aviso está aberto ele reserva espaço no fim da página: sem isso
  // ele cobria os botões do rodapé (ex.: "Jogar" na partida rápida) no celular.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "11rem";
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [open]);
  if (!open) return null;
  const choose = (all: boolean) => {
    saveConsent({ analytics: all, telemetry: all });
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Privacidade"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg"
    >
      <div className="pointer-events-auto rounded-xl border border-border bg-card p-4 shadow-lg">
        <p className="text-sm text-muted-foreground">
          Usamos só o essencial para salvar seu jogo. Quer ajudar a melhorar o desempenho com dados
          anônimos?{" "}
          <a href="/privacidade" className="text-primary underline">
            Saiba mais
          </a>
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => choose(true)}>
            Aceitar
          </Button>
          <Button size="sm" variant="outline" onClick={() => choose(false)}>
            Só o essencial
          </Button>
        </div>
      </div>
    </div>
  );
}
