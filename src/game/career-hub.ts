import { POSITION_LABEL } from "./player-career/attributes";
import { overall } from "./player-career/engine";
import type { PlayerCareerState } from "./player-career/types";
import type { CareerState } from "./types";
import { CLUBS } from "./data/leagues";

type CoachCareerSource = Pick<
  CareerState,
  "clubId" | "managerName" | "season" | "round" | "sacked" | "manager"
>;

/** A presentation-only snapshot. It never reads storage or changes a save. */
export interface CoachCareerHubSummary {
  managerName: string;
  clubName: string;
  season: number;
  round: number;
  active: boolean;
  status: string;
  accent: string;
}

/** A presentation-only snapshot for one of the durable player slots. */
export interface AthleteCareerHubSummary {
  slot: 1 | 2 | 3;
  athleteName: string;
  clubName: string;
  position: string;
  age: number;
  season: number;
  week: number;
  rating: number;
  retired: boolean;
  accent: string;
}

function textOr(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function clubSummary(clubId: string) {
  const club = CLUBS[clubId];
  return {
    name: club?.name ?? "Clube não identificado",
    accent: club?.primary ?? "var(--primary)",
  };
}

export function summarizeCoachCareer(
  career: CoachCareerSource | null,
): CoachCareerHubSummary | null {
  if (!career) return null;
  const club = clubSummary(career.clubId);
  const managerName = textOr(career.manager?.name, textOr(career.managerName, "Treinador"));
  const active = !career.sacked;

  return {
    managerName,
    clubName: club.name,
    season: Math.max(1, career.season || 1),
    round: Math.max(1, career.round || 1),
    active,
    status: active ? `No comando de ${club.name}` : "Disponível para um novo clube",
    accent: club.accent,
  };
}

export function summarizeAthleteCareer(
  athlete: PlayerCareerState | null,
  slot: 1 | 2 | 3,
): AthleteCareerHubSummary | null {
  if (!athlete) return null;
  const club = clubSummary(athlete.clubId);
  return {
    slot,
    athleteName: textOr(athlete.nickname, textOr(athlete.name, "Atleta")),
    clubName: club.name,
    position: POSITION_LABEL[athlete.position],
    age: athlete.age,
    season: Math.max(1, athlete.season || 1),
    week: Math.max(1, athlete.week || 1),
    rating: overall(athlete),
    retired: athlete.retired,
    accent: club.accent,
  };
}
