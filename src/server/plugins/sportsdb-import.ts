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
        const transientD1Failure = /D1_ERROR: Network connection lost|SQLITE_BUSY/i.test(message);
        if (!rateLimited && !transientD1Failure) await sportsDb.pauseSportsDbImport(message).catch(() => undefined);
        console.error(transientD1Failure ? "TheSportsDB scheduled batch will retry after a transient D1 error" : "TheSportsDB scheduled import failed", {
          message,
          retryAfterSeconds: rateLimited || transientD1Failure ? 60 : null,
        });
      }
    });
  });
});
