export type PlayerPosition = "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "PON" | "ATA";
export type BodyBuild = "leve" | "atletico" | "forte";
export type AthletePersonality = "profissional" | "ambicioso" | "leal" | "temperamental";
export type CareerOrigin = "base" | "peneira" | "varzea";
export type TrainingIntensity = "leve" | "normal" | "pesado";
export type MatchRole = "titular" | "reserva" | "fora";

export type AttributeGroup = "tecnico" | "fisico" | "mental" | "defensivo" | "goleiro";

export interface Appearance {
  skin: number; // 0..5
  hair: number; // 0..9 estilos
  hairColor: number; // 0..4
  beard: number; // 0..3
  boots: number; // 0..5
}

export interface Contract {
  clubId: string;
  salary: number; // R$ por semana
  untilSeason: number;
  goalBonus: number;
  releaseClause: number;
}

export interface Injury {
  label: string;
  weeksLeft: number;
}

export interface SeasonLine {
  season: number;
  age: number;
  clubId: string;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  ratingSum: number;
  motm: number;
}

export interface MatchReport {
  week: number;
  opponentId: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  role: MatchRole;
  minutes: number;
  rating: number | null;
  goals: number;
  assists: number;
  reasons: string[];
  motm: boolean;
}

export interface NewsItem {
  id: string;
  season: number;
  week: number;
  title: string;
  tone: "good" | "bad" | "neutral";
}

export interface Offer {
  id: string;
  clubId: string;
  salary: number;
  years: number;
  loan: boolean;
}

export interface KeyMoment {
  id: string;
  minute: number;
  prompt: string;
  options: { id: string; label: string; attr: string; risk: number; reward: "goal" | "assist" | "save" | "tackle" | "keep" }[];
}

export interface PlayerCareerState {
  version: 1;
  slot: 1 | 2 | 3;
  seed: string;
  name: string;
  nickname: string;
  nation: string;
  hometown: string;
  position: PlayerPosition;
  secondary: PlayerPosition[];
  foot: "direito" | "esquerdo";
  weakFoot: number;
  heightCm: number;
  weightKg: number;
  build: BodyBuild;
  personality: AthletePersonality;
  origin: CareerOrigin;
  appearance: Appearance;
  shirtNumber: number;
  age: number;
  season: number;
  week: number;
  leagueId: string;
  clubId: string;
  attrs: Record<string, number>;
  potential: number;
  potentialSeenRange: [number, number];
  traits: string[];
  energy: number;
  form: number;
  morale: number;
  trust: number;
  chemistry: number;
  injury: Injury | null;
  contract: Contract;
  money: number;
  followers: number;
  reputation: number;
  nationalCaps: number;
  nationalGoals: number;
  awards: string[];
  current: SeasonLine;
  history: SeasonLine[];
  lastMatch: MatchReport | null;
  recent: MatchReport[];
  news: NewsItem[];
  offers: Offer[];
  pendingMoment: { week: number; moments: KeyMoment[] } | null;
  retired: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAthleteInput {
  slot: 1 | 2 | 3;
  name: string;
  nickname: string;
  nation: string;
  hometown: string;
  position: PlayerPosition;
  foot: "direito" | "esquerdo";
  heightCm: number;
  build: BodyBuild;
  personality: AthletePersonality;
  origin: CareerOrigin;
  clubId: string;
  appearance: Appearance;
  shirtNumber: number;
}
