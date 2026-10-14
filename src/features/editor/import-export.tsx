import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportCustomJson, importCustomJson, type CustomData } from "@/lib/customData";

/* ================================================== IMPORTAR / EXPORTAR === */

export default function ImportExportTab({
  data,
  onChange,
}: {
  data: CustomData;
  onChange: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([exportCustomJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pfm3d-editor.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMsg("");
    try {
      const text = await file.text();
      const result = importCustomJson(text);
      if (result.ok) {
        setMsg("Dados importados com sucesso.");
        onChange();
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
        <h2 className="font-display text-sm uppercase tracking-wide">Exportar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe um arquivo .json com todos os clubes, jogadores e competições que você cadastrou.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {Object.keys(data.clubs).length} clube(s) · {data.players.length} jogador(es) ·{" "}
          {data.competitions.length} competição(ões)
        </p>
        <Button className="mt-4" onClick={download}>
          Baixar arquivo .json
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-sm uppercase tracking-wide">Importar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe um arquivo exportado anteriormente. Isso substitui os dados salvos neste
          navegador.
        </p>
        <Input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="mt-4"
          onChange={onImport}
        />
        {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
