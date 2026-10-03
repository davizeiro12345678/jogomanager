import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/i18n/provider";

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
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const trigger = useRef<HTMLButtonElement>(null);

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
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.search")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="career-search-button"
      >
        <Search size={17} aria-hidden="true" />
        <span>{t("nav.search")}</span>
        <kbd>Ctrl K</kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        contentProps={{
          className: "career-command-dialog",
          closeLabel: t("common.close"),
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            trigger.current?.focus();
          },
        }}
      >
        <DialogTitle className="sr-only">{t("nav.searchTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("nav.searchHint")}</DialogDescription>
        <CommandInput placeholder={t("common.search")} aria-label={t("nav.search")} />
        <CommandList label={t("nav.searchTitle")}>
          <CommandEmpty>{t("common.empty")}</CommandEmpty>
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
