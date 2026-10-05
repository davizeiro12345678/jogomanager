/**
 * Server-only Slack notifications through the Lovable connector gateway.
 * Notifications are best-effort: a Slack outage must never block a purchase
 * or a match result, so failures are logged and swallowed by the caller.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const DEFAULT_CHANNEL = "social";

export async function postSlackMessage(text: string, channel?: string): Promise<boolean> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const slackKey = process.env["SLACK_API_KEY"];
  if (!lovableKey || !slackKey) return false;
  const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channel ?? process.env["SLACK_NOTIFY_CHANNEL"] ?? DEFAULT_CHANNEL,
      text: text.slice(0, 3000),
    }),
  });
  if (!res.ok) {
    console.error(`Slack falhou [${res.status}]: ${await res.text()}`);
    return false;
  }
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!body.ok) console.error(`Slack recusou: ${body.error ?? "erro desconhecido"}`);
  return body.ok === true;
}

/** Fire-and-forget wrapper so callers never await or fail on Slack. */
export function notifySlack(text: string): void {
  postSlackMessage(text).catch((error: unknown) =>
    console.error("Slack indisponível", error instanceof Error ? error.message : error),
  );
}
