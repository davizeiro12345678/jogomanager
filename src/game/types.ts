export type Position = "GK" | "DF" | "MF" | "FW";

export interface Club {
  sourceTeamId?: string;
  id: string;
  name: string;
  short: string;
  league: string;
  primary: string;
  secondary: string;
  strength: number;
}

export interface League {
  membershipSeason?: string;
  membershipSource?: string;
  catalogStatus?: "sourced" | "legacy";
  id: string;
  name: string;
  country: string;
  flag: string;
  clubs: Club[];
}

export type Personality =
  "líder" | "profissional" | "ambicioso" | "temperamental" | "caseiro" | "determinado";

export interface Player {
  id: string;
  clubId: string;
  name: string;
  pos: Position;
  age: number;
  number: number;
  ovr: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  condition: number;
  morale: number;
  goals: number;
  assists: number;
  apps: number;
  /** salário semanal em milhares de euros */
  wage: number;
  /** valor de mercado em milhões de euros */
  value: number;
  yellows: number;
  suspended: boolean;
  injuryWeeks: number;
  /** teto de evolução (atributo oculto) */
  potential?: number;
  personality?: Personality;
  /** forma recente 0-100 */
  form?: number;
  /** anos restantes de contrato */
  contractYears?: number;
  /** cláusula de rescisão em M€ */
  releaseClause?: number;
  /** tipo/descrição da lesão atual */
  injuryType?: string;
  /** jogador insatisfeito com tempo de jogo */
  unhappy?: boolean;
  nationality?: string;
  photo?: string;
  rosterSource?: "catalog" | "generated" | "imported" | "custom";
  sourcePlayerId?: string;
  sourceProvider?: string;
  sourceExternalId?: string;
  sourceIdentityAliases?: string[];
  birthDate?: string;
}

export type FormationKey = "4-3-3" | "4-4-2" | "3-5-2" | "4-2-3-1";

export interface Tactics {
  formation: FormationKey;
  mentality: number; // 0 = ultra defensivo, 4 = all out attack
  pressing: number; // 0..2
  width: number; // 0..2
  tempo: number; // 0..2
}

export interface Fixture {
  round: number;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** lances das partidas simuladas (gols, pênaltis, gols contra, expulsões) */
  events?: FixtureEvent[];
}

export interface FixtureEvent {
  minute: number;
  side: "home" | "away";
  kind: "gol" | "penalti" | "gol_contra" | "vermelho";
}

export interface TableRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export type TrainingFocus = "ataque" | "defesa" | "fisico" | "tecnica" | "equilibrado";

export type NewsKind =
  "resultado" | "mercado" | "lesao" | "cartao" | "sistema" | "premio" | "vestiario" | "coletiva";

export interface NewsItem {
  id: string;
  season: number;
  round: number;
  kind: NewsKind;
  title: string;
  body: string;
}

export interface Trophy {
  season: number;
  name: string;
}

export interface SeasonSummary {
  season: number;
  position: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  championId: string;
}

export interface Finances {
  /** caixa em milhões de euros */
  budget: number;
  /** total gasto em transferências na temporada (M€) */
  spent: number;
  /** total de receitas na temporada (M€) */
  income: number;
}

export type StaffRole = "assistente" | "preparador" | "medico" | "olheiro";

export interface Staff {
  /** nível 1-5 por função */
  assistente: number;
  preparador: number;
  medico: number;
  olheiro: number;
}

export interface TransferOffer {
  id: string;
  playerId: string;
  clubId: string;
  /** proposta em M€ */
  amount: number;
  /** salário oferecido (k€/sem) */
  wage: number;
  season: number;
  round: number;
  expiresRound: number;
}

export interface JobOffer {
  id: string;
  clubId: string;
  leagueId: string;
  season: number;
  round: number;
  expiresRound: number;
  /** orçamento prometido (M€) */
  budget: number;
  objective: number;
}

export interface ManagerSpell {
  clubId: string;
  from: number;
  to: number | null;
  note: string;
}

export interface ScoutReport {
  id: string;
  playerId: string;
  name: string;
  clubId: string;
  pos: Position;
  ovr: number;
  potential: number;
  age: number;
  value: number;
  season: number;
}

