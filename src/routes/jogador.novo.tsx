import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
import { AthleteHero3D } from "@/components/game/players/AthleteHero3D";
import { LEAGUES } from "@/game/data/leagues";
import { POSITION_LABEL } from "@/game/player-career/attributes";
import { createAthlete, rngFrom } from "@/game/player-career/engine";
import type { AthletePersonality, BodyBuild, CareerOrigin, PlayerPosition } from "@/game/player-career/types";
import { useAthlete } from "@/hooks/useAthlete";
import "@/components/game/athlete.css";

export const Route = createFileRoute("/jogador/novo")({
  ssr: false,
  validateSearch: z.object({ slot: z.number().int().min(1).max(3).catch(1) }),
  head: () => ({
    meta: [
      { title: "Criar atleta — Football Manager 3D" },
      { name: "description", content: "Monte seu jogador: posição, físico, aparência, personalidade e origem." },
      { property: "og:title", content: "Criar atleta — Football Manager 3D" },
      { property: "og:description", content: "Escolha de onde você vem e comece sua carreira no futebol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreateAthletePage,
});

const SKINS = ["#f4d3b5", "#e2b48c", "#c68a5d", "#a0673f", "#7a4a2a", "#4e2e1a"];
const HAIR_COLORS = ["#1b1410", "#4a2f1d", "#8a5a2b", "#d8b46a", "#b5b5b5"];
const HAIR_STYLES = ["Raspado", "Degradê", "Curto", "Cacheado", "Black", "Tranças", "Coque", "Moicano", "Ondulado", "Longo"];
const NATIONS = ["Brasil", "Argentina", "Portugal", "Uruguai", "Colômbia", "Espanha", "Inglaterra", "França", "Itália", "Alemanha", "Estados Unidos", "México"];
const POSITIONS: PlayerPosition[] = ["GOL", "ZAG", "LAT", "VOL", "MEI", "PON", "ATA"];
const ORIGINS: { id: CareerOrigin; label: string; hint: string }[] = [
  { id: "base", label: "Base do clube", hint: "Começa mais pronto, com confiança do técnico." },
  { id: "peneira", label: "Peneira", hint: "Você escolhe entre 3 clubes que te aprovaram." },
  { id: "varzea", label: "Várzea", hint: "Começa mais fraco, mas com potencial maior." },
];
const PERSONALITIES: { id: AthletePersonality; label: string; hint: string }[] = [
  { id: "profissional", label: "Profissional", hint: "Rende mais nos treinos" },
  { id: "ambicioso", label: "Ambicioso", hint: "Cresce rápido, odeia o banco" },
  { id: "leal", label: "Leal", hint: "Técnico confia mais" },
  { id: "temperamental", label: "Temperamental", hint: "Imprevisível" },
];

function CreateAthletePage() {
  const { slot } = Route.useSearch();
  const navigate = useNavigate();
  const { commit } = useAthlete(slot);
  const slotId = slot as 1 | 2 | 3;
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [nation, setNation] = useState("Brasil");
  const [hometown, setHometown] = useState("");
  const [position, setPosition] = useState<PlayerPosition>("ATA");
  const [foot, setFoot] = useState<"direito" | "esquerdo">("direito");
  const [heightCm, setHeight] = useState(180);
  const [build, setBuild] = useState<BodyBuild>("atletico");
  const [personality, setPersonality] = useState<AthletePersonality>("profissional");
  const [origin, setOrigin] = useState<CareerOrigin>("base");
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [clubId, setClubId] = useState(LEAGUES[0]!.clubs[0]?.id ?? "");
  const [skin, setSkin] = useState(2);
  const [hair, setHair] = useState(1);
  const [hairColor, setHairColor] = useState(0);
  const [beard, setBeard] = useState(0);
  const [shirt, setShirt] = useState(9);
  const [error, setError] = useState<string | null>(null);

  const league = LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0]!;
  const clubPool = useMemo(() => {
    const sorted = [...league.clubs].sort((a, b) => a.strength - b.strength);
    if (origin === "peneira") {
      const r = rngFrom(`${name}|${leagueId}|peneira`);
      const weak = sorted.slice(0, Math.max(3, Math.ceil(sorted.length / 2)));
      const pick = new Set<number>();
      while (pick.size < Math.min(3, weak.length)) pick.add(Math.floor(r() * weak.length));
      return [...pick].map((i) => weak[i]!);
    }
    if (origin === "varzea") return sorted.slice(0, Math.min(4, sorted.length));
    return league.clubs;
  }, [league, origin, name, leagueId]);
  const club = clubPool.find((c) => c.id === clubId) ?? clubPool[0];
  const previewAthlete = useMemo(() => ({
    seed: `preview-${name || "novo"}-${skin}-${hair}-${hairColor}-${beard}`,
    nickname: nickname || name.split(" ")[0] || "ATLETA",
    clubId: club?.id ?? "fla",
    position,
    shirtNumber: shirt,
    heightCm,
    weightKg: Math.round((heightCm - 100) * (build === "forte" ? 0.98 : build === "leve" ? 0.82 : 0.9)),
    build,
    appearance: { skin, hair, hairColor, beard, boots: 0 },
  }), [name, nickname, club?.id, position, shirt, heightCm, build, skin, hair, hairColor, beard]);

  const submit = () => {
    if (name.trim().length < 2) return setError("Digite o nome do atleta (pelo menos 2 letras).");
    if (!club) return setError("Escolha um clube.");
    const state = createAthlete({ slot: slotId, name, nickname, nation, hometown, position, foot, heightCm, build, personality, origin, clubId: club.id, appearance: { skin, hair, hairColor, beard, boots: 0 }, shirtNumber: shirt });
    commit(state);
    void navigate({ to: "/jogador/painel", search: { slot } });
  };

  return (
    <main className="athlete-shell" style={{ ["--club" as string]: club?.primary }}>
      <div className="athlete-wrap">
        <div className="athlete-top">
          <Button asChild variant="ghost" size="sm"><Link to="/jogador"><ArrowLeft className="size-4" /> Voltar</Link></Button>
        </div>
        <h1 className="text-3xl font-bold">Criar atleta</h1>
        <div className="athlete-grid">
          <section className="athlete-card athlete-form" aria-label="Dados do atleta">
            <h2 className="text-lg font-bold">Identidade</h2>
            <label className="athlete-field"><span>Nome completo</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Davi Andrian" /></label>
            <label className="athlete-field"><span>Nome na camisa</span><input value={nickname} maxLength={16} onChange={(e) => setNickname(e.target.value)} placeholder="Ex.: Davi" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="athlete-field"><span>País</span><select value={nation} onChange={(e) => setNation(e.target.value)}>{NATIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
              <label className="athlete-field"><span>Cidade natal</span><input value={hometown} maxLength={40} onChange={(e) => setHometown(e.target.value)} /></label>
            </div>
            <h2 className="text-lg font-bold">Posição e físico</h2>
            <div className="athlete-chips" role="group" aria-label="Posição">
              {POSITIONS.map((p) => <button key={p} type="button" className="athlete-chip" aria-pressed={position === p} onClick={() => setPosition(p)}>{POSITION_LABEL[p]}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="athlete-field"><span>Pé bom</span><select value={foot} onChange={(e) => setFoot(e.target.value as "direito" | "esquerdo")}><option value="direito">Direito</option><option value="esquerdo">Esquerdo</option></select></label>
              <label className="athlete-field"><span>Altura: {heightCm} cm</span><input type="range" min={160} max={200} value={heightCm} onChange={(e) => setHeight(Number(e.target.value))} /></label>
            </div>
            <div className="athlete-chips" role="group" aria-label="Biotipo">
              {(["leve", "atletico", "forte"] as BodyBuild[]).map((b) => <button key={b} type="button" className="athlete-chip" aria-pressed={build === b} onClick={() => setBuild(b)}>{b === "leve" ? "Leve e rápido" : b === "forte" ? "Forte" : "Atlético"}</button>)}
            </div>
            <h2 className="text-lg font-bold">Personalidade</h2>
            <div className="athlete-chips" role="group" aria-label="Personalidade">
              {PERSONALITIES.map((p) => <button key={p.id} type="button" className="athlete-chip" aria-pressed={personality === p.id} onClick={() => setPersonality(p.id)}>{p.label}<br /><small className="athlete-meta">{p.hint}</small></button>)}
            </div>
            <h2 className="text-lg font-bold">Origem e clube</h2>
            <div className="athlete-chips" role="group" aria-label="Origem">
              {ORIGINS.map((o) => <button key={o.id} type="button" className="athlete-chip" aria-pressed={origin === o.id} onClick={() => setOrigin(o.id)}>{o.label}<br /><small className="athlete-meta">{o.hint}</small></button>)}
            </div>
            <label className="athlete-field"><span>Liga</span><select value={leagueId} onChange={(e) => { setLeagueId(e.target.value); setClubId(""); }}>{LEAGUES.filter((l) => l.clubs.length >= 6).map((l) => <option key={l.id} value={l.id}>{l.flag} {l.name}</option>)}</select></label>
            <div className="athlete-chips" role="group" aria-label="Clube">
              {clubPool.map((c) => (
                <button key={c.id} type="button" className="athlete-chip flex items-center gap-2" aria-pressed={club?.id === c.id} onClick={() => setClubId(c.id)}>
                  <Crest club={c} size={26} /> {c.short}
                </button>
              ))}
            </div>
          </section>
          <section className="athlete-card athlete-form" aria-label="Aparência">
            <div className="athlete-section-heading"><div><p className="athlete-eyebrow">Modelo Hero</p><h2 className="text-lg font-bold">Aparência 3D</h2></div><span className="athlete-quality-badge">Alta qualidade</span></div>
            <AthleteHero3D athlete={previewAthlete} className="athlete-3d-preview" />
            <div className="athlete-field"><span>Tom de pele</span><div className="athlete-chips">{SKINS.map((c, i) => <Button key={c} type="button" variant="outline" size="icon" className="athlete-swatch" aria-label={`Tom ${i + 1}`} aria-pressed={skin === i} style={{ background: c }} onClick={() => setSkin(i)} />)}</div></div>
            <label className="athlete-field"><span>Cabelo</span><select value={hair} onChange={(e) => setHair(Number(e.target.value))}>{HAIR_STYLES.map((h, i) => <option key={h} value={i}>{h}</option>)}</select></label>
            <div className="athlete-field"><span>Cor do cabelo</span><div className="athlete-chips">{HAIR_COLORS.map((c, i) => <Button key={c} type="button" variant="outline" size="icon" className="athlete-swatch" aria-label={`Cor ${i + 1}`} aria-pressed={hairColor === i} style={{ background: c }} onClick={() => setHairColor(i)} />)}</div></div>
            <label className="athlete-field"><span>Barba</span><select value={beard} onChange={(e) => setBeard(Number(e.target.value))}>{["Sem barba", "Rala", "Média", "Cheia"].map((b, i) => <option key={b} value={i}>{b}</option>)}</select></label>
            <label className="athlete-field"><span>Número da camisa</span><input type="number" min={1} max={99} value={shirt} onChange={(e) => setShirt(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} /></label>
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          </section>
        </div>
      </div>
      <div className="athlete-sticky"><Button size="lg" onClick={submit}>Começar carreira</Button></div>
    </main>
  );
}
