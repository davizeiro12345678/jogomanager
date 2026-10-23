import { useEffect, useId, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { CareerState } from "@/game/types";
import {
  exportCareerFile,
  importCareerFile,
  previewCareerFile,
  type CareerTransferPreview,
} from "@/game/contracts/career-transfer";
import { MAX_IMPORT_BYTES } from "@/lib/import-validation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function FileSummary({ summary }: { summary: CareerTransferPreview }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      <div>
        <dt className="text-muted-foreground">Clube</dt>
        <dd>{summary.clubName}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Treinador</dt>
        <dd>{summary.managerName}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Temporada / rodada</dt>
        <dd>
          {summary.season} / {summary.round} · {summary.calendarYear}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Versão do save</dt>
        <dd>{summary.gameSaveVersion}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-muted-foreground">Data da cópia</dt>
        <dd>
          <time dateTime={summary.exportedAt}>
            {new Date(summary.exportedAt).toLocaleString("pt-BR")}
          </time>
        </dd>
      </div>
      <div className="col-span-2">
        <dt className="text-muted-foreground">Conteúdo validado</dt>
        <dd>
          {summary.playerCount} jogadores · {summary.fixtureCount} partidas no calendário ·{" "}
          {summary.historyCount} temporadas no histórico
        </dd>
      </div>
    </dl>
  );
}

export function CareerTransferPanel({
  career,
  ownerId,
  ready,
  onImport,
}: {
  career: CareerState | null;
  ownerId: string | null;
  ready: boolean;
  onImport: (career: CareerState) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pendingExport, setPendingExport] = useState<{
    text: string;
    summary: CareerTransferPreview;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    text: string;
    summary: CareerTransferPreview;
    owner: string | null;
    name: string;
  } | null>(null);
  const id = useId();
  useEffect(() => {
    setPendingExport(null);
    setPendingImport(null);
    setStatus("");
  }, [ownerId]);
  useEffect(() => {
    setPendingExport(null);
  }, [career]);
  const assertOwner = async (expected: string | null) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || (data.session?.user.id ?? null) !== expected) {
      throw new Error(
        "A conta mudou durante a importação. Selecione o arquivo novamente no perfil correto.",
      );
    }
  };
  return (
    <section aria-labelledby={`${id}-title`} aria-busy={busy} className="mt-4 text-left">
      <h2 id={`${id}-title`} className="font-display text-base">
        Cópia e restauração da carreira
      </h2>
      <p id={`${id}-help`} className="mt-2 text-xs text-muted-foreground">
        Restaure uma carreira de treinador sem criar outro save primeiro. Para levar uma carreira de
        visitante à sua conta: exporte como visitante, entre na conta e importe o arquivo aqui. Essa
        transferência é uma escolha sua; o login não adota o save de visitante automaticamente. O
        arquivo inclui elenco, finanças, calendário e histórico. As personalizações do editor têm
        uma exportação separada e não substituem esta cópia da carreira.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {career ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready || busy}
            onClick={() => {
              try {
                const text = exportCareerFile(career);
                setPendingExport({ text, summary: previewCareerFile(text) });
                setPendingImport(null);
                setStatus("");
              } catch (error) {
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível exportar a carreira. Tente novamente.",
                );
              }
            }}
          >
            <Download size={14} aria-hidden="true" /> Exportar carreira
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready || busy}
          aria-controls={`${id}-file`}
          aria-describedby={`${id}-help`}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={14} aria-hidden="true" />{" "}
          {busy ? "Validando arquivo…" : "Importar carreira"}
        </Button>
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Selecionar arquivo JSON de carreira de treinador"
          aria-describedby={`${id}-help`}
          disabled={!ready || busy}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file || !ready || inFlight.current) return;
            const expectedOwner = ownerId;
            inFlight.current = true;
            setBusy(true);
            setStatus("");
            setPendingImport(null);
            setPendingExport(null);
            try {
              if (file.size > MAX_IMPORT_BYTES)
                throw new Error("O arquivo excede o limite de 4 MB.");
              const text = await file.text();
              const summary = previewCareerFile(text);
              await assertOwner(expectedOwner);
              setPendingImport({
                text,
                summary,
                owner: expectedOwner,
                name: file.name,
              });
            } catch (error) {
              setStatus(
                error instanceof Error ? error.message : "Não foi possível importar a carreira.",
              );
            } finally {
              input.value = "";
              inFlight.current = false;
              setBusy(false);
            }
          }}
        />
      </div>
      {pendingExport ? (
        <section
          aria-label="Revisar exportação da carreira"
          className="mt-4 rounded-xl border border-primary/40 p-4"
        >
          <h3 className="font-semibold">Revisar cópia da carreira</h3>
          <FileSummary summary={pendingExport.summary} />
          <p className="mt-3 text-xs text-muted-foreground">
            JSON conferido antes do download. Depois de baixar, teste a restauração em outro perfil
            do navegador antes de apagar seus dados.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPendingExport(null)}
            >
              Cancelar exportação
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!ready || busy}
              onClick={() => {
                try {
                  const summary = previewCareerFile(pendingExport.text);
                  const url = URL.createObjectURL(
                    new Blob([pendingExport.text], { type: "application/json" }),
                  );
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `carreira-${summary.clubId}-t${summary.season}-r${summary.round}.pfm3d.json`;
                  document.body.append(anchor);
                  anchor.click();
                  anchor.remove();
                  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
                  setStatus(
                    "Arquivo validado. Download solicitado; confira o .pfm3d.json em Downloads. O navegador ainda precisa concluir o download.",
                  );
                } catch (error) {
                  setStatus(
                    error instanceof Error ? error.message : "Não foi possível iniciar o download.",
                  );
                }
              }}
            >
              <Download size={14} aria-hidden="true" /> Baixar carreira validada
            </Button>
          </div>
        </section>
      ) : null}
      {pendingImport ? (
        <section
          aria-label="Revisar restauração da carreira"
          className="mt-4 rounded-xl border border-amber-400/50 p-4"
        >
          <h3 className="break-all font-semibold">Revisar {pendingImport.name}</h3>
          <FileSummary summary={pendingImport.summary} />
          <p className="mt-3 text-xs text-muted-foreground">
            {career
              ? "Esta restauração substituirá a carreira atual. Exporte uma cópia antes de confirmar."
              : "A carreira será restaurada neste perfil."}{" "}
            {pendingImport.owner
              ? "A sincronização com a conta depende da conexão; confira o indicador de sincronização depois."
              : "A cópia ficará no perfil de visitante deste aparelho."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPendingImport(null)}
            >
              Cancelar restauração
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!ready || busy}
              onClick={async () => {
                if (inFlight.current) return;
                inFlight.current = true;
                setBusy(true);
                setStatus("");
                try {
                  await assertOwner(pendingImport.owner);
                  await onImport(importCareerFile(pendingImport.text));
                  await assertOwner(pendingImport.owner);
                  setPendingImport(null);
                  setStatus(
                    "Arquivo validado e salvo neste perfil. Confira elenco, finanças, calendário e histórico, além do indicador de sincronização da nuvem.",
                  );
                } catch (error) {
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível restaurar a carreira.",
                  );
                } finally {
                  inFlight.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? "Salvando carreira…" : "Confirmar restauração da carreira"}
            </Button>
          </div>
        </section>
      ) : null}
      {!ready ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Verificando a conta antes de permitir a importação…
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Guarde o JSON em local privado. Compras e assinatura pertencem à conta do pagamento e não
        são transferidas pelo arquivo. Arquivos da carreira de atleta usam outro formato.
      </p>
      <p className="mt-2 text-xs text-primary" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
