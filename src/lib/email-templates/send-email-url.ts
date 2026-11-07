/** Validate server-configured delivery endpoints before passing credentials to an SDK. */
export function validateLovableSendUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOVABLE_SEND_URL must be an absolute HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(
      "LOVABLE_SEND_URL must be an absolute HTTPS URL without credentials or fragments.",
    );
  }
  return value;
}
