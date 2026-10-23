export const MAX_AI_REQUEST_BYTES = 64 * 1024;

/** Apply the input budget before reserving credits or contacting the provider. */
export function validAiRequest(messages: readonly { role: string; content: string }[]): boolean {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 24) return false;
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const message of messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.length > MAX_AI_REQUEST_BYTES
    )
      return false;
    bytes += encoder.encode(message.content).byteLength;
    if (bytes > MAX_AI_REQUEST_BYTES) return false;
  }
  return true;
}
