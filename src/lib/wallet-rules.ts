/**
 * Wallet rules shown in the game. The database functions enforce the same
 * values; keep both in sync when a rate changes.
 */
export type ExchangeItem = "scout_report" | "training_boost";

/** Coins charged for one item when trading in the shop. */
export const COIN_EXCHANGE: Record<ExchangeItem, number> = {
  scout_report: 150,
  training_boost: 400,
};

/** Season pass: coins credited once every 7 days while the pass is active. */
export const SEASON_PASS_WEEKLY_COINS = 300;

/** Reports added to the career each time a premium scout report is used. */
export const PREMIUM_SCOUT_REPORT_SIZE = 5;

export type CareerService =
  | "injury_recovery"
  | "opponent_report"
  | "youth_boost"
  | "stadium_upgrade"
  | "contract_renewal"
  | "training_upgrade"
  | "premium_scout";

/** Coin services; cost and weekly limit are enforced by spend_coins_on_service. */
export const CAREER_SERVICES: Record<CareerService, { cost: number; weeklyLimit: number }> = {
  injury_recovery: { cost: 250, weeklyLimit: 3 },
  opponent_report: { cost: 100, weeklyLimit: 10 },
  youth_boost: { cost: 300, weeklyLimit: 2 },
  stadium_upgrade: { cost: 500, weeklyLimit: 1 },
  contract_renewal: { cost: 200, weeklyLimit: 3 },
  training_upgrade: { cost: 150, weeklyLimit: 5 },
  premium_scout: { cost: 120, weeklyLimit: 7 },
};
export const TRAINING_UPGRADE_RATE = 0.5;

/** Contract renewal: years added to one player's contract, never above the maximum. */
export const CONTRACT_RENEWAL_YEARS = 2;
export const CONTRACT_MAX_YEARS = 5;

/** Youth boost: potential added to one player aged up to YOUTH_BOOST_MAX_AGE. */
export const YOUTH_BOOST_POTENTIAL = 2;
export const YOUTH_BOOST_MAX_AGE = 21;
/** Stadium upgrade: +5% capacity per level, at most 5 levels per career. */
export const STADIUM_UPGRADE_RATE = 0.05;
export const STADIUM_UPGRADE_MAX_LEVEL = 5;

/** Weeks removed from one player's injury by a recovery treatment. */
export const INJURY_RECOVERY_WEEKS = 2;
