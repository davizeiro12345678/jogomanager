import { supabase } from "@/integrations/supabase/client";
import type { PushResult } from "./firebase-push";

const PUSH_CLEANUP_TIMEOUT_MS = 2000;

type PushCleanupOutcome =
  | { completed: true; result: PushResult }
  | { completed: false; reason: "push_cleanup_timeout" | "push_cleanup_error" };

type PushSignOutFailure = {
  error: Error;
  reason: "push_cleanup_timeout" | "push_cleanup_error" | "push_revocation_failed";
};

export type SignOutResult = Awaited<ReturnType<typeof supabase.auth.signOut>> | PushSignOutFailure;

async function waitForPushCleanup(cleanup: Promise<PushResult>): Promise<PushCleanupOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = Symbol("push-cleanup-timeout");
  try {
    const outcome = await Promise.race([
      cleanup.then(
        (result) => ({ kind: "result" as const, result }),
        () => ({ kind: "error" as const }),
      ),
      new Promise<{ kind: "timeout"; value: typeof timeout }>((resolve) => {
        timer = setTimeout(
          () => resolve({ kind: "timeout", value: timeout }),
          PUSH_CLEANUP_TIMEOUT_MS,
        );
      }),
    ]);
    if (outcome.kind === "timeout") {
      return { completed: false, reason: "push_cleanup_timeout" };
    }
    if (outcome.kind === "error") {
      return { completed: false, reason: "push_cleanup_error" };
    }
    return { completed: true, result: outcome.result };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function waitForBrowserRevocation(revocation: Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      revocation,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), PUSH_CLEANUP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Revoke the current browser before discarding its authenticated session.
 * Cloud cleanup may remain pending after browser revocation, but an unconfirmed
 * browser revocation must keep the session so the caller can retry safely.
 */
export async function signOutAndCleanDevice(): Promise<SignOutResult> {
  let push: typeof import("./firebase-push");
  try {
    push = await import("./firebase-push");
  } catch {
    return {
      error: new Error("Não foi possível revogar o token local neste dispositivo."),
      reason: "push_cleanup_error",
    };
  }

  const browserRevoked = await waitForBrowserRevocation(
    push.revokeFirebasePushBrowser({ timeoutMs: 1000 }),
  );
  if (!browserRevoked) {
    return {
      error: new Error("Não foi possível revogar o token local neste dispositivo."),
      reason: "push_revocation_failed",
    };
  }

  let cleanup: PushCleanupOutcome;
  try {
    cleanup = await waitForPushCleanup(
      push.disableFirebaseNotifications({
        timeoutMs: 600,
        retries: 1,
        skipBrowserRevocation: true,
      }),
    );
  } catch {
    cleanup = { completed: false, reason: "push_cleanup_error" };
  }
  // Browser revocation is the logout safety boundary. A cloud timeout/error
  // leaves its owner-scoped pending record for a later authenticated retry.
  if (!cleanup.completed) return supabase.auth.signOut();
  return supabase.auth.signOut();
}
