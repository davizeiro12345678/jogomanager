import "@tanstack/react-start/server-only";

const LOVABLE_SEND_HOSTNAME = "api.lovable.dev";
const LOVABLE_SEND_PATH = "/v1/messaging/email/send";
const EMAIL_ADDRESS_PATTERN =
  /^[^\s@<>"(),;:\\[\].]+(\.[^\s@<>"(),;:\\[\].]+)*@[^\s@<>"(),;:\\[\].]+(\.[^\s@<>"(),;:\\[\].]+)*$/;

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Validate server-configured delivery endpoints before passing credentials to an SDK. */
export function validateLovableSendUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOVABLE_SEND_URL must be an absolute HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== LOVABLE_SEND_HOSTNAME ||
    (url.port !== "" && url.port !== "443") ||
    url.pathname !== LOVABLE_SEND_PATH ||
    url.search ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      "LOVABLE_SEND_URL must be the approved Lovable HTTPS email endpoint without credentials, query parameters, fragments, or redirects.",
    );
  }
  return value;
}

/** Validate untrusted recipient and reply-to addresses without echoing their values. */
export function validateEmailAddress(value: unknown, label: string): string {
  const address = typeof value === "string" ? value.trim() : "";
  if (
    !address ||
    address.length > 254 ||
    containsControlCharacter(address) ||
    !EMAIL_ADDRESS_PATTERN.test(address)
  ) {
    throw new Error(`${label} must be a valid email address.`);
  }
  return address;
}
