import { CATALOG_EVENT, loadDbCatalog } from "@/lib/db-catalog";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  LoaderCircle,
  Lock,
  Search,
  Shield,
  Star,
  Trophy,
} from "lucide-react";
import { LEAGUES, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career";
import {
  createManagerProfile,
  DEFAULT_MANAGER_ATTRIBUTES,
  DEFAULT_MANAGER_LOOK,
} from "@/game/manager-profile";
import {
  discoverClubs,
  searchKey,
  type CareerChallenge,
  type ClubDiscovery,
} from "@/game/club-discovery";
import { Crest } from "@/components/game/Crest";
import { useCareer } from "@/hooks/useCareer";
import { loadRealSquad } from "@/lib/realSquads";
import { startWorldForNewCareer } from "@/lib/world";
import { Flag } from "@/components/game/Flag";
import { ManagerPortrait, HAIR_COLORS } from "@/components/game/ManagerPortrait";
import { useCinematicPreload } from "@/components/game/cinematic/cinematic-loading";
import type { ManagerAttributes, ManagerLook, ManagerPersonality } from "@/game/types";
import "@/components/game/career-create.css";

const Cutscene = lazy(() =>
  import("@/components/game/Cutscene").then((m) => ({ default: m.Cutscene })),
);
export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Crie seu treinador e escolha seu clube · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie sua identidade, personalize seu treinador e encontre o clube para a sua próxima história no futebol.",
      },
    ],
  }),
  component: NewCareer,
});
const STEPS = ["Identidade", "Aparência", "Perfil", "Clube"] as const;
const STEP_COPY = [
  ["Sua história começa com você.", "Como a torcida vai chamar o novo treinador?"],
  ["Um rosto para a sua história.", "Personalize o treinador que vai representar você no clube."],
  [
    "Qual é o seu estilo de comando?",
    "Personalidade e habilidades definem o início da sua carreira.",
  ],
  ["Encontre o seu próximo clube.", "Escolha o desafio e confira sua decisão antes de assumir."],
];
const PERSONALITIES: { id: ManagerPersonality; label: string; desc: string }[] = [
  { id: "calmo", label: "Calmo", desc: "Diretoria mais paciente, elenco estável." },
  { id: "motivador", label: "Motivador", desc: "Moral do elenco sobe mais rápido." },
  { id: "durao", label: "Durão", desc: "Disciplina alta, mas desgasta estrelas." },
  { id: "tatico", label: "Tático", desc: "Time rende mais com a tática certa." },
  { id: "jovem", label: "Jovem promessa", desc: "Jovens crescem mais no treino." },
];
const ATTRS: { key: keyof ManagerAttributes; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defesa" },
  { key: "market", label: "Mercado" },
  { key: "squad", label: "Gestão de elenco" },
  { key: "media", label: "Imprensa" },
];
const PRESETS = [
  { label: "Treinador de campo", attrs: { attack: 8, defense: 8, market: 4, squad: 6, media: 4 } },
  { label: "Negociador", attrs: { attack: 5, defense: 5, market: 9, squad: 6, media: 5 } },
  { label: "Líder de vestiário", attrs: { attack: 5, defense: 6, market: 4, squad: 9, media: 6 } },
  { label: "Equilibrado", attrs: { attack: 6, defense: 6, market: 6, squad: 6, media: 6 } },
];
const CHALLENGES: { id: CareerChallenge; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "contender", label: "Disputar títulos" },
  { id: "build", label: "Construir um projeto" },
  { id: "underdog", label: "Superar expectativas" },
];

