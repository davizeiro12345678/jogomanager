export const MAX_NO_NAVSTART_RETRIES = 2;

export function shouldRetryNoNavStart(_exitCode, runtimeErrorCode, attempt) {
  return (
    runtimeErrorCode === "NO_NAVSTART" &&
    Number.isInteger(attempt) &&
    attempt >= 0 &&
    attempt < MAX_NO_NAVSTART_RETRIES
  );
}
