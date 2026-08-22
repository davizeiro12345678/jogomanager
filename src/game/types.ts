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

export interface CareerState {
  version: 1;
  leagueId: string;
  clubId: string;
  managerName: string;
  round: number;
  tactics: Tactics;
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
}

export interface MatchEventLog {
  minute: number;
  type: "goal" | "shot" | "save" | "foul" | "sub" | "kickoff" | "halftime" | "fulltime" | "chance";
  side: "home" | "away" | "neutral";
  text: string;
}
