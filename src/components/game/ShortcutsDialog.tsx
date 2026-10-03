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
import { useT } from "@/i18n/provider";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "shortcuts.global",
    keys: [
      ["Ctrl/⌘ + K", "shortcuts.palette"],
      ["?", "shortcuts.guide"],
      ["Esc", "shortcuts.close"],
    ],
  },
  {
    title: "shortcuts.match",
    keys: [
      ["Space", "shortcuts.pause"],
      ["1 – 4", "shortcuts.speed"],
      ["C", "shortcuts.camera"],
      ["E", "shortcuts.stats"],
      ["M", "shortcuts.radar"],
      ["S", "shortcuts.skip"],
    ],
  },
  {
    title: "shortcuts.scenes",
    keys: [["Space / Enter", "shortcuts.advance"]],
  },
];

function typingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export const ShortcutsDialog = memo(function ShortcutsDialog({
  quick = false,
  onOpenChange,
  showLabel = false,
  className = "grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
}: {
  quick?: boolean;
  onOpenChange?: (open: boolean) => void;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const groups = quick
    ? [
        {
          title: "shortcuts.global",
          keys: [
            ["?", "shortcuts.guide"],
            ["Esc", "shortcuts.close"],
          ] as [string, string][],
        },
        {
          title: "shortcuts.match",
          keys: [
            ["Space", "shortcuts.pause"],
            ["1 – 4", "shortcuts.speed"],
            ["C", "shortcuts.camera"],
            ["N", "narration.title"],
          ] as [string, string][],
        },
      ]
    : GROUPS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !typingTarget(e)) {
        e.preventDefault();
        setOpen(true);
        onOpenChange?.(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onOpenChange?.(true);
        }}
        aria-label={t("shortcuts.title")}
        title={`${t("shortcuts.title")} (?)`}
        className={className}
      >
        <Keyboard size={18} aria-hidden="true" />
        {showLabel ? <span>{t("shortcuts.title")}</span> : null}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          onOpenChange?.(value);
        }}
      >
        <DialogContent className="preferences-dialog">
          <DialogHeader>
            <DialogTitle>{t("shortcuts.title")}</DialogTitle>
            <DialogDescription>{t("shortcuts.hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t(g.title)}
                </h3>
                <dl className="space-y-1.5">
                  {g.keys.map(([key, what]) => (
                    <div key={key} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="text-muted-foreground">{t(what)}</dt>
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
