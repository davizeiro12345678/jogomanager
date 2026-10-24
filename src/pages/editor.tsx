// ============================================================================
//  /editor
//  Modo editor e customização: elencos, clubes, competições e
//  importar/exportar. Tudo salvo no navegador via src/lib/customData.ts —
//  funciona sem login e é aplicado automaticamente ao mundo do jogo.
// ============================================================================

import { lazy, Suspense, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { readCustom } from "@/lib/custom-data-storage";
import type { CustomData } from "@/lib/customData";

const RosterTab = lazy(() => import("@/features/editor/roster"));

const ClubsTab = lazy(() => import("@/features/editor/clubs"));

const CompetitionsTab = lazy(() => import("@/features/editor/competitions"));

const ImportExportTab = lazy(() =>
  import("@/components/game/editor/ImportExportEditor").then((m) => ({
    default: m.ImportExportTab,
  })),
);

function EditorTabLoading() {
  return (
    <div
      aria-label="Carregando conteúdo do editor"
      role="status"
      className="mt-4 min-h-40 animate-pulse rounded-xl border border-border/60 surface-card"
    />
  );
}

export function EditorPage() {
  const [data, setData] = useState<CustomData>(() => readCustom());
  const refresh = () => setData(readCustom());

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Editor e customização</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Edite elencos, clubes e competições do jogo. Tudo fica salvo no seu navegador e é aplicado
        automaticamente, sem precisar de login.
      </p>

      <Tabs defaultValue="elencos" className="mt-6">
        <TabsList>
          <TabsTrigger value="elencos">Elencos</TabsTrigger>
          <TabsTrigger value="clubes">Clubes</TabsTrigger>
          <TabsTrigger value="competicoes">Competições</TabsTrigger>
          <TabsTrigger value="io">Importar/Exportar</TabsTrigger>
        </TabsList>

        <TabsContent value="elencos">
          <Suspense fallback={<EditorTabLoading />}>
            <RosterTab data={data} onChange={refresh} />
          </Suspense>
        </TabsContent>
        <TabsContent value="clubes">
          <Suspense fallback={<EditorTabLoading />}>
            <ClubsTab data={data} onChange={refresh} />
          </Suspense>
        </TabsContent>
        <TabsContent value="competicoes">
          <Suspense fallback={<EditorTabLoading />}>
            <CompetitionsTab data={data} onChange={refresh} />
          </Suspense>
        </TabsContent>
        <TabsContent value="io">
          <Suspense fallback={<EditorTabLoading />}>
            <ImportExportTab data={data} onChange={refresh} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </main>
  );
}