function NewCareer() {
  const navigate = useNavigate();
  const { career, update } = useCareer();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [name, setName] = useState("Técnico");
  const [age, setAge] = useState(38);
  const [country, setCountry] = useState(LEAGUES[0]!.id);
  const [countryQuery, setCountryQuery] = useState("");
  const [look, setLook] = useState<ManagerLook>({
    ...DEFAULT_MANAGER_LOOK,
    hairColor: HAIR_COLORS[0]!,
  });
  const [personality, setPersonality] = useState<ManagerPersonality>("motivador");
  const [reputation, setReputation] = useState(3);
  const [attrs, setAttrs] = useState<ManagerAttributes>({
    ...DEFAULT_MANAGER_ATTRIBUTES,
  });
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [clubQuery, setClubQuery] = useState("");
  const query = useDeferredValue(clubQuery);
  const [challenge, setChallenge] = useState<CareerChallenge>("all");
  const [available, setAvailable] = useState(false);
  const [scopeSearch, setScopeSearch] = useState(false);
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<ClubDiscovery | null>(null);
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scene, setScene] = useState(false);
  const choosing = useRef(false);
  const mounted = useRef(true);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef(step);
  useCinematicPreload(loading || scene);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (lastStep.current !== step) {
      lastStep.current = step;
      stepTitle.current?.focus();
    }
  }, [step]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => {
    const bump = () => setCatalogVersion((v) => v + 1);
    window.addEventListener(CATALOG_EVENT, bump);
    void loadDbCatalog().then(bump);
    return () => window.removeEventListener(CATALOG_EVENT, bump);
  }, []);
  useEffect(() => {
    setLimit(24);
  }, [query, leagueId, challenge, available, scopeSearch]);
  useEffect(() => {
    if (step === 3 && selected) reviewTitle.current?.focus();
  }, [step, selected]);
  const spent = Object.values(attrs).reduce((a, b) => a + b, 0);
  const left = 30 - spent;
  const countryOptions = useMemo(() => {
    const unique = [...new Map(LEAGUES.map((league) => [league.country, league])).values()];
    return unique
      .filter((league) => searchKey(league.country).includes(searchKey(countryQuery)))
      .sort((a, b) =>
        a.country === "Brasil"
          ? -1
          : b.country === "Brasil"
            ? 1
            : a.country.localeCompare(b.country, "pt-BR"),
      );
  }, [countryQuery, catalogVersion]);
  const clubs = useMemo(
    () =>
      discoverClubs(LEAGUES, {
        query,
        leagueId,
        reputation,
        challenge,
        availableOnly: available,
        scopeSearch,
      }),
    [query, leagueId, reputation, challenge, available, scopeSearch, catalogVersion],
  );
  const selectionLocked = !!selected && selected.reputation > reputation;
  function go(next: number) {
    setFurthest((prev) => Math.max(prev, next));
    setStep(next);
  }
  function setAttr(key: keyof ManagerAttributes, value: number) {
    const next = Math.max(1, Math.min(10, value));
    if (next - attrs[key] <= left) setAttrs({ ...attrs, [key]: next });
  }
  async function start() {
    if (!selected || selectionLocked || choosing.current || (career && !replace)) return;
    choosing.current = true;
    setLoading(true);
    setError("");
    const club = selected.club;
    const profile = createManagerProfile({
      name,
      country,
      age,
      favClub: club.id,
      look,
      personality,
      reputation,
      attrs,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A slow optional sports endpoint cannot trap a guest in the wizard.
      await Promise.race([
        loadRealSquad(club.id),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 8000);
        }),
      ]);
      if (!mounted.current) return;
      startWorldForNewCareer(club.id);
      update(initCareer(selected.league.id, club.id, profile.name, profile));
      setScene(true);
    } catch {
      if (mounted.current)
        setError("Não foi possível preparar a carreira. Sua escolha está aqui; tente novamente.");
    } finally {
      if (timer) clearTimeout(timer);
      choosing.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  const stepCopy = STEP_COPY[step]!;
  return (
    <main className="career-create">
      <header className="career-top">
        <Link to="/" className="career-back">
          <ArrowLeft size={16} />
          Início
        </Link>
        <span>
          PRO FOOTBALL MANAGER <b>3D</b>
        </span>
        <Link to="/auth" className="career-login">
          Entrar na conta
        </Link>
      </header>
      <div className="career-container">
        <div className="career-intro">
          <div>
            <p className="career-kicker">UM NOVO CAPÍTULO</p>
            <h1>Novo treinador</h1>
            <p>O próximo clube vai conhecer o seu nome.</p>
          </div>
          <span className="career-save-note">
            <Shield size={16} />
            Comece como convidado
            <br />
            <small>Sua carreira fica neste aparelho</small>
          </span>
        </div>
        <nav aria-label="Etapas da criação" className="career-steps">
          <ol>
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  disabled={i > furthest || loading}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span>{i < step ? <Check size={14} /> : i + 1}</span>
                  <b>{label}</b>
                </button>
              </li>
            ))}
          </ol>
          <div
            role="progressbar"
            aria-label="Progresso da criação"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={step + 1}
            className="career-progress"
          >
            <span style={{ width: `${(step + 1) * 25}%` }} />
          </div>
        </nav>
        <div className="career-layout">
          <aside className="career-identity" aria-label="Seu treinador">
            <div className="career-portrait">
              <ManagerPortrait look={look} size={154} />
              <span>MANAGER</span>
            </div>
            <div className="career-identity-copy">
              <p className="career-kicker">SEU TREINADOR</p>
              <h2>{name.trim() || "Técnico"}</h2>
              <p>
                <Flag league={country} country={getLeague(country).country} size={14} />
                {getLeague(country).country} · {age} anos
              </p>
              <span className="career-personality">
                {PERSONALITIES.find((p) => p.id === personality)?.label}
              </span>
              <div className="career-stars" aria-label={`Reputação ${reputation} de 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={16}
                    fill={n <= reputation ? "currentColor" : "none"}
                    style={{ opacity: n <= reputation ? 1 : 0.25 }}
                  />
                ))}
              </div>
              <p className="career-reputation-note">
                {reputation <= 2
                  ? "Uma carreira para conquistar espaço."
                  : reputation <= 3
                    ? "Pronto para um novo projeto."
                    : "Experiência para assumir grandes desafios."}
              </p>
            </div>
          </aside>
          <section
            className="career-editor"
            aria-labelledby="career-step-title"
            aria-busy={loading}
          >
            <div className="career-step-heading">
              <p className="career-kicker">
                PASSO {step + 1} DE 4 · {STEPS[step]}
              </p>
              <h2 id="career-step-title" ref={stepTitle} tabIndex={-1}>
                {stepCopy[0]}
              </h2>
              <p>{stepCopy[1]}</p>
            </div>
            <fieldset disabled={loading} className="career-fields">
              {step === 0 && (
                <div className="career-step-content">
                  <label className="career-label" htmlFor="manager-name">
                    Nome do treinador
                  </label>
                  <input
                    id="manager-name"
                    value={name}
                    maxLength={48}
                    autoComplete="nickname"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como você quer ser chamado?"
                    className="career-input"
                  />
                  <div className="career-range-label">
                    <label htmlFor="manager-age">Idade</label>
                    <output htmlFor="manager-age">{age} anos</output>
                  </div>
                  <input
                    id="manager-age"
                    type="range"
                    min={20}
                    max={75}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                  />
                  <label htmlFor="country-search" className="career-label">
                    País de origem
                  </label>
                  <div className="career-search">
                    <Search size={17} />
                    <input
                      id="country-search"
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      placeholder="Buscar país"
                    />
                  </div>
                  <div className="career-country-list">
                    {countryOptions.map((league) => (
                      <Chip
                        key={league.id}
                        active={getLeague(country).country === league.country}
                        onClick={() => setCountry(league.id)}
                      >
                        <Flag league={league.id} country={league.country} size={14} />
                        {league.country}
                      </Chip>
                    ))}
                    {!countryOptions.length ? (
                      <p className="career-empty">Nenhum país encontrado. Tente outro nome.</p>
                    ) : null}
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="career-step-content">
                  <ChoiceRow label="Tom de pele">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <Chip
                        key={n}
                        active={look.skin === n}
                        onClick={() => setLook({ ...look, skin: n })}
                      >
                        Tom {n + 1}
                      </Chip>
                    ))}
                  </ChoiceRow>
                  <ChoiceRow label="Cabelo">
                    {["Careca", "Curto", "Volumoso", "Longo", "Ondulado", "Coque", "Repartido"].map(
                      (label, n) => (
                        <Chip
                          key={label}
                          active={look.hair === n}
                          onClick={() => setLook({ ...look, hair: n })}
                        >
                          {label}
                        </Chip>
                      ),
                    )}
                  </ChoiceRow>
                  <ChoiceRow label="Cor do cabelo">
                    {HAIR_COLORS.map((color, i) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Cabelo ${["castanho escuro", "preto", "castanho", "loiro escuro", "loiro claro", "grisalho", "ruivo"][i]}`}
                        aria-pressed={look.hairColor === color}
                        onClick={() => setLook({ ...look, hairColor: color })}
                        className="career-color"
                        style={{ background: color }}
                      >
                        {look.hairColor === color ? <Check size={17} /> : null}
                      </button>
                    ))}
                  </ChoiceRow>
                  <ChoiceRow label="Barba">
                    {["Sem barba", "Bigode", "Curta", "Completa", "Por fazer"].map((label, n) => (
                      <Chip
                        key={label}
                        active={look.beard === n}
                        onClick={() => setLook({ ...look, beard: n })}
                      >
                        {label}
                      </Chip>
                    ))}
                  </ChoiceRow>
                  <ChoiceRow label="Roupa">
                    {["Terno", "Agasalho", "Casual"].map((label, n) => (
                      <Chip
                        key={label}
                        active={look.outfit === n}
                        onClick={() => setLook({ ...look, outfit: n })}
                      >
                        {label}
                      </Chip>
                    ))}
                  </ChoiceRow>
                </div>
              )}
              {step === 2 && (
                <div className="career-step-content">
                  <fieldset className="career-choice-group">
                    <legend className="career-label">Personalidade</legend>
                    <div className="career-personality-grid">
                      {PERSONALITIES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={personality === item.id}
                          onClick={() => setPersonality(item.id)}
                        >
                          <strong>{item.label}</strong>
                          <small>{item.desc}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="career-range-label">
                    <label htmlFor="manager-reputation">Reputação inicial</label>
                    <output htmlFor="manager-reputation">{reputation} de 5 estrelas</output>
                  </div>
                  <input
                    id="manager-reputation"
                    type="range"
                    min={1}
                    max={5}
                    value={reputation}
                    onChange={(e) => setReputation(Number(e.target.value))}
                  />
                  <p className="career-help">
                    Mais reputação abre as portas de clubes mais fortes. Um início modesto traz um
                    desafio maior.
                  </p>
                  <div className="career-range-label">
                    <p>Habilidades</p>
                    <span role="status">
                      {left === 0 ? "30 pontos distribuídos" : `${left} pontos disponíveis`}
                    </span>
                  </div>
                  <div className="career-presets" role="group" aria-label="Perfis de habilidades">
                    {PRESETS.map((preset) => (
                      <Chip
                        key={preset.label}
                        active={ATTRS.every((a) => attrs[a.key] === preset.attrs[a.key])}
                        onClick={() => setAttrs({ ...preset.attrs })}
                      >
                        {preset.label}
                      </Chip>
                    ))}
                  </div>
                  <div className="career-attributes">
                    {ATTRS.map((attr) => (
                      <div key={attr.key}>
                        <label htmlFor={`attr-${attr.key}`}>{attr.label}</label>
                        <input
                          id={`attr-${attr.key}`}
                          type="range"
                          min={1}
                          max={10}
                          value={attrs[attr.key]}
                          onChange={(e) => setAttr(attr.key, Number(e.target.value))}
                        />
                        <output htmlFor={`attr-${attr.key}`}>{attrs[attr.key]}</output>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="career-step-content">
                  <label className="career-label" htmlFor="club-search">
                    Buscar clube, liga ou país
                  </label>
                  <div className="career-search">
                    <Search size={18} />
                    <input
                      id="club-search"
                      value={clubQuery}
                      onChange={(e) => {
                        setClubQuery(e.target.value);
                        setScopeSearch(false);
                      }}
                      placeholder="Ex.: São Paulo, Porto, Inglaterra…"
                    />
                    {clubQuery ? (
                      <button
                        type="button"
                        onClick={() => setClubQuery("")}
                        aria-label="Limpar busca"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <div className="career-discovery-filters">
                    <select
                      aria-label="Liga para explorar"
                      value={leagueId}
                      onChange={(e) => {
                        setLeagueId(e.target.value);
                        setScopeSearch(true);
                      }}
                    >
                      {LEAGUES.map((league) => (
                        <option key={league.id} value={league.id}>
                          {league.country} · {league.name}
                        </option>
                      ))}
                    </select>
                    <label className="career-checkbox">
                      <input
                        type="checkbox"
                        checked={available}
                        onChange={(e) => setAvailable(e.target.checked)}
                      />
                      Só clubes disponíveis
                    </label>
                  </div>
                  {query ? (
                    <p className="career-help">
                      {scopeSearch
                        ? `Busca em ${getLeague(leagueId).name}`
                        : "Busca em todas as ligas"}
                      {scopeSearch ? (
                        <button
                          type="button"
                          className="career-text-button"
                          onClick={() => setScopeSearch(false)}
                        >
                          Buscar no mundo todo
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                  <div className="career-presets" role="group" aria-label="Tipo de desafio">
                    {CHALLENGES.map((item) => (
                      <Chip
                        key={item.id}
                        active={challenge === item.id}
                        onClick={() => setChallenge(item.id)}
                      >
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                  <p role="status" className="career-results-count">
                    {clubs.length} {clubs.length === 1 ? "clube encontrado" : "clubes encontrados"}
                    {query !== clubQuery ? " · buscando…" : ""}
                  </p>
                  <div className="career-club-grid">
                    {clubs.slice(0, limit).map((row) => (
                      <button
                        key={row.club.id}
                        type="button"
                        className="career-club"
                        aria-pressed={selected?.club.id === row.club.id}
                        disabled={row.locked}
                        onClick={() => {
                          setSelected(row);
                          setError("");
                        }}
                      >
                        <Crest club={row.club} size={39} detail="simple" />
                        <span>
                          <strong>{row.club.name}</strong>
                          <small>
                            {row.league.country} · {row.league.name}
                          </small>
                          <span className="career-club-strength">
                            <i style={{ width: `${row.club.strength}%` }} />
                            Força {row.club.strength}
                          </span>
                        </span>
                        {row.locked ? (
                          <span className="career-club-lock">
                            <Lock size={13} />
                            {row.reputation}★
                          </span>
                        ) : selected?.club.id === row.club.id ? (
                          <Check size={17} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    ))}
                  </div>
                  {!clubs.length ? (
                    <div className="career-empty">
                      <Search size={24} />
                      <h3>Nenhum clube com esses filtros.</h3>
                      <p>Tente outro nome ou amplie o desafio.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setClubQuery("");
                          setChallenge("all");
                          setAvailable(false);
                          setScopeSearch(false);
                        }}
                      >
                        Limpar filtros
                      </button>
                    </div>
                  ) : null}
                  {clubs.length > limit ? (
                    <button
                      type="button"
                      className="career-load-more"
                      onClick={() => setLimit(limit + 24)}
                    >
                      Mostrar mais clubes ({clubs.length - limit})
                    </button>
                  ) : null}
                  {selected ? (
                    <div className="career-selection" aria-label="Revisar clube escolhido">
                      <Crest club={selected.club} size={46} />
                      <div>
                        <p className="career-kicker">SUA PRÓXIMA HISTÓRIA</p>
                        <h3 ref={reviewTitle} tabIndex={-1}>
                          {selected.club.name}
                        </h3>
                        <p>
                          {selected.league.name} · {selected.league.country}
                        </p>
                        <small>
                          {PERSONALITIES.find((p) => p.id === personality)?.label} · {reputation}{" "}
                          estrelas · {name.trim() || "Técnico"}
                        </small>
                      </div>
                      {selectionLocked ? (
                        <p className="career-error">
                          Volte ao perfil: este clube exige {selected.reputation} estrelas.
                        </p>
                      ) : null}
                      {career ? (
                        <label className="career-checkbox career-replace">
                          <input
                            type="checkbox"
                            checked={replace}
                            onChange={(e) => setReplace(e.target.checked)}
                          />
                          Começar esta carreira no lugar da carreira atual neste aparelho.
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="career-primary"
                        disabled={selectionLocked || !!(career && !replace)}
                        onClick={() => void start()}
                      >
                        {loading ? (
                          <>
                            <LoaderCircle className="career-spinner" size={18} />
                            Preparando sua carreira…
                          </>
                        ) : (
                          <>
                            Assumir {selected.club.short}
                            <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="career-help career-selection-hint">
                      <Trophy size={17} />
                      Selecione um clube para revisar e começar sua carreira.
                    </p>
                  )}
                  {error ? (
                    <p role="alert" className="career-error">
                      {error}
                    </p>
                  ) : null}
                </div>
              )}
            </fieldset>
            <div className="career-step-actions">
              <button
                type="button"
                onClick={() => go(Math.max(0, step - 1))}
                disabled={step === 0 || loading}
              >
                <ArrowLeft size={16} />
                Voltar
              </button>
              <span>
                {step === 3 ? "Sua decisão, seu clube." : "Você pode revisar as etapas anteriores."}
              </span>
              {step < 3 ? (
                <button
                  type="button"
                  className="career-primary"
                  disabled={!name.trim() || (step === 2 && left !== 0) || loading}
                  onClick={() => go(step + 1)}
                >
                  {step === 2 && left !== 0
                    ? `Distribua ${left} pontos`
                    : step === 2
                      ? "Escolher meu clube"
                      : "Continuar"}
                  <ArrowRight size={17} />
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      {scene ? (
        <Suspense
          fallback={
            <div className="career-arrival-loading" role="status">
              <LoaderCircle className="career-spinner" />
              <p>Seu primeiro dia no clube está começando…</p>
              <button type="button" onClick={() => void navigate({ to: "/club" })}>
                Ir para o clube
              </button>
            </div>
          }
        >
          <Cutscene
            scene="arrival"
            look={look}
            {...(selected ? { accent: selected.club.primary } : {})}
            onDone={() => {
              setScene(false);
              void navigate({ to: "/club" });
            }}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="career-choice-group">
      <legend className="career-label">{label}</legend>
      <div className="career-chips">{children}</div>
    </fieldset>
  );
}
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="career-chip">
      {children}
    </button>
  );
}
