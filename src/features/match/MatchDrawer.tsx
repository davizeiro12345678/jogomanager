import { lazy, Suspense } from "react";
import { useT } from "@/i18n/context";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const StorePanel = lazy(() =>
  import("@/components/game/StorePanel").then((module) => ({ default: module.StorePanel })),
);

const ChatPanel = lazy(() =>
  import("@/components/game/ChatPanel").then((module) => ({ default: module.ChatPanel })),
);

export default function MatchDrawer({
  open,
  panel,
  trigger,
  onClose,
}: {
  open: boolean;
  panel: "store" | "chat";
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        onCloseAutoFocus={(event) => {
          if (trigger.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
        className="flex w-full flex-col overflow-y-auto sm:max-w-md"
        closeLabel={panel === "store" ? "Fechar loja" : "Fechar chat"}
      >
        <SheetHeader>
          <SheetTitle className="pr-10 font-display uppercase tracking-wide">
            {panel === "store" ? "Loja" : "Chat global"}
          </SheetTitle>
          <SheetDescription>
            {panel === "store"
              ? "Se precisar entrar, a loja abre em outra página e esta partida ao vivo não é salva. Com conta, o jogo fica pausado durante o checkout."
              : "Converse com outros técnicos sem perder o jogo."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Suspense
            fallback={
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            }
          >
            {open &&
              (panel === "store" ? (
                <StorePanel next="/loja" columns={1} />
              ) : (
                <ChatPanel next="/match" />
              ))}
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
