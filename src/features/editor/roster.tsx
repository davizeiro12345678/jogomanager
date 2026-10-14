import { useMemo, useState } from "react";
import { Crest } from "@/components/game/Crest";
import { PlayerPortrait } from "@/components/game/PlayerPortrait";
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
import { PERSONALITIES } from "@/game/attributes";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import type { Personality, Position } from "@/game/types";
import {
  customPlayersFor,
  movePlayer,
  removePlayer,
  upsertPlayer,
  type CustomData,
  type CustomPlayer,
} from "@/lib/customData";
import { labelCls, POSITIONS, POS_LABEL, readImage } from "./shared";

/* ============================================================== ELENCOS === */

const EMPTY_PLAYER = (clubId: string): CustomPlayer => ({
  id: `custom-${clubId}-${Date.now().toString(36)}`,
  clubId,
  name: "",
  pos: "MF",
  age: 24,
  ovr: 70,
  contractYears: 3,
  wage: 0.2,
  value: 5,
});

export default function RosterTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = useMemo(() => LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0]!, [leagueId]);
  const [clubId, setClubId] = useState(league.clubs[0]?.id ?? "");
  const club = CLUBS[clubId];
  const players = customPlayersFor(clubId);

  const [editing, setEditing] = useState<CustomPlayer | null>(null);
  const [open, setOpen] = useState(false);

  function onSelectLeague(id: string) {
    setLeagueId(id);
    const first = LEAGUES.find((l) => l.id === id)?.clubs[0];
    if (first) setClubId(first.id);
  }

  function startCreate() {
    setEditing(EMPTY_PLAYER(clubId));
    setOpen(true);
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 surface-card p-4">
        <div>
          <span className={labelCls}>Liga</span>
          <Select value={leagueId} onValueChange={onSelectLeague}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAGUES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.flag} {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={labelCls}>Clube</span>
          <Select value={clubId} onValueChange={setClubId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {league.clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {club && <Crest club={club} size={40} />}
        <Button className="ml-auto" onClick={startCreate} disabled={!clubId}>
          Novo jogador
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 surface-card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jogador</TableHead>
              <TableHead>Pos.</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead>Valor (M€)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                  Nenhum jogador cadastrado para este clube ainda.
                </TableCell>
              </TableRow>
            )}
            {players.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="flex items-center gap-2">
                  <PlayerPortrait
                    player={
                      {
                        ...p,
                        number: p.number ?? 1,
                        pace: 0,
                        shooting: 0,
                        passing: 0,
                        defending: 0,
                        physical: 0,
                        condition: 0,
                        morale: 0,
                        goals: 0,
                        assists: 0,
                        apps: 0,
                        yellows: 0,
                        suspended: false,
                        injuryWeeks: 0,
                      } as never
                    }
                    size={32}
                    primary={club?.primary ?? "#0a8f3c"}
                    secondary={club?.secondary ?? "#ffffff"}
                  />
                  {p.name}
                </TableCell>
                <TableCell>{POS_LABEL[p.pos]}</TableCell>
                <TableCell>{p.age}</TableCell>
                <TableCell>{p.ovr}</TableCell>
                <TableCell>{p.value.toFixed(1)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        removePlayer(p.id);
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

      <PlayerDialog
        open={open}
        onOpenChange={setOpen}
        player={editing}
        onSaved={() => {
          onChange();
          setOpen(false);
        }}
      />
    </div>
  );
}
function PlayerDialog({
  open,
  onOpenChange,
  player,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  player: CustomPlayer | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomPlayer | null>(player);
  const [error, setError] = useState("");

  if (player && form?.id !== player.id && open) {
    setForm(player);
    setError("");
  }

  if (!form) return null;
  const set = <K extends keyof CustomPlayer>(k: K, v: CustomPlayer[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const league = LEAGUES.find((l) => l.clubs.some((c) => c.id === form.clubId));

  function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setError("Informe o nome do jogador.");
      return;
    }
    upsertPlayer({ ...form, name: form.name.trim() });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{player?.name ? "Editar jogador" : "Novo jogador"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2 sm:col-span-2">
            <PlayerPortrait
              player={
                {
                  ...form,
                  number: form.number ?? 1,
                  pace: 0,
                  shooting: 0,
                  passing: 0,
                  defending: 0,
                  physical: 0,
                  condition: 0,
                  morale: 0,
                  goals: 0,
                  assists: 0,
                  apps: 0,
                  yellows: 0,
                  suspended: false,
                  injuryWeeks: 0,
                } as never
              }
              size={88}
              primary={CLUBS[form.clubId]?.primary ?? "#0a8f3c"}
              secondary={CLUBS[form.clubId]?.secondary ?? "#ffffff"}
            />
          </div>
          <div>
            <span className={labelCls}>Nome</span>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Posição</span>
            <Select value={form.pos} onValueChange={(v) => set("pos", v as Position)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POS_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Clube</span>
            <Select value={form.clubId} onValueChange={(v) => set("clubId", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {LEAGUES.map((l) => (
                  <optgroup key={l.id} label={l.name}>
                    {l.clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </optgroup>
                ))}
              </SelectContent>
            </Select>
            {league && (
              <p className="mt-1 text-[10px] text-muted-foreground">Liga: {league.name}</p>
            )}
          </div>
          <div>
            <span className={labelCls}>Número</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={form.number ?? ""}
              onChange={(e) => set("number", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <span className={labelCls}>Idade</span>
            <Input
              type="number"
              min={15}
              max={44}
              value={form.age}
              onChange={(e) => set("age", Number(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Overall (35-99)</span>
            <Input
              type="number"
              min={35}
              max={99}
              value={form.ovr}
              onChange={(e) => set("ovr", Number(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Potencial (0-99)</span>
            <Input
              type="number"
              min={0}
              max={99}
              value={form.potential ?? ""}
              onChange={(e) =>
                set("potential", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <span className={labelCls}>Nacionalidade</span>
            <Input
              value={form.nationality ?? ""}
              onChange={(e) => set("nationality", e.target.value || undefined)}
            />
          </div>
          <div>
            <span className={labelCls}>Personalidade</span>
            <Select
              value={form.personality ?? "__none"}
              onValueChange={(v) =>
                set("personality", v === "__none" ? undefined : (v as Personality))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Automática</SelectItem>
                {PERSONALITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Contrato (anos)</span>
            <Input
              type="number"
              min={1}
              max={6}
              value={form.contractYears}
              onChange={(e) => set("contractYears", Number(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Salário semanal (M€)</span>
            <Input
              type="number"
              step="0.05"
              min={0}
              value={form.wage}
              onChange={(e) => set("wage", Number(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Valor de mercado (M€)</span>
            <Input
              type="number"
              step="0.5"
              min={0}
              value={form.value}
              onChange={(e) => set("value", Number(e.target.value))}
            />
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>Foto</span>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) set("photo", await readImage(f, 160));
              }}
            />
          </div>

          <div className="sm:col-span-2 grid gap-3 rounded-lg border border-border/50 p-3 sm:grid-cols-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground sm:col-span-5">
              Atributos manuais (opcionais — deixe em branco para calcular a partir do overall)
            </p>
            {(["pace", "shooting", "passing", "defending", "physical"] as const).map((k) => (
              <div key={k}>
                <span className={labelCls}>{k}</span>
                <Input
                  type="number"
                  min={35}
                  max={99}
                  value={form[k] ?? ""}
                  onChange={(e) => set(k, e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar jogador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
