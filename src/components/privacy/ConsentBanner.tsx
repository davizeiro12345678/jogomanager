import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readConsent, saveConsent } from "@/lib/consent";

/**
 * Lightweight, global privacy notice.
 * Keep this module independent of ConsentCenter and FirebasePushControl:
 * neither the full privacy dashboard nor notification settings belong in
 * the critical JavaScript graph for public pages.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readConsent().decidedAt === null);
    const close = () => setOpen(false);
    window.addEventListener("consent-changed", close);
    return () => window.removeEventListener("consent-changed", close);
  }, []);

  // Keep room for the fixed notice so it cannot cover mobile game controls.
  useEffect(() => {
    if (typeof document === "undefined" || !open) return;
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
