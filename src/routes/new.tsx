import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { LEAGUES, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career";
import { Crest } from "@/components/game/Crest";
import { useCareer } from "@/hooks/useCareer";
import { loadRealSquad } from "@/lib/realSquads";
import { startWorldForNewCareer } from "@/lib/world";
import { Flag } from "@/components/game/Flag";
import { ManagerPortrait, HAIR_COLORS } from "@/components/game/ManagerPortrait";
import { Cutscene } from "@/components/game/Cutscene";
import { GuestCloudPrompt } from "@/components/GuestCloudPrompt";
import type {
  ManagerAttributes,
  ManagerLook,
  ManagerPersonality,
  ManagerProfile,
} from "@/game/types";

export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Criar treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Criar treinador · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewCareer,
});

const PERSONALITIES: { id: ManagerPersonality; label: string; desc: string }[] = [
  { id: "calmo", label: "Calmo", desc: "Diretoria mais paciente, elenco estável." },
  { id: "motivador", label: "Motivador", desc: "Moral do elenco sobe mais rápido." },
  { id: "durao", label: "Durão", desc: "Disciplina alta, mas desgasta estrelas." },
  { id: "tatico", label: "Tático", desc: "Time rende mais com a tática certa." },
  { id: "jovem", label: "Jovem promessa", desc: "Jovens crescem mais no treino." },
];

const ATTR_LABELS: { key: keyof ManagerAttributes; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defesa" },
  { key: "market", label: "Mercado" },
  { key: "squad", label: "Gestão de elenco" },
  { key: "media", label: "Imprensa" },
];

const TOTAL_POINTS = 30;

const STEP_LABELS = ["Identidade", "Aparência", "Perfil", "Clube"] as const;

