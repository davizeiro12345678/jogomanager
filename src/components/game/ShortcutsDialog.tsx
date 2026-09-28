// ============================================================================
//  ShortcutsDialog.tsx
//  Guia de atalhos de teclado: tecla `?` abre em qualquer tela do jogo.
//
//  Lista o que já existe (paleta Ctrl+K, controles da partida) num lugar só —
//  antes os atalhos da partida viviam escondidos numa lista só para leitor de
//  tela. Não intercepta teclas dentro de campos de texto.
// ============================================================================

import { memo, useEffect, useState } from "react";
import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Em todo o jogo",
    keys: [
      ["Ctrl/⌘ + K", "Abrir a paleta de comandos"],
      ["?", "Abrir este guia"],
      ["Esc", "Fechar diálogos e gavetas"],
    ],
  },
  {
    title: "Na partida ao vivo",
    keys: [
      ["Espaço", "Pausar / retomar"],
      ["1 – 4", "Velocidade (1×, 2×, 4×, 8×)"],
      ["C", "Trocar a câmera"],
      ["E", "Abrir estatísticas"],
      ["M", "Mostrar / ocultar o radar"],
      ["S", "Pular partida"],
    ],
  },
  {
    title: "Nas cutscenes",
    keys: [
      ["Espaço / Enter", "Avançar a fala"],
      ["Clique", "Avançar a fala"],
    ],
  },
];

function typingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export const ShortcutsDialog = memo(function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !typingTarget(e)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver atalhos de teclado"
        title="Atalhos (?)"
        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Keyboard size={18} aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atalhos de teclado</DialogTitle>
            <DialogDescription>Jogue mais rápido sem tirar a mão do teclado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {g.title}
                </h3>
                <dl className="space-y-1.5">
                  {g.keys.map(([key, what]) => (
                    <div key={key} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="text-muted-foreground">{what}</dt>
                      <dd>
                        <kbd className="hud-num rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-xs font-bold">
                          {key}
                        </kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
