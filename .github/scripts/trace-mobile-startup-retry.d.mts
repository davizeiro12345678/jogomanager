export const MAX_NO_NAVSTART_RETRIES: 2;

export function shouldRetryNoNavStart(
  exitCode: number | null,
  runtimeErrorCode: string | undefined,
  attempt: number,
): boolean;
