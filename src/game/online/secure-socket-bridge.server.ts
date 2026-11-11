import { AuthoritativeMatchSession } from "./authoritative-match-session";
import { AuthoritativeSocketBridge } from "./authoritative-socket-bridge.server";
import { assertCurrentTicket } from "./match-protocol";
import { verifyMatchTicketV1 } from "./ticket-signing";

export interface SecureSocketBridgeOptions {
  session: AuthoritativeMatchSession;
  signingSecret: string;
  persistAfterCommand?: () => Promise<void>;
  now?: () => number;
}

/**
 * Production-safe bridge composition. No WebSocket route or Durable Object is
 * activated here: the trusted room owner still controls upgrades and durable
 * session storage. The accepted ticket must have a valid HMAC and timestamp.
 */
export function createSecureMatchSocketBridge(options: SecureSocketBridgeOptions) {
  if (options.signingSecret.trim().length < 32) {
    throw new Error("match ticket verifier requires a server-only 32-character secret");
  }
  const now = options.now ?? Date.now;
  return new AuthoritativeSocketBridge({
    session: options.session,
    now,
    ...(options.persistAfterCommand
      ? { persistAfterCommand: options.persistAfterCommand }
      : {}),
    verifyTicket: async (ticket) => {
      try {
        assertCurrentTicket(ticket, now());
        return await verifyMatchTicketV1(ticket, options.signingSecret);
      } catch {
        return false;
      }
    },
  });
}