function StepDots({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Etapas da criação">
      {STEP_LABELS.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => onGo(i)}
            disabled={i > step}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
              i === step
                ? "border-primary bg-primary/15 text-foreground"
                : i < step
                  ? "border-primary/50 text-muted-foreground hover:text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {i + 1}. {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Perfis prontos de habilidade, para quem não quer distribuir ponto a ponto. */
const ATTR_PRESETS: { id: string; label: string; attrs: ManagerAttributes }[] = [
  { id: "tecnico", label: "Treinador de campo", attrs: { attack: 8, defense: 8, market: 4, squad: 6, media: 4 } },
  { id: "negociador", label: "Negociador", attrs: { attack: 5, defense: 5, market: 9, squad: 6, media: 5 } },
  { id: "lider", label: "Líder de vestiário", attrs: { attack: 5, defense: 6, market: 4, squad: 9, media: 6 } },
  { id: "equilibrado", label: "Equilibrado", attrs: { attack: 6, defense: 6, market: 6, squad: 6, media: 6 } },
];

function NewCareer() {
  const navigate = useNavigate();
  const { update } = useCareer();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("Técnico");
  const [country, setCountry] = useState(LEAGUES[0]!.id);
  const [countrySearch, setCountrySearch] = useState("");
  // One button per country (LEAGUES has several leagues per country), Brazil pinned first.
  const countryOptions = useMemo(() => {
    const seen = new Map<string, (typeof LEAGUES)[number]>();
    for (const l of LEAGUES) if (!seen.has(l.country)) seen.set(l.country, l);
    const q = countrySearch.trim().toLowerCase();
    return [...seen.values()]
      .filter((l) => !q || l.country.toLowerCase().includes(q))
      .sort((a, b) =>
        a.country === "Brasil" ? -1 : b.country === "Brasil" ? 1 : a.country.localeCompare(b.country, "pt-BR"),
      );
  }, [countrySearch]);
  const [age, setAge] = useState(38);
  const [look, setLook] = useState<ManagerLook>({
    skin: 1,
    hair: 0,
    hairColor: HAIR_COLORS[0]!,
    beard: 0,
    outfit: 0,
  });
  const [personality, setPersonality] = useState<ManagerPersonality>("motivador");
  const [reputation, setReputation] = useState(3);
  const [attrs, setAttrs] = useState<ManagerAttributes>({
    attack: 6,
    defense: 6,
    market: 6,
    squad: 6,
    media: 6,
  });
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [loadingClub, setLoadingClub] = useState<string | null>(null);
  const [clubQuery, setClubQuery] = useState("");
  const [scene, setScene] = useState(false);
  const [pending, setPending] = useState<{ leagueId: string; clubId: string } | null>(null);

  const league = getLeague(leagueId);
  const queryText = clubQuery.trim().toLowerCase();
  const visibleLeagues = useMemo(
    () =>
      queryText
        ? LEAGUES.filter(
            (l) =>
              l.name.toLowerCase().includes(queryText) ||
              l.country.toLowerCase().includes(queryText) ||
              l.clubs.some((c) => c.name.toLowerCase().includes(queryText)),
          )
        : LEAGUES,
    [queryText],
  );
  const visibleClubs = useMemo(
    () =>
      queryText
        ? league.clubs.filter((c) => c.name.toLowerCase().includes(queryText))
        : league.clubs,
    [league, queryText],
  );
  const spent = useMemo(() => Object.values(attrs).reduce((a, b) => a + b, 0), [attrs]);
  const left = TOTAL_POINTS - spent;
  const maxStrength = 66 + reputation * 6; // reputação baixa limita clubes grandes (5★ libera todos)

  function setAttr(key: keyof ManagerAttributes, v: number) {
    const next = Math.max(1, Math.min(10, v));
    const delta = next - attrs[key];
    if (delta > left) return;
    setAttrs({ ...attrs, [key]: next });
  }

  function profile(clubId: string): ManagerProfile {
    return {
      name: name.trim() || "Técnico",
      country,
      age,
      favClub: clubId,
      look,
      personality,
      reputation,
      attrs,
      approval: 55 + reputation * 4,
    };
  }

  async function choose(clubId: string) {
    setLoadingClub(clubId);
    // Campanha nova = mundo novo: nada do save anterior é levado junto.
    startWorldForNewCareer(clubId);
    await loadRealSquad(clubId);
    update(initCareer(leagueId, clubId, name.trim() || "Técnico", profile(clubId)));
    setPending({ leagueId, clubId });
    setLoadingClub(null);
    setScene(true);
  }

  const accent = pending
    ? getLeague(pending.leagueId).clubs.find((c) => c.id === pending.clubId)?.primary
    : undefined;

  return (
    <main className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl uppercase tracking-wide">Novo treinador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quatro passos: identidade, aparência, perfil e clube.
        </p>
        <div className="mt-4 max-w-xl">
          <GuestCloudPrompt next="/new" compact />
        </div>
        <div className="mt-4">
          <StepDots step={step} onGo={setStep} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border border-border/60 surface-card p-4 text-center backdrop-blur">
            <ManagerPortrait look={look} size={140} className="mx-auto" />
            <p className="mt-3 font-display text-xl leading-tight">{name || "Técnico"}</p>
            <p className="text-xs text-muted-foreground">
              {getLeague(country).country} · {age} anos
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {PERSONALITIES.find((p) => p.id === personality)?.label} · reputação{" "}
              {"★".repeat(reputation)}
            </p>
          </aside>

          <section className="rounded-2xl border border-border/60 surface-card p-5 backdrop-blur">
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="manager-name" className="text-sm text-muted-foreground">
                    Seu nome
                  </label>
                  <input
                    id="manager-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="manager-age" className="text-sm text-muted-foreground">
                    Idade: {age}
                  </label>
                  <input
                    id="manager-age"
                    type="range"
                    min={25}
                    max={70}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
                <div>
                  <label htmlFor="country-search" className="text-sm text-muted-foreground">
                    País de origem
                  </label>
                  <input
                    id="country-search"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Buscar país..."
                    className="mt-1 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                    {countryOptions.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={getLeague(country).country === l.country}
                        onClick={() => setCountry(l.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                          getLeague(country).country === l.country
                            ? "border-primary bg-primary/15"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Flag league={l.id} size={14} /> {l.country}
                      </button>
                    ))}
                    {countryOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum país encontrado.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Row label="Tom de pele">
                  {[0, 1, 2, 3, 4, 5].map((s) => (
                    <Chip
                      key={s}
                      active={look.skin === s}
                      onClick={() => setLook({ ...look, skin: s })}
                    >
                      {s + 1}
                    </Chip>
                  ))}
                </Row>
                <Row label="Cabelo">
                  {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                    <Chip
                      key={h}
                      active={look.hair === h}
                      onClick={() => setLook({ ...look, hair: h })}
                    >
                      {h === 0 ? "Curto" : h === 6 ? "Careca" : `Estilo ${h}`}
                    </Chip>
                  ))}
                </Row>
                <Row label="Cor do cabelo">
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={`Cor ${c}`}
                      onClick={() => setLook({ ...look, hairColor: c })}
                      style={{ background: c }}
                      className={`h-7 w-7 rounded-full border-2 ${
                        look.hairColor === c ? "border-primary" : "border-border"
                      }`}
                    />
                  ))}
                </Row>
                <Row label="Barba">
                  {[0, 1, 2, 3, 4].map((b) => (
                    <Chip
                      key={b}
                      active={look.beard === b}
                      onClick={() => setLook({ ...look, beard: b })}
                    >
                      {b === 0 ? "Sem barba" : `Estilo ${b}`}
                    </Chip>
                  ))}
                </Row>
                <Row label="Roupa">
                  {["Terno", "Agasalho", "Casual"].map((o, i) => (
                    <Chip
                      key={o}
                      active={look.outfit === i}
                      onClick={() => setLook({ ...look, outfit: i })}
                    >
                      {o}
                    </Chip>
                  ))}
                </Row>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">Personalidade</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {PERSONALITIES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPersonality(p.id)}
                        className={`rounded-xl border p-3 text-left transition ${
                          personality === p.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        <p className="font-display text-lg leading-tight">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reputação inicial</p>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <Chip key={r} active={reputation === r} onClick={() => setReputation(r)}>
                        {"★".repeat(r)}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reputação maior abre clubes mais fortes e aumenta o orçamento.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Habilidades · pontos restantes: <strong>{left}</strong>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ATTR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAttrs(preset.attrs)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 space-y-2">
                    {ATTR_LABELS.map((a) => (
                      <div key={a.key} className="flex items-center gap-3">
                        <span className="w-36 text-sm">{a.label}</span>
                        <input
                          aria-label={a.label}
                          type="range"
                          min={1}
                          max={10}
                          value={attrs[a.key]}
                          onChange={(e) => setAttr(a.key, Number(e.target.value))}
                          className="flex-1 accent-primary"
                        />
                        <span className="w-6 text-right text-sm tabular-nums">{attrs[a.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <label htmlFor="club-search" className="text-sm text-muted-foreground">
                  Buscar liga ou clube
                </label>
                <input
                  id="club-search"
                  value={clubQuery}
                  onChange={(e) => setClubQuery(e.target.value)}
                  placeholder="Ex.: Brasileirão, Fluminense, Portugal…"
                  className="mb-3 mt-1 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {visibleLeagues.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLeagueId(l.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                        l.id === leagueId
                          ? "border-primary bg-primary/15"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Flag league={l.id} size={14} /> {l.name}
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {league.name} · {league.clubs.length} clubes ·{" "}
                  {league.clubs.filter((c) => c.strength <= maxStrength).length} liberados para a
                  sua reputação
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibleClubs.map((c) => {
                    const locked = c.strength > maxStrength;
                    return (
                      <button
                        key={c.id}
                        onClick={() => !locked && void choose(c.id)}
                        disabled={locked || loadingClub !== null}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          locked
                            ? "cursor-not-allowed border-border/40 opacity-45"
                            : "border-border/60 surface-card hover:border-primary hover:bg-card"
                        }`}
                      >
                        <Crest club={c} size={40} />
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg leading-tight">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {loadingClub === c.id
                              ? "Carregando elenco real…"
                              : locked
                                ? "Precisa de mais reputação"
                                : `Força ${c.strength}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground disabled:opacity-40"
              >
                Voltar
              </button>
              {step < 3 && (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 2 && left !== 0}
                  className="rounded-lg bg-primary px-5 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground disabled:opacity-40"
                >
                  {step === 2 && left !== 0 ? `Distribua ${left} pontos` : "Continuar"}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {scene && (
        <Cutscene
          scene="arrival"
          look={look}
          {...(accent ? { accent } : {})}
          onDone={() => {
            setScene(false);
            navigate({ to: "/club" });
          }}
        />
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
        active
          ? "border-primary bg-primary/15"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
