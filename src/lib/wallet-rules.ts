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
