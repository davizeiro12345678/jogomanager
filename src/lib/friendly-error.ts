// Converts thrown errors into short, plain-language messages for players.
// Technical text (HTTP codes, SQL, stack traces, provider names) never reaches the screen.
const TECHNICAL =
  /(unauthorized|authorization|jwt|token|fetch|network|sql|postgres|supabase|stripe|stack|undefined|null|TypeError|status \d{3}|\b[45]\d\d\b|rpc|violates|constraint|ECONN|timeout)/i;

export function friendlyError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return fallback;
  if (/failed to fetch|network|ECONN|offline/i.test(message)) {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  if (/unauthorized|jwt|authorization|not authenticated/i.test(message)) {
    return "Sua sessão expirou. Entre na sua conta e tente de novo.";
  }
  if (TECHNICAL.test(message) || message.length > 160) return fallback;
  return message;
}