export interface CareerState {
  /** Persistent local career identity, relationships and football memories. */
  world?: import("./career-world-types").CareerWorld;
  version: 3;
  /** One-time roster/catalog migration; never refills players sold afterwards. */
  catalogRevision?: number;
  /** One-time calibration of exact, untouched built-in roster fingerprints. */
  simulationRatingRevision?: 1;
  catalogCalendarPending?: boolean;
  leagueId: string;
  clubId: string;
  managerName: string;
  season: number;
  round: number;
  tactics: Tactics;
  training: TrainingFocus;
  /** intensidade do treino: 0 leve, 1 normal, 2 intenso */
  trainingIntensity?: 0 | 1 | 2;
  lineup: string[]; // 11 player ids
  bench: string[];
  fixtures: Fixture[];
  players: Record<string, Player>;
  results: {
    round: number;
    home: string;
    away: string;
    hg: number;
    ag: number;
  }[];
  finances: Finances;
  /** satisfação da diretoria, 0-100 */
  approval: number;
  /** posição-alvo definida pela diretoria */
  objective: number;
  news: NewsItem[];
  trophies: Trophy[];
  history: SeasonSummary[];

  /* ---------------------------------------------------------- v3 */
  /** aprovação da torcida 0-100 */
  fanApproval: number;
  /** pressão da diretoria 0-100 (100 = demissão iminente) */
  pressure: number;
  staff: Staff;
  /** receita de patrocínio por rodada (M€) */
  sponsor: number;
  /** preço médio do ingresso (€) */
  ticketPrice: number;
  /** capacidade do estádio */
  capacity: number;
  /** sequência atual: positivo = vitórias, negativo = derrotas */
  streak: number;
  offers: TransferOffer[];
  jobOffers: JobOffer[];
  scoutReports: ScoutReport[];
  managerHistory: ManagerSpell[];
  /** verdadeiro quando o treinador foi demitido e aguarda novo clube */
  sacked: boolean;
  /** copas nacionais e continentais da temporada */
  cups?: CupState[];
  /** Ano e classificação pertencem apenas a este save pessoal; não atestam conquistas. */
  calendarYear?: number;
  competitionHistory?: CompetitionSeasonRecord[];
  qualifications?: CompetitionQualification[];
  regionalLeagueId?: string;

  /* ---------------------------------------------------------- v4 */
  /** histórico partida a partida (gols, assistências e minutos por jogo) */
  matchLog?: MatchLogEntry[];

  /* ---------------------------------------------------------- v5 */
  /** perfil completo do treinador criado no início do jogo */
  manager?: ManagerProfile;
  /** ids de jogadores reais já contratados (não voltam ao mercado) */
  transferredIn?: string[];
  /** cutscenes já exibidas */
  seenScenes?: string[];
  /** cena de história da semana passada (o sorteio nunca repete em sequência) */
  lastStoryScene?: string;

  /* ---------------------------------------------------------- v6 */
  /** ids das conquistas já desbloqueadas */
  achievements?: string[];
  /** data (ISO) em que cada conquista foi desbloqueada */
  achievementsUnlockedAt?: Record<string, string>;

  /* ---------------------------------------------------------- v7 */
  /** composição das divisões nesta campanha (acesso e rebaixamento) */
  leagueClubs?: Record<string, string[]>;
  /** vagas de acesso/rebaixamento escolhidas pelo jogador */
  pyramidSlots?: number;
  /** marcos permanentes da carreira */
  records?: CareerRecords;
  /** Fim do impulso de treino semanal (ISO). Só vale na carreira individual. */
  boostUntil?: string;
  /** Evolução acumulada dos 28 atributos, por jogador. */
  attrDeltas?: Record<string, Partial<Record<string, number>>>;

  /* ---------------------------------------------------------- v8 */
  /** exercício tático já feito em cada rodada, na chave "temporada-rodada" */
  drillsByRound?: Record<string, string>;
  /** amistosos disputados fora do calendário oficial */
  friendlies?: {
    season: number;
    round: number;
    opponentId: string;
    hg: number;
    ag: number;
  }[];

  /* ---------------------------------------------------------- v9 (vestiário) */
  /** promessas de minutos feitas a jogadores (cobradas no advanceRound) */
  promises?: ManagerPromise[];
  /** jogadores com promessa quebrada (magoados) */
  brokenPromises?: string[];
  /** jogadores que tiveram oferta recusada (queriam sair) */
  rejectedOffers?: string[];
  /** última rodada em que deu coletiva (1 por rodada) */
  pressRound?: number;
}

