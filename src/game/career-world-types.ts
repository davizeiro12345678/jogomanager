export type InterviewType =
  | "routine"
  | "derby"
  | "defeat"
  | "title"
  | "signing"
  | "unhappy"
  | "crisis"
  | "continental"
  | "streak"
  | "sacking"
  | "renewal";
export type PressResponse =
  "provoke" | "protect" | "discipline" | "tactical" | "youth" | "diplomatic";
export interface CoachIdentity {
  assertiveness: number;
  protection: number;
  attacking: number;
  warmth: number;
  youth: number;
  reputation: number;
}
export interface PlayerRelationship {
  trust: number;
  respect: number;
  lastTalk: string;
}
export interface SupporterMatchday {
  occupancy: number;
  climate: "apoio" | "cobrança" | "protesto";
  side: "home" | "away";
  intensity: number;
}
export interface CareerMemory {
  id: string;
  clubId: string;
  season: number;
  round: number;
  kind:
    | "result"
    | "interview"
    | "signing"
    | "sale"
    | "youth"
    | "title"
    | "promise"
    | "relationship"
    | "renewal";
  title: string;
  detail: string;
  sentiment: number;
  weight: number;
  playerId?: string;
}
export interface CareerWorld {
  version: 1;
  seed: number;
  clubId: string;
  identity: CoachIdentity;
  fans: { trust: number; heat: number; patience: number; lastReaction: string };
  relationships: Record<string, PlayerRelationship>;
  memories: CareerMemory[];
  applied: string[];
  interviewedAt?: string;
}
export interface InterviewDecision {
  type: InterviewType;
  response: PressResponse;
  eventKey: string;
  playerId?: string;
}
