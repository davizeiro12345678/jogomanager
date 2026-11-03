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

export type CareerService = "injury_recovery" | "opponent_report";

/** Coin services; cost and weekly limit are enforced by spend_coins_on_service. */
export const CAREER_SERVICES: Record<CareerService, { cost: number; weeklyLimit: number }> = {
  injury_recovery: { cost: 250, weeklyLimit: 3 },
  opponent_report: { cost: 100, weeklyLimit: 10 },
};

/** Weeks removed from one player's injury by a recovery treatment. */
export const INJURY_RECOVERY_WEEKS = 2;