/** Promessa de titularidade: X jogos como titular até a rodada-limite. */
export interface ManagerPromise {
  pid: string;
  starts: number;
  target: number;
  untilRound: number;
}

export interface CareerRecords {
  /** maior valor pago em uma contratação (M€) */
  biggestSigning?: number;
  /** acessos conquistados */
  promotions?: number;
  /** rebaixamentos sofridos */
  relegations?: number;
}

export type ManagerPersonality = "calmo" | "motivador" | "durao" | "tatico" | "jovem";

export interface ManagerLook {
  /** 0-5 tom de pele */
  skin: number;
  /** 0-6 estilo de cabelo */
  hair: number;
  hairColor: string;
  /** 0-4 estilo de barba */
  beard: number;
  /** 0-2 roupa: terno, agasalho, casual */
  outfit: number;
}

export interface ManagerAttributes {
  attack: number;
  defense: number;
  market: number;
  squad: number;
  media: number;
}

export interface ManagerProfile {
  name: string;
  /** id da liga usada como país de origem */
  country: string;
  age: number;
  /** clube do coração */
  favClub: string;
  look: ManagerLook;
  personality: ManagerPersonality;
  /** reputação inicial 1-5 */
  reputation: number;
  attrs: ManagerAttributes;
  /** aprovação inicial escolhida/derivada 0-100 */
  approval: number;
}

/** Uma linha do histórico por partida do clube do usuário. */
export interface MatchLogEntry {
  season: number;
  round: number;
  /** competição da partida */
  comp: string;
  opponentId: string;
  home: boolean;
  gf: number;
  ga: number;
  players: {
    pid: string;
    goals: number;
    assists: number;
    minutes: number;
    rating: number;
  }[];
}

export interface CupTie {
  /** fase: 0 oitavas, 1 quartas, 2 semi, 3 final */
  round: number;
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
  /** placar da disputa de pênaltis, quando houve (ex.: "4x3") */
  pens?: string;
}

export interface CupGroupMatch {
  /** rodada da fase de grupos (0, 1, 2) */
  round: number;
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
}

export interface CupGroup {
  /** rótulo do grupo: A, B, C... */
  label: string;
  clubIds: string[];
  matches: CupGroupMatch[];
}

export interface CupState {
  id:
    | "national"
    | "continental"
    | "continental_secondary"
    | "conference"
    | "regional"
    | "regional_path"
    | "intercontinental"
    | "club_world_cup";
  competitionId?: string;
  /** Inscrição decorrente de classificação; false distingue ausência de vaga de eliminação. */
  entered?: boolean;
  formatNote?: string;
  automaticEntrants?: string[];
  intercontinentalChampions?: Partial<
    Record<"UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC", string>
  >;
  finalists?: string[];
  name: string;
  stage: number;
  ties: CupTie[];
  /** o clube do usuário já foi eliminado */
  out: boolean;
  winner: string | null;
  /** a cada quantas rodadas de liga acontece uma fase */
  everyRounds: number;
  /** fase de grupos (só em torneios que a usam; ausente = mata-mata direto) */
  groups?: CupGroup[];
  /** próxima rodada da fase de grupos; ausente ou >= 3 significa fase concluída */
  groupRound?: number;
}

export interface CompetitionQualification {
  clubId: string;
  competitionId: string;
  name: string;
  season: number;
  phase: "principal" | "preliminar";
  reason: string;
}

export interface CompetitionSeasonRecord {
  season: number;
  year: number;
  champions: Record<string, string>;
  continentalPoints: Record<string, number>;
  /** Apenas divisões do país da carreira; as demais tabelas são consumidas no fechamento. */
  tables: Record<string, TableRow[]>;
  playoffs?: {
    home: string;
    away: string;
    winner: string;
    first: { hg: number; ag: number };
    second: { hg: number; ag: number };
    penalties: boolean;
  }[];
}

export interface MatchEventLog {
  minute: number;
  type:
    | "goal"
    | "shot"
    | "save"
    | "foul"
    | "sub"
    | "kickoff"
    | "halftime"
    | "fulltime"
    | "chance"
    | "yellow"
    | "red"
    | "corner"
    | "offside"
    | "penalty"
    | "freekick"
    | "injury"
    | "post"
    | "talk"
    | "crowd"
    | "shootout";
  side: "home" | "away" | "neutral";
  text: string;
}
