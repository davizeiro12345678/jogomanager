import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import {
  competitionMeta,
  FORMAT_LABEL,
  removeCompetition,
  upsertCompetition,
  type CompetitionFormat,
  type CustomCompetition,
  type CustomData,
} from "@/lib/customData";
import { FORMATS, labelCls } from "./shared";

/* =========================================================== COMPETIÇÕES == */

const EMPTY_COMP = (): CustomCompetition => ({
  id: `comp-${Date.now().toString(36)}`,
  name: "",
  country: "Brasil",
  clubIds: [],
  format: "pontos-corridos",
  relegated: 4,
  continentalSlots: 2,
});

export default function CompetitionsTab({
  data,
  onChange,
}: {
  data: CustomData;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<CustomCompetition | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(EMPTY_COMP());
            setOpen(true);
          }}
        >
          Nova competição
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 surface-card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Clubes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.competitions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                  Nenhuma competição customizada ainda.
                </TableCell>
              </TableRow>
            )}
            {data.competitions.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.country}</TableCell>
                <TableCell>{FORMAT_LABEL[c.format]}</TableCell>
                <TableCell>{c.clubIds.length}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(c);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        removeCompetition(c.id);
                        onChange();
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CompetitionDialog
        open={open}
        onOpenChange={setOpen}
        comp={editing}
        onSaved={() => {
          onChange();
          setOpen(false);
        }}
      />
    </div>
  );
}
function CompetitionDialog({
  open,
  onOpenChange,
  comp,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comp: CustomCompetition | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomCompetition | null>(comp);
  const [error, setError] = useState("");

  if (comp && form?.id !== comp.id && open) {
    setForm(comp);
    setError("");
  }
  if (!form) return null;

  const set = <K extends keyof CustomCompetition>(k: K, v: CustomCompetition[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  function toggleClub(id: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.clubIds.includes(id);
      return { ...f, clubIds: has ? f.clubIds.filter((c) => c !== id) : [...f.clubIds, id] };
    });
  }

  function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setError("Dê um nome à competição.");
      return;
    }
    if (form.clubIds.length < 2) {
      setError("Escolha pelo menos 2 clubes.");
      return;
    }
    upsertCompetition({ ...form, name: form.name.trim() });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{comp?.name ? "Editar competição" : "Nova competição"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Nome</span>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>País</span>
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Formato</span>
            <Select
              value={form.format}
              onValueChange={(v) => set("format", v as CompetitionFormat)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Rebaixados</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={form.relegated}
              onChange={(e) => set("relegated", Number(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Vagas continentais</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={form.continentalSlots}
              onChange={(e) => set("continentalSlots", Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <span className={labelCls}>Clubes participantes ({form.clubIds.length})</span>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50 p-2">
            {LEAGUES.map((l) => (
              <div key={l.id} className="mb-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {l.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  {l.clubs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClub(c.id)}
                      className={`rounded-full border px-2 py-1 text-[11px] transition ${
                        form.clubIds.includes(c.id)
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {c.short}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar competição</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
