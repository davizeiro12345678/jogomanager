import { reportSilent } from "./report-silent";

export async function retryChunk<T>(
  scope: string,
  load: () => Promise<T>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      reportSilent(scope, error, { class: "degradation", code: "chunk-load", attempt });
      if (attempt >= 2) throw error;
      await wait(attempt === 0 ? 500 : 1500);
    }
  }
}
