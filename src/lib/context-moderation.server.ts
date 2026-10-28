/** Server-only semantic moderation. Never log messages, responses or the API key. */
export async function classifyChatText(
  apiKey: string,
  body: string,
  context: string[],
): Promise<"allow" | "block" | "unavailable"> {
  try {
    const previous = context.slice(-3).map((entry) => entry.slice(0, 200));
    const input = previous.length
      ? `Mensagens anteriores na mesma sala:\n${previous.join("\n")}\nNova mensagem:\n${body}`
      : body;
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok || !response.body) return "unavailable";
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 16_384) {
          await reader.cancel();
          return "unavailable";
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const result: unknown = JSON.parse(text);
    if (!result || typeof result !== "object" || !("results" in result)) return "unavailable";
    const results = result.results;
    if (!Array.isArray(results) || results.length !== 1 || typeof results[0]?.flagged !== "boolean")
      return "unavailable";
    return results[0].flagged ? "block" : "allow";
  } catch {
    return "unavailable";
  }
}

/** Disabled until explicitly enabled in the deployment; enabled mode fails closed. */
export async function reviewChatBeforePublish(
  userId: string,
  body: string,
  roomId?: string,
): Promise<"allow" | "block" | "rate_limited" | "unavailable"> {
  if (process.env["OPENAI_CHAT_MODERATION_ENABLED"] !== "true") return "allow";
  const apiKey = process.env["OPENAI_API_KEY"]?.trim();
  if (!apiKey) return "unavailable";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reserve_chat_moderation_for", {
      _user_id: userId,
      ...(roomId ? { _room_id: roomId } : {}),
    });
    if (error) return error.message.includes("rate_limited") ? "rate_limited" : "unavailable";
    if (!Array.isArray(data) || data.some((entry) => typeof entry !== "string"))
      return "unavailable";
    return classifyChatText(apiKey, body, data);
  } catch {
    return "unavailable";
  }
}
