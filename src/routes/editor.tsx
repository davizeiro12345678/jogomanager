// ============================================================================
//  /editor
//  Modo editor e customização: elencos, clubes, competições e
//  importar/exportar. Tudo salvo no navegador via src/lib/customData.ts —
//  funciona sem login e é aplicado automaticamente ao mundo do jogo.
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Chips, CREST_EMBLEMS, CREST_PATTERNS, CREST_SHAPES, EMBLEM_LABEL, KIT_PATTERNS } from "@/components/game/CrestBuilder";
import { PlayerPortrait } from "@/components/game/PlayerPortrait";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERSONALITIES } from "@/game/attributes";
import type { RoofKind, ChantKind } from "@/game/customStyle";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import type { Personality, Position } from "@/game/types";
import {
  competitionMeta,
  customPlayersFor,
  exportCustomJson,
  FORMAT_LABEL,
  importCustomJson,
  movePlayer,
  readCustom,
  removeClub,
  removeCompetition,
  removePlayer,
  upsertClub,
  upsertCompetition,
  upsertPlayer,
  type ClubOverride,
  type CompetitionFormat,
  type CustomCompetition,
  type CustomData,
  type CustomPlayer,
} from "@/lib/customData";

export const Route = createFileRoute("/editor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Editor e customização · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Edite elencos, clubes, escudos, uniformes, estádios e monte competições customizadas. Exporte e importe seus dados quando quiser.",
      },
      { property: "og:title", content: "Editor e customização · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Personalize clubes, jogadores e competições do jogo direto no navegador, sem login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
const POS_LABEL: Record<Position, string> = { GK: "Goleiro", DF: "Defensor", MF: "Meia", FW: "Atacante" };
const ROOFS: { id: RoofKind; label: string }[] = [
  { id: "aberto", label: "Sem cobertura" },
  { id: "parcial", label: "Cobertura parcial" },
  { id: "total", label: "Arena fechada" },
];
const CHANTS: { id: ChantKind; label: string }[] = [
  { id: "carnaval", label: "Carnaval" },
  { id: "operario", label: "Operária" },
  { id: "epico", label: "Épica" },
  { id: "silencioso", label: "Reservada" },
];
const FORMATS: CompetitionFormat[] = ["pontos-corridos", "mata-mata", "grupos-mata-mata"];

const labelCls = "mb-1 block text-xs uppercase tracking-wide text-muted-foreground";

function readImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("falha ao ler"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagem inválida"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("sem canvas"));
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function EditorPage() {
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
          <ElencosTab data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value="clubes">
          <ClubesTab data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value="competicoes">
          <CompeticoesTab data={data} onChange={refresh} />
        </TabsContent>
        <TabsContent value="io">
          <ImportExportTab data={data} onChange={refresh} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

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

function ElencosTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
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
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
        <div>
          <span className={labelCls}>Liga</span>
          <Select value={leagueId} onValueChange={onSelectLeague}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAGUES.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.flag} {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={labelCls}>Clube</span>
          <Select value={clubId} onValueChange={setClubId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {league.clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {club && <Crest club={club} size={40} />}
        <Button className="ml-auto" onClick={startCreate} disabled={!clubId}>
          Novo jogador
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-4">
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
                    player={{ ...p, number: p.number ?? 1, pace: 0, shooting: 0, passing: 0, defending: 0, physical: 0, condition: 0, morale: 0, goals: 0, assists: 0, apps: 0, yellows: 0, suspended: false, injuryWeeks: 0 } as never}
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
                    <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { removePlayer(p.id); onChange(); }}
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
        onSaved={() => { onChange(); setOpen(false); }}
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
  const set = <K extends keyof CustomPlayer>(k: K, v: CustomPlayer[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

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
              player={{ ...form, number: form.number ?? 1, pace: 0, shooting: 0, passing: 0, defending: 0, physical: 0, condition: 0, morale: 0, goals: 0, assists: 0, apps: 0, yellows: 0, suspended: false, injuryWeeks: 0 } as never}
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => <SelectItem key={p} value={p}>{POS_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Clube</span>
            <Select
              value={form.clubId}
              onValueChange={(v) => set("clubId", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {LEAGUES.map((l) => (
                  <optgroup key={l.id} label={l.name}>
                    {l.clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </optgroup>
                ))}
              </SelectContent>
            </Select>
            {league && <p className="mt-1 text-[10px] text-muted-foreground">Liga: {league.name}</p>}
          </div>
          <div>
            <span className={labelCls}>Número</span>
            <Input type="number" min={1} max={99} value={form.number ?? ""} onChange={(e) => set("number", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <span className={labelCls}>Idade</span>
            <Input type="number" min={15} max={44} value={form.age} onChange={(e) => set("age", Number(e.target.value))} />
          </div>
          <div>
            <span className={labelCls}>Overall (35-99)</span>
            <Input type="number" min={35} max={99} value={form.ovr} onChange={(e) => set("ovr", Number(e.target.value))} />
          </div>
          <div>
            <span className={labelCls}>Potencial (0-99)</span>
            <Input type="number" min={0} max={99} value={form.potential ?? ""} onChange={(e) => set("potential", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <span className={labelCls}>Nacionalidade</span>
            <Input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value || undefined)} />
          </div>
          <div>
            <span className={labelCls}>Personalidade</span>
            <Select value={form.personality ?? "__none"} onValueChange={(v) => set("personality", v === "__none" ? undefined : (v as Personality))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Automática</SelectItem>
                {PERSONALITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Contrato (anos)</span>
            <Input type="number" min={1} max={6} value={form.contractYears} onChange={(e) => set("contractYears", Number(e.target.value))} />
          </div>
          <div>
            <span className={labelCls}>Salário semanal (M€)</span>
            <Input type="number" step="0.05" min={0} value={form.wage} onChange={(e) => set("wage", Number(e.target.value))} />
          </div>
          <div>
            <span className={labelCls}>Valor de mercado (M€)</span>
            <Input type="number" step="0.5" min={0} value={form.value} onChange={(e) => set("value", Number(e.target.value))} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar jogador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =============================================================== CLUBES === */

function ClubesTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = useMemo(() => LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0]!, [leagueId]);
  const [clubId, setClubId] = useState(league.clubs[0]?.id ?? "");
  const base = CLUBS[clubId];
  const saved = data.clubs[clubId];

  const [form, setForm] = useState<ClubOverride>(() => buildClubForm(clubId));
  const [msg, setMsg] = useState("");
  const loadedFor = useRef<string>("");

  function buildClubForm(id: string): ClubOverride {
    const b = CLUBS[id];
    const o = data.clubs[id];
    return {
      id,
      name: o?.name ?? b?.name ?? "",
      short: o?.short ?? b?.short ?? "",
      primary: o?.primary ?? b?.primary ?? "#0a8f3c",
      secondary: o?.secondary ?? b?.secondary ?? "#ffffff",
      ...(o?.badge ? { badge: o.badge } : {}),
      force: o?.force ?? b?.strength ?? 70,
      crest: o?.crest ?? { shape: "shield", pattern: "sash", emblem: "ball", founded: 1990 },
      kit: o?.kit ?? { pattern: "stripes", base: b?.primary ?? "#0a8f3c", detail: b?.secondary ?? "#ffffff", shorts: "#ffffff", socks: "#0a8f3c", awayBase: "#ffffff", awayDetail: "#0a8f3c" },
      stadium: o?.stadium ?? { name: `Estádio ${b?.short ?? ""}`, capacity: 40000, roof: "parcial", seatColor: "#1d6b3f" },
      fans: o?.fans ?? { size: 1, chant: "carnaval", flagA: b?.primary ?? "#0a8f3c", flagB: "#ffffff" },
    };
  }

  if (loadedFor.current !== clubId) {
    loadedFor.current = clubId;
    setForm(buildClubForm(clubId));
  }

  function onSelectLeague(id: string) {
    setLeagueId(id);
    const first = LEAGUES.find((l) => l.id === id)?.clubs[0];
    if (first) setClubId(first.id);
  }

  const set = <K extends keyof ClubOverride>(k: K, v: ClubOverride[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setKit = (patch: Partial<NonNullable<ClubOverride["kit"]>>) => setForm((f) => ({ ...f, kit: { ...f.kit!, ...patch } }));
  const setCrest = (patch: Partial<NonNullable<ClubOverride["crest"]>>) => setForm((f) => ({ ...f, crest: { ...f.crest!, ...patch } }));
  const setStadium = (patch: Partial<NonNullable<ClubOverride["stadium"]>>) => setForm((f) => ({ ...f, stadium: { ...f.stadium!, ...patch } }));
  const setFans = (patch: Partial<NonNullable<ClubOverride["fans"]>>) => setForm((f) => ({ ...f, fans: { ...f.fans!, ...patch } }));

  const previewClub = { id: clubId, name: form.name || "Clube", short: form.short || "CLU", league: leagueId, primary: form.primary, secondary: form.secondary, strength: form.force ?? 70 };

  function save() {
    if (!form.name.trim()) {
      setMsg("Dê um nome ao clube.");
      return;
    }
    upsertClub({ ...form, name: form.name.trim(), short: (form.short.trim() || form.name.trim().slice(0, 3)).toUpperCase().slice(0, 4) });
    setMsg("Clube salvo.");
    onChange();
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4 rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <span className={labelCls}>Liga</span>
            <Select value={leagueId} onValueChange={onSelectLeague}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAGUES.map((l) => <SelectItem key={l.id} value={l.id}>{l.flag} {l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Clube</span>
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {league.clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Nome</span>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Sigla</span>
            <Input maxLength={4} value={form.short} onChange={(e) => set("short", e.target.value.toUpperCase())} />
          </div>
          <div>
            <span className={labelCls}>Cor principal</span>
            <Input type="color" value={form.primary} onChange={(e) => set("primary", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Cor secundária</span>
            <Input type="color" value={form.secondary} onChange={(e) => set("secondary", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Força geral: {form.force}</span>
            <input type="range" min={35} max={99} className="w-full accent-primary" value={form.force} onChange={(e) => set("force", Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Escudo enviado (imagem, opcional)</span>
            <Input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) set("badge", await readImage(f, 128));
            }} />
            {form.badge && (
              <button type="button" className="mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => set("badge", undefined)}>
                remover imagem enviada (voltar a usar escudo vetorial)
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Escudo vetorial</p>
          <div className="grid gap-3">
            <Chips label="Formato" value={form.crest!.shape} onChange={(v) => setCrest({ shape: v })} options={CREST_SHAPES.map((s) => ({ id: s, label: s }))} />
            <Chips label="Estampa" value={form.crest!.pattern} onChange={(v) => setCrest({ pattern: v })} options={CREST_PATTERNS.map((s) => ({ id: s, label: s }))} />
            <Chips label="Símbolo" value={form.crest!.emblem} onChange={(v) => setCrest({ emblem: v })} options={CREST_EMBLEMS.map((s) => ({ id: s, label: EMBLEM_LABEL[s] }))} />
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Uniforme</p>
          <Chips label="Padrão" value={form.kit!.pattern} onChange={(v) => setKit({ pattern: v })} options={KIT_PATTERNS.map((s) => ({ id: s, label: s }))} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><span className={labelCls}>Calção</span><Input type="color" value={form.kit!.shorts} onChange={(e) => setKit({ shorts: e.target.value })} /></div>
            <div><span className={labelCls}>Meião</span><Input type="color" value={form.kit!.socks} onChange={(e) => setKit({ socks: e.target.value })} /></div>
            <div><span className={labelCls}>Camisa reserva</span><Input type="color" value={form.kit!.awayBase} onChange={(e) => setKit({ awayBase: e.target.value })} /></div>
            <div><span className={labelCls}>Detalhe reserva</span><Input type="color" value={form.kit!.awayDetail} onChange={(e) => setKit({ awayDetail: e.target.value })} /></div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Estádio e torcida</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><span className={labelCls}>Nome do estádio</span><Input value={form.stadium!.name} onChange={(e) => setStadium({ name: e.target.value })} /></div>
            <div>
              <span className={labelCls}>Capacidade: {form.stadium!.capacity.toLocaleString("pt-BR")}</span>
              <input type="range" min={8000} max={90000} step={1000} className="w-full accent-primary" value={form.stadium!.capacity} onChange={(e) => setStadium({ capacity: Number(e.target.value) })} />
            </div>
          </div>
          <div className="mt-3"><Chips label="Cobertura" value={form.stadium!.roof} onChange={(v) => setStadium({ roof: v })} options={ROOFS} /></div>
          <div className="mt-3"><Chips label="Clima na torcida" value={form.fans!.chant} onChange={(v) => setFans({ chant: v })} options={CHANTS} /></div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>Salvar clube</Button>
          {saved && (
            <Button variant="outline" onClick={() => { removeClub(clubId); setMsg("Personalização removida."); onChange(); }}>
              Restaurar original
            </Button>
          )}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4 text-center">
        <h2 className="font-display text-sm uppercase tracking-wide">Prévia</h2>
        <div className="flex justify-center">
          {form.badge ? (
            <img src={form.badge} alt={form.name} className="h-20 w-20 rounded object-contain" />
          ) : (
            <Crest club={previewClub} size={80} detail="full" />
          )}
        </div>
        <p className="font-display text-lg">{form.name || base?.name}</p>
        <p className="text-xs text-muted-foreground">{form.stadium?.name} · força {form.force}</p>
      </aside>
    </div>
  );
}

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

function CompeticoesTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [editing, setEditing] = useState<CustomCompetition | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(EMPTY_COMP()); setOpen(true); }}>Nova competição</Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-4">
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
                    <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => { removeCompetition(c.id); onChange(); }}>Excluir</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CompetitionDialog open={open} onOpenChange={setOpen} comp={editing} onSaved={() => { onChange(); setOpen(false); }} />
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

  const set = <K extends keyof CustomCompetition>(k: K, v: CustomCompetition[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function toggleClub(id: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.clubIds.includes(id);
      return { ...f, clubIds: has ? f.clubIds.filter((c) => c !== id) : [...f.clubIds, id] };
    });
  }

  function save() {
    if (!form) return;
    if (!form.name.trim()) { setError("Dê um nome à competição."); return; }
    if (form.clubIds.length < 2) { setError("Escolha pelo menos 2 clubes."); return; }
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
            <Select value={form.format} onValueChange={(v) => set("format", v as CompetitionFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => <SelectItem key={f} value={f}>{FORMAT_LABEL[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Rebaixados</span>
            <Input type="number" min={0} max={6} value={form.relegated} onChange={(e) => set("relegated", Number(e.target.value))} />
          </div>
          <div>
            <span className={labelCls}>Vagas continentais</span>
            <Input type="number" min={0} max={6} value={form.continentalSlots} onChange={(e) => set("continentalSlots", Number(e.target.value))} />
          </div>
        </div>

        <div>
          <span className={labelCls}>Clubes participantes ({form.clubIds.length})</span>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50 p-2">
            {LEAGUES.map((l) => (
              <div key={l.id} className="mb-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{l.name}</p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar competição</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================== IMPORTAR / EXPORTAR === */

function ImportExportTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
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

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
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
      <div className="rounded-xl border border-border/60 bg-card/70 p-5">
        <h2 className="font-display text-sm uppercase tracking-wide">Exportar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe um arquivo .json com todos os clubes, jogadores e competições que você cadastrou.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {Object.keys(data.clubs).length} clube(s) · {data.players.length} jogador(es) · {data.competitions.length} competição(ões)
        </p>
        <Button className="mt-4" onClick={download}>Baixar arquivo .json</Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-5">
        <h2 className="font-display text-sm uppercase tracking-wide">Importar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe um arquivo exportado anteriormente. Isso substitui os dados salvos neste navegador.
        </p>
        <Input ref={fileRef} type="file" accept="application/json" className="mt-4" onChange={onImport} />
        {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
