/** Bounded loading preserves server order and rejects an incomplete catalog. */
export async function catalogPages<T>(
  count: number,
  pageSize: number,
  read: (offset: number, end: number) => Promise<T[]>,
  concurrency = 3,
): Promise<T[]> {
  if (!Number.isSafeInteger(count) || count < 0 || count > 300000)
    throw new Error("catalog_count_invalid");
  const pages = Math.ceil(count / pageSize),
    result: T[][] = [];
  let cursor = 0,
    stopped = false;
  const pending = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, pages) }, async () => {
      while (!stopped && cursor < pages) {
        const page = cursor++;
        try {
          const rows = await read(page * pageSize, (page + 1) * pageSize - 1);
          if (rows.length !== Math.min(pageSize, count - page * pageSize))
            throw new Error("catalog_page_incomplete");
          result[page] = rows;
        } catch (error) {
          stopped = true;
          throw error;
        }
      }
    }),
  );
  const failure = pending.find((x) => x.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return result.flat();
}
