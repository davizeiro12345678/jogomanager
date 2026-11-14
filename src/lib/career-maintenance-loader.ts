/** Exceptional repair and explicit reset stay outside normal career startup. */
export const loadCareerRecovery = () => import("./career-save-recovery");
export const loadCareerReset = () => import("./career-reset");

/** Raw snapshots are normalized before use; an empty or cached career needs no migration. */
export const loadCareerMigration = () => import("@/game/career-migration");
