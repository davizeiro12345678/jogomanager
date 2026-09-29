import { definePlugin } from "nitro";
import { withCloudflareBindings } from "../../lib/cloudflare-bindings.server";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    await withCloudflareBindings(env, async () => {
      const sportsDb = await import("../../lib/sportsdb-cloudflare.server");
      try {
        const batch = await sportsDb.runNextSportsDbImportBatch(8);
        const liveScores = await sportsDb.refreshSportsDbLiveScores();
        console.info("TheSportsDB scheduled batch completed", {
          phase: batch.phase,
          processed: batch.processed,
          imported: batch.imported,
          complete: batch.complete,
          liveScores,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown import failure";
        const rateLimited = error instanceof Error && error.name === "SportsDbRateLimitError";
        if (!rateLimited) await sportsDb.pauseSportsDbImport(message).catch(() => undefined);
        console.error("TheSportsDB scheduled import failed", {
          message,
          retryAfterSeconds: rateLimited ? 60 : null,
        });
      }
    });
  });
});
