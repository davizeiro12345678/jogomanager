import { Crest } from "@/components/game/Crest";
import { Chips } from "@/components/game/CrestBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CREST_EMBLEMS,
  CREST_PATTERNS,
  CREST_SHAPES,
  EMBLEM_LABEL,
  KIT_PATTERNS,
} from "@/game/crest-options";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import { removeClub, upsertClub, type ClubOverride, type CustomData } from "@/lib/customData";
import { useMemo, useRef, useState } from "react";
import { CHANTS, labelCls, readImage, ROOFS } from "./shared";

/* =============================================================== CLUBES === */

export default function ClubsTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
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
      kit: o?.kit ?? {
        pattern: "stripes",
        base: b?.primary ?? "#0a8f3c",
        detail: b?.secondary ?? "#ffffff",
        shorts: "#ffffff",
        socks: "#0a8f3c",
        awayBase: "#ffffff",
        awayDetail: "#0a8f3c",
      },
      stadium: o?.stadium ?? {
        name: `Estádio ${b?.short ?? ""}`,
        capacity: 40000,
        roof: "parcial",
        seatColor: "#1d6b3f",
      },
      fans: o?.fans ?? {
        size: 1,
        chant: "carnaval",
        flagA: b?.primary ?? "#0a8f3c",
        flagB: "#ffffff",
      },
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

  const set = <K extends keyof ClubOverride>(k: K, v: ClubOverride[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setKit = (patch: Partial<NonNullable<ClubOverride["kit"]>>) =>
    setForm((f) => ({ ...f, kit: { ...f.kit!, ...patch } }));
  const setCrest = (patch: Partial<NonNullable<ClubOverride["crest"]>>) =>
    setForm((f) => ({ ...f, crest: { ...f.crest!, ...patch } }));
  const setStadium = (patch: Partial<NonNullable<ClubOverride["stadium"]>>) =>
    setForm((f) => ({ ...f, stadium: { ...f.stadium!, ...patch } }));
  const setFans = (patch: Partial<NonNullable<ClubOverride["fans"]>>) =>
    setForm((f) => ({ ...f, fans: { ...f.fans!, ...patch } }));

  const previewClub = {
    id: clubId,
    name: form.name || "Clube",
    short: form.short || "CLU",
    league: leagueId,
    primary: form.primary,
    secondary: form.secondary,
    strength: form.force ?? 70,
  };

  function save() {
    if (!form.name.trim()) {
      setMsg("Dê um nome ao clube.");
      return;
    }
    upsertClub({
      ...form,
      name: form.name.trim(),
      short: (form.short.trim() || form.name.trim().slice(0, 3)).toUpperCase().slice(0, 4),
    });
    setMsg("Clube salvo.");
    onChange();
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4 rounded-xl border border-border/60 surface-card p-4">
        <div className="flex flex-wrap gap-3">
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Nome</span>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Sigla</span>
            <Input
              maxLength={4}
              value={form.short}
              onChange={(e) => set("short", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <span className={labelCls}>Cor principal</span>
            <Input
              type="color"
              value={form.primary}
              onChange={(e) => set("primary", e.target.value)}
            />
          </div>
          <div>
            <span className={labelCls}>Cor secundária</span>
            <Input
              type="color"
              value={form.secondary}
              onChange={(e) => set("secondary", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Força geral: {form.force}</span>
            <input
              type="range"
              min={35}
              max={99}
              className="w-full accent-primary"
              value={form.force}
              onChange={(e) => set("force", Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Escudo enviado (imagem, opcional)</span>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) set("badge", await readImage(f, 128));
              }}
            />
            {form.badge && (
              <button
                type="button"
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => set("badge", undefined)}
              >
                remover imagem enviada (voltar a usar escudo vetorial)
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Escudo vetorial</p>
          <div className="grid gap-3">
            <Chips
              label="Formato"
              value={form.crest!.shape}
              onChange={(v) => setCrest({ shape: v })}
              options={CREST_SHAPES.map((s) => ({ id: s, label: s }))}
            />
            <Chips
              label="Estampa"
              value={form.crest!.pattern}
              onChange={(v) => setCrest({ pattern: v })}
              options={CREST_PATTERNS.map((s) => ({ id: s, label: s }))}
            />
            <Chips
              label="Símbolo"
              value={form.crest!.emblem}
              onChange={(v) => setCrest({ emblem: v })}
              options={CREST_EMBLEMS.map((s) => ({ id: s, label: EMBLEM_LABEL[s] }))}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Uniforme</p>
          <Chips
            label="Padrão"
            value={form.kit!.pattern}
            onChange={(v) => setKit({ pattern: v })}
            options={KIT_PATTERNS.map((s) => ({ id: s, label: s }))}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Calção</span>
              <Input
                type="color"
                value={form.kit!.shorts}
                onChange={(e) => setKit({ shorts: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>Meião</span>
              <Input
                type="color"
                value={form.kit!.socks}
                onChange={(e) => setKit({ socks: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>Camisa reserva</span>
              <Input
                type="color"
                value={form.kit!.awayBase}
                onChange={(e) => setKit({ awayBase: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>Detalhe reserva</span>
              <Input
                type="color"
                value={form.kit!.awayDetail}
                onChange={(e) => setKit({ awayDetail: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Estádio e torcida</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Nome do estádio</span>
              <Input
                value={form.stadium!.name}
                onChange={(e) => setStadium({ name: e.target.value })}
              />
            </div>
            <div>
              <span className={labelCls}>
                Capacidade: {form.stadium!.capacity.toLocaleString("pt-BR")}
              </span>
              <input
                type="range"
                min={8000}
                max={90000}
                step={1000}
                className="w-full accent-primary"
                value={form.stadium!.capacity}
                onChange={(e) => setStadium({ capacity: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-3">
            <Chips
              label="Cobertura"
              value={form.stadium!.roof}
              onChange={(v) => setStadium({ roof: v })}
              options={ROOFS}
            />
          </div>
          <div className="mt-3">
            <Chips
              label="Clima na torcida"
              value={form.fans!.chant}
              onChange={(v) => setFans({ chant: v })}
              options={CHANTS}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>Salvar clube</Button>
          {saved && (
            <Button
              variant="outline"
              onClick={() => {
                removeClub(clubId);
                setMsg("Personalização removida.");
                onChange();
              }}
            >
              Restaurar original
            </Button>
          )}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-border/60 surface-card p-4 text-center">
        <h2 className="font-display text-sm uppercase tracking-wide">Prévia</h2>
        <div className="flex justify-center">
          {form.badge ? (
            <img src={form.badge} alt={form.name} className="h-20 w-20 rounded object-contain" />
          ) : (
            <Crest club={previewClub} size={80} detail="full" />
          )}
        </div>
        <p className="font-display text-lg">{form.name || base?.name}</p>
        <p className="text-xs text-muted-foreground">
          {form.stadium?.name} · força {form.force}
        </p>
      </aside>
    </div>
  );
}
