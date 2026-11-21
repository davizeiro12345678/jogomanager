import { DurableObject } from "cloudflare:workers";

/**
 * The emergency-disabled Cloudflare staging bootstrap.
 * This is NOT the game engine. The production-style Wrangler config still
 * targets worker.ts; a full verified CI deploy replaces this scaffold.
 * No public routes, ticket issuance, Supabase access or gameplay are enabled.
 */
export class MatchRoomDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS staging_bootstrap (version INTEGER PRIMARY KEY, created_at INTEGER NOT NULL)",
      );
      this.ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO staging_bootstrap(version, created_at) VALUES (?, ?)",
        1,
        Date.now(),
      );
    });
  }

  async fetch() {
    return new Response(null, { status: 404 });
  }
}

export default {
  async fetch() {
    return new Response(null, { status: 404 });
  },
  async scheduled() {
    return;
  },
};
