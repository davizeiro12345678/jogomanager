import { MAX_IMPORT_BYTES } from "@/lib/import-validation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {
  exportCustomJson,
  importCustomJson,
  previewCustomJson,
  type CustomData,
} from "@/lib/customData";

/* ================================================== IMPORTAR / EXPORTAR === */

export function ImportExportTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [pending, setPending] = useState<{ raw: string; name: string; data: CustomData } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    setExportMsg("");
    try {
      const text = exportCustomJson();
      const preview = previewCustomJson(text);
      if (!preview.ok) throw new Error(preview.error);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pfm3d-personalizacoes-editor.json";
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setExportMsg(
        "Personalizações conferidas. Download solicitado; confirme a conclusão no navegador.",
      );
    } catch (error) {
      setExportMsg(
        error instanceof Error ? error.message : "Não foi possível exportar as personalizações.",
      );
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMsg("");
    setPending(null);
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        setError("O pacote excede o limite de 4 MB. Seus dados foram preservados.");
        return;
      }
      const text = await file.text();
      const result = previewCustomJson(text);
      if (result.ok) {
        setPending({ raw: text, name: file.name, data: result.data });
      } else {
        setError(result.error);
      }
    } catch {
      setError("Não foi possível ler o arquivo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-sm uppercase tracking-wide">
          Exportar personalizações do editor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe os clubes, jogadores e competições que você cadastrou no editor. Este arquivo não
          inclui progresso, finanças, calendário nem histórico da carreira.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {Object.keys(data.clubs).length} clube(s) · {data.players.length} jogador(es) ·{" "}
          {data.competitions.length} competição(ões)
        </p>
        {!Object.keys(data.clubs).length && !data.players.length && !data.competitions.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nenhuma personalização cadastrada. O pacote do editor ficará vazio.
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          <a className="text-primary underline" href="/perfil">
            Para proteger seu progresso, abra Perfil do treinador e use Exportar carreira.
          </a>
        </p>
        <Button className="mt-4" onClick={download}>
          Exportar personalizações do editor
        </Button>
        <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
          {exportMsg}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-sm uppercase tracking-wide">
          Importar personalizações do editor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe um pacote do editor. Isso substitui somente as personalizações do editor salvas
          neste navegador. Para restaurar um save, use Importar carreira no Perfil do treinador.
        </p>
        <Input
          ref={fileRef}
          type="file"
          accept="application/json"
          aria-label="Escolher pacote do editor para revisar"
          className="mt-4"
          onChange={onImport}
        />
        {pending && (
          <section
            className="mt-4 rounded-xl border border-amber-400/50 p-4"
            aria-label="Revisão da importação"
          >
            <h3 className="font-semibold">Revisar {pending.name}</h3>
            <p className="mt-2 text-sm">
              Pacote validado: {Object.keys(pending.data.clubs).length} clube(s),{" "}
              {pending.data.players.length} jogador(es) e {pending.data.competitions.length}{" "}
              competição(ões).
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ao confirmar, este pacote substitui seus dados atuais do editor. Exporte uma cópia
              antes de continuar se quiser guardar a versão atual.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={download}>
                Exportar personalizações atuais
              </Button>
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancelar importação
              </Button>
              <Button
                onClick={() => {
                  const result = importCustomJson(pending.raw);
                  if (result.ok) {
                    setPending(null);
                    setMsg("Dados importados com sucesso.");
                    onChange();
                  } else setError(result.error);
                }}
              >
                Confirmar substituição dos dados
              </Button>
            </div>
          </section>
        )}
        {msg && (
          <p role="status" className="mt-2 text-sm text-emerald-400">
            {msg}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
