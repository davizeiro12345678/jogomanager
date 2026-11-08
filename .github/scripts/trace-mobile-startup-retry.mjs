export function shouldRetryNoNavStart(exitCode, runtimeErrorCode, attempt) {
  return runtimeErrorCode === "NO_NAVSTART" && attempt === 0;
}
