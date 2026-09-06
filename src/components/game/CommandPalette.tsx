import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PaletteItem {
  to: string;
  label: string;
  group: string;
}

/**
 * Busca rápida por comando (Ctrl/⌘ + K) com todas as telas do jogo.
 * Também abre por clique no botão de lupa do cabeçalho.
 */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar tela"
        className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <Search size={13} />
        Buscar
        <kbd className="rounded bg-secondary px-1 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Ir para… (elenco, táticas, mercado)" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g} heading={g}>
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <CommandItem
                    key={i.to}
                    value={`${i.label} ${i.to}`}
                    onSelect={() => {
                      setOpen(false);
                      void navigate({ to: i.to });
                    }}
                  >
                    {i.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
