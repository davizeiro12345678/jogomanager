// Read signed webhooks with an actual byte cap, including chunked requests.
// Reading request.text() and checking its size afterwards can allocate
// arbitrary amounts of memory before a limit is enforced.
export async function readLimitedWebhookBody(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new RangeError("Invalid webhook body limit");

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { kind: "invalid" };
    const advertised = Number(declared);
    if (!Number.isSafeInteger(advertised) || advertised > maxBytes)
      return { kind: "too_large" };
  }

  if (!request.body) return { kind: "ok", text: "" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return { kind: "ok", text };
      }
      if (!(value instanceof Uint8Array)) return { kind: "invalid" };
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return { kind: "too_large" };
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    await reader.cancel().catch(() => {});
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
}
