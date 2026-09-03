export type Position = "GK" | "DF" | "MF" | "FW";

export interface Club {
  id: string;
  name: string;
  short: string;
  league: string;
  primary: string;
  secondary: string;
  strength: number;
}

export interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  clubs: Club[];
}

export type Personality =
  | "líder"
  | "profissional"
  | "ambicioso"
  | "temperamental"
  | "caseiro"
  | "determinado";

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

export type NewsKind = "resultado" | "mercado" | "lesao" | "cartao" | "sistema" | "premio";

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

export interface CareerState {
  version: 2;
  leagueId: string;
  clubId: string;
  managerName: string;
  season: number;
  round: number;
  tactics: Tactics;
  training: TrainingFocus;
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
}

export interface MatchEventLog {
  minute: number;
  type: "goal" | "shot" | "save" | "foul" | "sub" | "kickoff" | "halftime" | "fulltime" | "chance";
  side: "home" | "away" | "neutral";
  text: string;
}
