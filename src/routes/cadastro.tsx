import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { LEAGUES, getLeague, CLUBS } from "@/game/data/leagues";
import type { Position } from "@/game/types";
import {
  applyCustomToWorld,
  readCustom,
  removeClub,
  removePlayer,
  upsertClub,
  upsertPlayer,
  type CustomData,
  type CustomPlayer,
} from "@/lib/customData";

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Cadastrar clubes e jogadores · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Cadastre seus clubes e jogadores: nome, escudo, cores do uniforme, posição, idade, contrato, salário e valor de mercado.",
      },
      { property: "og:title", content: "Cadastro de clubes e jogadores · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Monte seu próprio banco de clubes e jogadores para usar na carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroPage,
});

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
const POS_LABEL: Record<Position, string> = {
  GK: "Goleiro",
  DF: "Defensor",
  MF: "Meia",
  FW: "Atacante",
};

/** lê um arquivo de imagem e devolve um data URL quadrado e leve */
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

const inputCls =
  "w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs uppercase tracking-wide text-muted-foreground";

function CadastroPage() {
  const [tab, setTab] = useState<"clubes" | "jogadores">("clubes");
  const [data, setData] = useState<CustomData>({ clubs: {}, players: [], competitions: [] });

  useEffect(() => {
    applyCustomToWorld();
    setData(readCustom());
  }, []);

  const refresh = () => setData(readCustom());

  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-4xl uppercase tracking-wide">Meus dados</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Personalize clubes com nome, cores e escudo próprios e cadastre jogadores com foto,
          posição, contrato e valor. Tudo isso é usado quando você começa uma nova carreira.
        </p>

        <div className="mt-6 flex gap-2">
          {(["clubes", "jogadores"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg border px-4 py-2 font-display text-sm uppercase tracking-wide transition ${
                tab === t
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
          <Link
            to="/new"
            className="ml-auto rounded-lg border border-border bg-card/60 px-4 py-2 font-display text-sm uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
          >
            Começar carreira
          </Link>
        </div>

        {tab === "clubes" ? (
          <ClubTab data={data} onChange={refresh} />
        ) : (
          <PlayerTab data={data} onChange={refresh} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- clubes */

function ClubTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = getLeague(leagueId);
  const [clubId, setClubId] = useState(league.clubs[0]!.id);
  const club = CLUBS[clubId];

  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [primary, setPrimary] = useState("#0a8f3c");
  const [secondary, setSecondary] = useState("#ffffff");
  const [badge, setBadge] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const first = league.clubs[0];
    if (first && !league.clubs.some((c) => c.id === clubId)) setClubId(first.id);
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const saved = data.clubs[clubId];
    const base = CLUBS[clubId];
    setName(saved?.name ?? base?.name ?? "");
    setShort(saved?.short ?? base?.short ?? "");
    setPrimary(saved?.primary ?? base?.primary ?? "#0a8f3c");
    setSecondary(saved?.secondary ?? base?.secondary ?? "#ffffff");
    setBadge(saved?.badge);
  }, [clubId, data]);

  function save() {
    if (!name.trim()) {
      setMsg("Dê um nome ao clube.");
      return;
    }
    upsertClub({
      id: clubId,
      name: name.trim(),
      short: short.trim() || name.trim().slice(0, 3),
      primary,
      secondary,
      ...(badge ? { badge } : {}),
    });
    setMsg("Clube salvo.");
    onChange();
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="liga">Liga</label>
            <select
              id="liga"
              className={inputCls}
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {LEAGUES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="clube">Clube que você quer personalizar</label>
            <select
              id="clube"
              className={inputCls}
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
            >
              {league.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="nome">Nome</label>
            <input id="nome" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sigla">Sigla (3 letras)</label>
            <input
              id="sigla"
              className={inputCls}
              maxLength={4}
              value={short}
              onChange={(e) => setShort(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="cor1">Cor principal do uniforme</label>
            <input id="cor1" type="color" className={`${inputCls} h-11 p-1`} value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="cor2">Cor secundária</label>
            <input id="cor2" type="color" className={`${inputCls} h-11 p-1`} value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="escudo">Escudo (imagem)</label>
            <input
              id="escudo"
              type="file"
              accept="image/*"
              className={inputCls}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setBadge(await readImage(f, 128));
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            className="rounded-lg bg-primary px-5 py-2 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Salvar clube
          </button>
          {data.clubs[clubId] && (
            <button
              onClick={() => {
                removeClub(clubId);
                setMsg("Personalização removida.");
                onChange();
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Restaurar original
            </button>
          )}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <h2 className="font-display text-sm uppercase tracking-wide">Prévia</h2>
        <div className="mt-4 flex items-center gap-3">
          {badge ? (
            <img src={badge} alt={`Escudo de ${name}`} className="h-12 w-12 rounded object-cover" />
          ) : (
            club && <Crest club={club} size={48} />
          )}
          <div>
            <p className="font-display text-lg leading-tight">{name || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{short || "---"}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="h-8 flex-1 rounded" style={{ background: primary }} />
          <span className="h-8 flex-1 rounded" style={{ background: secondary }} />
        </div>

        <h2 className="mt-6 font-display text-sm uppercase tracking-wide">Clubes personalizados</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.values(data.clubs).length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum ainda.</li>
          )}
          {Object.values(data.clubs).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{c.name}</span>
              <button
                onClick={() => {
                  removeClub(c.id);
                  onChange();
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- jogadores */

function PlayerTab({ data, onChange }: { data: CustomData; onChange: () => void }) {
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = getLeague(leagueId);
  const [clubId, setClubId] = useState(league.clubs[0]!.id);

  const [name, setName] = useState("");
  const [pos, setPos] = useState<Position>("FW");
  const [age, setAge] = useState(24);
  const [ovr, setOvr] = useState(78);
  const [contractYears, setContractYears] = useState(3);
  const [wage, setWage] = useState(0.3);
  const [value, setValue] = useState(20);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const first = league.clubs[0];
    if (first && !league.clubs.some((c) => c.id === clubId)) setClubId(first.id);
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    if (!name.trim()) {
      setMsg("Informe o nome do jogador.");
      return;
    }
    const player: CustomPlayer = {
      id: `custom-${clubId}-${Date.now().toString(36)}`,
      clubId,
      name: name.trim(),
      pos,
      age,
      ovr,
      contractYears,
      wage,
      value,
      ...(photo ? { photo } : {}),
    };
    upsertPlayer(player);
    setName("");
    setPhoto(undefined);
    setMsg("Jogador cadastrado.");
    onChange();
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="pliga">Liga</label>
            <select id="pliga" className={inputCls} value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
              {LEAGUES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pclube">Clube</label>
            <select id="pclube" className={inputCls} value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {league.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pnome">Nome</label>
            <input id="pnome" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ppos">Posição</label>
            <select id="ppos" className={inputCls} value={pos} onChange={(e) => setPos(e.target.value as Position)}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POS_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pidade">Idade</label>
            <input id="pidade" type="number" min={15} max={44} className={inputCls} value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="povr">Nível geral (35–99)</label>
            <input id="povr" type="number" min={35} max={99} className={inputCls} value={ovr} onChange={(e) => setOvr(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pcont">Contrato (anos)</label>
            <input id="pcont" type="number" min={1} max={6} className={inputCls} value={contractYears} onChange={(e) => setContractYears(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="psal">Salário semanal (milhões)</label>
            <input id="psal" type="number" step="0.05" min={0} className={inputCls} value={wage} onChange={(e) => setWage(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pval">Valor de mercado (milhões)</label>
            <input id="pval" type="number" step="0.5" min={0} className={inputCls} value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pfoto">Foto</label>
            <input
              id="pfoto"
              type="file"
              accept="image/*"
              className={inputCls}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(await readImage(f, 160));
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            className="rounded-lg bg-primary px-5 py-2 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Cadastrar jogador
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <h2 className="font-display text-sm uppercase tracking-wide">Jogadores cadastrados</h2>
        <ul className="mt-3 space-y-3">
          {data.players.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum ainda.</li>
          )}
          {data.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              {p.photo ? (
                <img src={p.photo} alt={p.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs">
                  {p.pos}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {POS_LABEL[p.pos]} · {p.ovr} · {CLUBS[p.clubId]?.name ?? p.clubId}
                </p>
              </div>
              <button
                onClick={() => {
                  removePlayer(p.id);
                  onChange();
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Ao começar uma carreira, esses jogadores entram no elenco do clube escolhido.
        </p>
      </div>
    </div>
  );
}
