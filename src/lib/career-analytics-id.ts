/**
 * Random, non-personal identifier for the current local career, used only to
 * group analytics events. It is never derived from the manager name or account.
 */
const STORAGE_KEY = "jm.career-analytics-id";

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Call when a new career is created so its events get a fresh identifier. */
export function startCareerAnalyticsId(): string {
  const id = randomId();
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode: the id still lives for this call.
  }
  return id;
}

export function careerAnalyticsId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? startCareerAnalyticsId();
  } catch {
    return randomId();
  }
}

export function existingCareerAnalyticsId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
